// Coach Portal API core. Pure Web APIs only (no Node imports, no @netlify/blobs) so it can be tested anywhere.
// The Netlify function (netlify/functions/portal.mjs) injects the real Blobs store; tests inject a fake one.
//
// SECURITY MODEL (this file IS the access control; there is no database-level security):
//  - Every endpoint except /status, /login, /setup*, /first-admin, /recover, /import requires a valid session cookie
//    AND that the coach is still active. Deactivating a coach cuts access on their very next request.
//  - Only admins can delete (except removing a player from a lesson, which any coach can do) and manage coaches.
//  - Passwords: PBKDF2-SHA256 (600k iterations), per-password salt. Nobody but the coach ever knows a password:
//    an admin hands over a one-time link and the coach chooses their own.
//  - Sessions: random 256-bit token in an HttpOnly Secure SameSite=Strict cookie; only its SHA-256 is stored.
//  - Never log request bodies or data: they contain children's information.

const ENC = new TextEncoder();
const PBKDF2_ITER = 600000;
const SESSION_MS = 14 * 24 * 3600 * 1000;
const SETUP_MS = 7 * 24 * 3600 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const COOKIE = "pb_session";
const MAX_BODY = 6_000_000;

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = m => new HttpError(400, m);

// ───────── crypto helpers ─────────
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const unhex = h => Uint8Array.from(h.match(/../g).map(x => parseInt(x, 16)));
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = async s => hex(await crypto.subtle.digest("SHA-256", ENC.encode(String(s))));
const randomToken = () => b64u(crypto.getRandomValues(new Uint8Array(32)));
function same(a, b) { // constant-time string compare
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function derive(password, salt, iter) {
  const key = await crypto.subtle.importKey("raw", ENC.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256));
}
async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: hex(salt), hash: await derive(pw, salt, PBKDF2_ITER), iter: PBKDF2_ITER };
}
const DUMMY = { salt: "00".repeat(16), hash: "", iter: PBKDF2_ITER };
async function checkPassword(pw, rec) { return same(await derive(pw, unhex(rec.salt), rec.iter), rec.hash); }

// ───────── storage helpers (store = { get(key) -> {data, etag}|null, set(key, data, {onlyIfMatch|onlyIfNew}) -> {modified}, delete(key) }) ─────────
// Read-modify-write with compare-and-swap, so two coaches saving at the same moment never overwrite each other.
async function mutate(store, key, fn, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const cur = await store.get(key);
    const next = await fn(structuredClone(cur ? cur.data : { rows: {} }));
    if (next === null) return cur ? cur.data : { rows: {} };
    const res = await store.set(key, next, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (res.modified) return next;
    await new Promise(r => setTimeout(r, 15 + Math.random() * 60));
  }
  throw new HttpError(503, "The portal is busy. Please try again.");
}
const readRows = async (store, key) => Object.values(((await store.get(key))?.data?.rows) || {});

// ───────── validation ─────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const RESERVED = /^(__proto__|constructor|prototype)$/;
const T = (max = 500, extra = {}) => ({ type: "str", max, ...extra });
const ID = { type: "str", max: 64, req: true, id: true };
const DATE = { type: "date" };
const INT = (min, max, extra = {}) => ({ type: "int", min, max, ...extra });
const OBJ = (max = 20000) => ({ type: "obj", max });
const ARR = (max = 20000) => ({ type: "arr", max });
const BOOL = { type: "bool" };
const TRAINING = { type: "str", max: 2, re: /^T[1-8]$/ };

const TABLES = {
  players: {
    keys: ["id"], required: ["name", "level"],
    defaults: { level: 1, program: "Private VIP", milestones: {}, level_history: [], is_sample: false, archived: false },
    fields: { id: ID, name: T(120, { req: true }), level: INT(1, 4, { req: true }), program: T(60), junior_group: T(1, { oneOf: ["A", "B", "C"] }), main_coach: T(120), side: T(40), hand: T(40), start_date: DATE, goal: T(500), health_notes: T(2000), dob: DATE, school: T(120), parent_name: T(120), parent_phone: T(40), kit_size: T(40), milestones: OBJ(), level_history: ARR(), is_sample: BOOL, archived: BOOL },
  },
  lessons: {
    keys: ["id"], required: ["date", "coach_name"],
    defaults: { summary: "", exercises: [], is_sample: false },
    fields: { id: ID, date: { type: "date", req: true }, coach_id: T(64), coach_name: T(120, { req: true }), group_code: T(5, { oneOf: ["A", "B", "C", "mixed", "adult"] }), module: INT(0, 5), training: TRAINING, focus: T(300), objectives: T(2000), summary: T(8000), exercises: ARR(), is_sample: BOOL },
  },
  lesson_feedback: {
    keys: ["lesson_id", "player_id"], required: ["attendance"],
    defaults: { attendance: "Present", rating: 0 },
    refs: { lesson_id: "lessons", player_id: "players" },
    fields: { lesson_id: ID, player_id: ID, attendance: T(7, { req: true, oneOf: ["Present", "Late", "Absent"] }), rating: INT(0, 5, { req: true }), comment: T(4000), improve: T(4000), next_focus: T(2000) },
  },
  progress_reports: {
    keys: ["id"], required: ["player_id", "date"],
    defaults: { pillars: {}, match: {}, improve: [], is_sample: false },
    refs: { player_id: "players" },
    fields: { id: ID, player_id: ID, date: { type: "date", req: true }, type: T(60), coach_name: T(120), pillars: OBJ(), match: OBJ(), strengths: T(4000), improve: ARR(), improve_notes: T(4000), next_focus: T(2000), homework: T(2000), injury: T(2000), is_sample: BOOL },
  },
  objectives: {
    keys: ["id"], required: ["player_id", "kind", "title"],
    defaults: { status: "Open", result: "—", is_sample: false },
    refs: { player_id: "players" },
    fields: { id: ID, player_id: ID, kind: T(30, { req: true, oneOf: ["Technique", "Match data", "Fitness & durability", "Level test", "Tournament"] }), title: T(300, { req: true }), target: T(300), due: DATE, status: T(30, { req: true }), tournament_date: DATE, category: T(120), partner: T(120), result: T(120), is_sample: BOOL },
  },
  session_plans: {
    keys: ["id"], required: ["module", "training"],
    defaults: { exercises: [] },
    fields: { id: ID, module: INT(0, 5, { req: true }), training: { ...TRAINING, req: true }, objectives: T(2000), exercises: ARR(), updated_by_name: T(120) },
  },
  content: {
    keys: ["key"], required: ["data"], importOnly: true,
    fields: { key: { type: "str", max: 40, req: true, id: true }, data: OBJ(3_000_000) },
  },
};
const WRITABLE = ["players", "lessons", "lesson_feedback", "progress_reports", "objectives", "session_plans"];

function checkField(name, spec, v) {
  if (v === null || v === undefined) { if (spec.req) throw bad(`${name} is required.`); return null; }
  switch (spec.type) {
    case "str":
      if (typeof v !== "string" || v.length > spec.max) throw bad(`${name} is not valid or too long.`);
      if (spec.req && !v.trim()) throw bad(`${name} is required.`);
      if (spec.id && (!ID_RE.test(v) || RESERVED.test(v))) throw bad(`${name} is not a valid id.`);
      if (spec.oneOf && v !== "" && !spec.oneOf.includes(v)) throw bad(`${name} is not an allowed value.`);
      if (spec.re && v !== "" && !spec.re.test(v)) throw bad(`${name} is not an allowed value.`);
      return v;
    case "int":
      if (!Number.isInteger(v) || v < spec.min || v > spec.max) throw bad(`${name} is out of range.`);
      return v;
    case "date":
      if (typeof v !== "string" || !DATE_RE.test(v) || isNaN(Date.parse(v))) throw bad(`${name} is not a valid date.`);
      return v;
    case "bool":
      if (typeof v !== "boolean") throw bad(`${name} must be true or false.`);
      return v;
    case "obj":
      if (typeof v !== "object" || Array.isArray(v) || JSON.stringify(v).length > spec.max) throw bad(`${name} is not valid or too large.`);
      return v;
    case "arr":
      if (!Array.isArray(v) || JSON.stringify(v).length > spec.max) throw bad(`${name} is not valid or too large.`);
      return v;
  }
  throw bad("Invalid data.");
}
function cleanRow(table, row) {
  const spec = TABLES[table];
  if (!row || typeof row !== "object" || Array.isArray(row)) throw bad("Invalid record.");
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (!(k in spec.fields)) throw bad("Unexpected field.");
    out[k] = checkField(k, spec.fields[k], v);
  }
  for (const k of spec.keys) if (out[k] == null) throw bad(`${k} is required.`);
  return out;
}
const rowKey = (spec, row) => spec.keys.map(k => row[k]).join("|");

// ───────── data operations ─────────
async function upsertRows(store, actor, table, rows, onConflict) {
  const spec = TABLES[table];
  if (!spec) throw bad("Unknown table.");
  if (!Array.isArray(rows) || !rows.length || rows.length > 3000) throw bad("Nothing to save.");
  if (onConflict && String(onConflict).replace(/\s/g, "") !== spec.keys.join(",")) throw bad("Invalid request.");
  const clean = rows.map(r => cleanRow(table, r));
  for (const [col, target] of Object.entries(spec.refs || {})) { // the player / lesson a record points at must exist
    const ids = new Set((await readRows(store, "data/" + target)).map(r => r.id));
    if (clean.some(r => r[col] != null && !ids.has(r[col]))) throw bad("That record refers to something that no longer exists. Refresh and try again.");
  }
  const now = new Date().toISOString();
  await mutate(store, "data/" + table, doc => {
    for (const c of clean) {
      const k = rowKey(spec, c), old = doc.rows[k];
      const merged = { ...(old || { ...(spec.defaults || {}), created_at: now, created_by: actor }), ...c, updated_at: now, updated_by: actor };
      for (const r of spec.required) if (merged[r] == null || merged[r] === "") throw bad(`${r} is required.`);
      doc.rows[k] = merged;
    }
    return doc;
  });
  return clean.length;
}
const dropWhere = (store, table, pred) => mutate(store, "data/" + table, doc => {
  let n = 0;
  for (const [k, r] of Object.entries(doc.rows)) if (pred(r)) { delete doc.rows[k]; n++; }
  return n ? doc : null;
});
async function removeRows(store, isAdmin, table, match) {
  const spec = TABLES[table];
  if (!spec || spec.importOnly) throw bad("Unknown table.");
  if (table !== "lesson_feedback" && !isAdmin) throw new HttpError(403, "You don't have permission to do that.");
  if (!match || typeof match !== "object") throw bad("Invalid request.");
  for (const k of spec.keys) if (typeof match[k] !== "string" || !ID_RE.test(match[k])) throw bad("Invalid request.");
  if (Object.keys(match).length !== spec.keys.length) throw bad("Invalid request.");
  // children first, so an interrupted delete never leaves orphans pointing at a missing parent
  if (table === "players") for (const t of ["lesson_feedback", "progress_reports", "objectives"]) await dropWhere(store, t, r => r.player_id === match.id);
  if (table === "lessons") await dropWhere(store, "lesson_feedback", r => r.lesson_id === match.id);
  await dropWhere(store, table, r => spec.keys.every(k => r[k] === match[k]));
}

// ───────── coaches & sessions ─────────
const loadCoaches = async store => ((await store.get("meta/coaches"))?.data?.rows) || {};
const publicCoach = c => ({ user_id: c.user_id, name: c.name, email: c.email, role: c.role, active: c.active, pending: !c.pw, created_at: c.created_at });
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const normEmail = e => String(e ?? "").trim().toLowerCase();
function checkNewPassword(pw, coachLike) {
  if (typeof pw !== "string" || pw.length < 10) throw bad("Use at least 10 characters.");
  if (pw.length > 200) throw bad("That password is too long.");
  const low = pw.toLowerCase();
  if (low === String(coachLike.email || "").toLowerCase() || low === String(coachLike.name || "").toLowerCase()) throw bad("Choose a password that isn't your name or email.");
  if (/^(.)\1+$/.test(pw)) throw bad("Choose a less predictable password.");
}
async function newSession(store, coach) {
  const token = randomToken();
  await store.set("sessions/" + await sha256(token), { uid: coach.user_id, pwv: coach.pw_version, exp: Date.now() + SESSION_MS });
  return `${COOKIE}=${token}; Path=/api/portal; Max-Age=${SESSION_MS / 1000}; HttpOnly; Secure; SameSite=Strict`;
}
const parseCookies = h => Object.fromEntries(String(h || "").split(/;\s*/).filter(Boolean).map(p => { const i = p.indexOf("="); return [p.slice(0, i), p.slice(i + 1)]; }));
async function authenticate(store, headers) {
  const token = parseCookies(headers.cookie)[COOKIE];
  if (!token || token.length > 100) return null;
  const key = "sessions/" + await sha256(token), s = await store.get(key);
  if (!s) return null;
  if (s.data.exp < Date.now()) { await store.delete(key); return null; }
  const c = (await loadCoaches(store))[s.data.uid];
  return c && c.active && c.pw && c.pw_version === s.data.pwv ? c : null;
}

// ───────── brute-force protection (best effort) ─────────
async function rlCheck(store, key) {
  const r = (await store.get("rl/" + key))?.data;
  if (r && r.until > Date.now()) throw new HttpError(429, "Too many attempts. Please wait 15 minutes and try again.");
}
async function rlFail(store, key, max) {
  const cur = (await store.get("rl/" + key))?.data, now = Date.now(), live = cur && now - cur.first < WINDOW_MS;
  const n = live ? cur.n + 1 : 1;
  await store.set("rl/" + key, { n, first: live ? cur.first : now, until: n >= max ? now + WINDOW_MS : 0 });
}
const rlClear = (store, key) => store.delete("rl/" + key);

// ───────── response / routing ─────────
const res = (status, body, headers = {}) => ({ status, body: JSON.stringify(body), headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });
const userOf = c => ({ user_id: c.user_id, name: c.name, email: c.email, role: c.role });
const parseBody = text => { try { const b = JSON.parse(text || "{}"); if (b && typeof b === "object" && !Array.isArray(b)) return b; } catch { /* fall through */ } throw bad("Invalid request."); };
function setupKeyOk(env, given) {
  const k = String(env.PORTAL_SETUP_KEY ?? "").trim();
  if (k.length < 16) throw new HttpError(503, "The setup key is not set in Netlify yet (PORTAL_SETUP_KEY, at least 16 characters).");
  return same(k, String(given ?? ""));
}
async function guardKey(store, ip, ok) {
  const ik = "k:" + await sha256(ip || "?");
  await rlCheck(store, ik);
  if (!ok()) { await rlFail(store, ik, 10); await new Promise(r => setTimeout(r, 400)); throw new HttpError(403, "That setup key is not correct."); }
  await rlClear(store, ik);
}

// Everything a logged-in coach may see (never password material).
async function snapshot(store) {
  const names = Object.keys(TABLES);
  const docs = await Promise.all(names.map(t => store.get("data/" + t)));
  const out = { coaches: Object.values(await loadCoaches(store)).map(publicCoach).sort((a, b) => a.name.localeCompare(b.name)) };
  names.forEach((t, i) => {
    const rows = Object.values(docs[i]?.data?.rows || {});
    out[t] = t === "content" ? rows.map(r => ({ key: r.key, data: r.data })) : rows.sort((a, b) => rowKey(TABLES[t], a).localeCompare(rowKey(TABLES[t], b)));
  });
  return out;
}

export async function handle(req, store, env = {}) {
  try { return await route(req, store, env); }
  catch (e) {
    if (e instanceof HttpError) return res(e.status, { error: e.message });
    console.error("portal error:", e?.name); // name only: never log messages or data
    return res(500, { error: "Something went wrong. Please try again." });
  }
}

async function route(req, store, env) {
  const method = req.method.toUpperCase(), path = (req.path || "/").replace(/\/+$/, "") || "/";
  const headers = Object.fromEntries(Object.entries(req.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (method !== "GET") {
    if (headers["x-portal"] !== "1") throw new HttpError(403, "Request not allowed.");
    const origin = headers.origin;
    if (origin && headers.host) { let h = ""; try { h = new URL(origin).host; } catch { /* invalid */ } if (h !== headers.host) throw new HttpError(403, "Request not allowed."); }
    if ((req.body || "").length > MAX_BODY) throw new HttpError(413, "Too much data in one request.");
  }
  const ip = req.ip || headers["x-nf-client-connection-ip"] || (headers["x-forwarded-for"] || "").split(",")[0].trim();
  const rt = `${method} ${path}`;

  // ----- public endpoints -----
  if (rt === "GET /status") {
    const n = Object.keys(await loadCoaches(store)).length;
    return res(200, { ready: n > 0, bootstrap: n === 0 && String(env.PORTAL_SETUP_KEY ?? "").trim().length >= 16 });
  }
  if (rt === "POST /login") {
    const b = parseBody(req.body), email = normEmail(b.email), password = typeof b.password === "string" ? b.password : "";
    if (!email || !password || password.length > 200) throw new HttpError(401, "That email and password don't match.");
    const ek = "e:" + await sha256(email), ik = "i:" + await sha256(ip || "?");
    await rlCheck(store, ek); await rlCheck(store, ik);
    const c = Object.values(await loadCoaches(store)).find(x => x.email === email);
    const ok = (await checkPassword(password, c?.pw || DUMMY)) && !!c?.pw; // always does the same work, so timing doesn't reveal which emails exist
    if (!ok) { await rlFail(store, ek, 8); await rlFail(store, ik, 40); throw new HttpError(401, "That email and password don't match."); }
    if (!c.active) throw new HttpError(403, "This account isn't active. Ask Navid to check your access.");
    await rlClear(store, ek);
    return res(200, { user: userOf(c) }, { "set-cookie": await newSession(store, c) });
  }
  if (rt === "POST /setup-info" || rt === "POST /setup") {
    const b = parseBody(req.body), token = typeof b.token === "string" ? b.token : "";
    const ik = "k:" + await sha256(ip || "?");
    await rlCheck(store, ik);
    const h = token.length >= 20 && token.length <= 100 ? await sha256(token) : "";
    const find = coaches => Object.values(coaches).find(c => h && c.setup && same(c.setup.hash, h) && c.setup.exp > Date.now());
    const c0 = find(await loadCoaches(store));
    if (!c0 || !c0.active) { await rlFail(store, ik, 20); throw new HttpError(400, "This link has expired or was already used. Ask Navid for a new one."); }
    if (rt === "POST /setup-info") return res(200, { name: c0.name, email: c0.email });
    checkNewPassword(b.password, c0);
    const pw = await hashPassword(b.password);
    let done = null;
    await mutate(store, "meta/coaches", doc => {
      const c = find(doc.rows);
      if (!c) throw bad("This link has expired or was already used. Ask Navid for a new one.");
      Object.assign(c, { pw, pw_version: (c.pw_version || 0) + 1, setup: null }); done = { ...c };
      return doc;
    });
    await rlClear(store, ik);
    return res(200, { user: userOf(done) }, { "set-cookie": await newSession(store, done) });
  }
  if (rt === "POST /first-admin") {
    const b = parseBody(req.body);
    await guardKey(store, ip, () => setupKeyOk(env, b.key));
    const name = String(b.name ?? "").trim(), email = normEmail(b.email);
    if (!name || name.length > 80 || !EMAIL_RE.test(email)) throw bad("Enter your name and a valid email.");
    checkNewPassword(b.password, { name, email });
    const pw = await hashPassword(b.password), c = { user_id: crypto.randomUUID(), name, email, role: "admin", active: true, pw, pw_version: 1, setup: null, created_at: new Date().toISOString() };
    await mutate(store, "meta/coaches", doc => {
      if (Object.keys(doc.rows).length) throw new HttpError(409, "The first admin already exists. Log in instead.");
      doc.rows[c.user_id] = c; return doc;
    });
    return res(200, { user: userOf(c) }, { "set-cookie": await newSession(store, c) });
  }
  if (rt === "POST /recover") { // admin locked out: with the setup key, mint a password link for an existing coach
    const b = parseBody(req.body);
    await guardKey(store, ip, () => setupKeyOk(env, b.key));
    const email = normEmail(b.email), token = randomToken(), h = await sha256(token);
    await mutate(store, "meta/coaches", doc => {
      const c = Object.values(doc.rows).find(x => x.email === email && x.active);
      if (!c) throw new HttpError(404, "No active coach has that email.");
      c.setup = { hash: h, exp: Date.now() + SETUP_MS }; return doc;
    });
    return res(200, { token });
  }
  if (rt === "POST /import") { // one-off bulk load from the owner's computer, guarded by the setup key
    const b = parseBody(req.body);
    await guardKey(store, ip, () => setupKeyOk(env, headers["x-setup-key"]));
    if (!TABLES[b.table]) throw bad("Unknown table.");
    return res(200, { saved: await upsertRows(store, "import", b.table, b.rows, null) });
  }

  // ----- everything below needs a logged-in, active coach -----
  const me = await authenticate(store, headers);
  if (rt === "POST /logout") {
    const token = parseCookies(headers.cookie)[COOKIE];
    if (token && token.length <= 100) await store.delete("sessions/" + await sha256(token));
    return res(200, { ok: true }, { "set-cookie": `${COOKIE}=; Path=/api/portal; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });
  }
  if (!me) throw new HttpError(401, "Please log in.");
  const isAdmin = me.role === "admin";

  if (rt === "GET /me") return res(200, { user: userOf(me) });
  if (rt === "GET /all") return res(200, await snapshot(store));
  if (rt === "GET /backup") { // admin-only full export, for the owner to keep a private copy
    if (!isAdmin) throw new HttpError(403, "Admins only.");
    const day = new Date().toISOString().slice(0, 10);
    return res(200, { exported_at: new Date().toISOString(), ...await snapshot(store) }, { "content-disposition": `attachment; filename="padel-beast-portal-backup-${day}.json"` });
  }
  if (rt === "POST /write") {
    const b = parseBody(req.body);
    if (!WRITABLE.includes(b.table)) throw bad("Unknown table.");
    if (b.op === "upsert") { await upsertRows(store, me.user_id, b.table, b.rows, b.onConflict); return res(200, { ok: true }); }
    if (b.op === "remove") { await removeRows(store, isAdmin, b.table, b.match); return res(200, { ok: true }); }
    throw bad("Invalid request.");
  }
  if (rt === "POST /coach") {
    if (!isAdmin) throw new HttpError(403, "Admins only.");
    const b = parseBody(req.body);
    if (b.action === "invite") {
      const name = String(b.name ?? "").trim(), email = normEmail(b.email), role = b.role === "admin" ? "admin" : "coach";
      if (!name || name.length > 80 || !EMAIL_RE.test(email)) throw bad("Enter a name and a valid email.");
      const token = randomToken(), h = await sha256(token);
      await mutate(store, "meta/coaches", doc => {
        if (Object.values(doc.rows).some(c => c.email === email)) throw new HttpError(409, "That email is already a coach. Use “New link” in the list.");
        const id = crypto.randomUUID();
        doc.rows[id] = { user_id: id, name, email, role, active: true, pw: null, pw_version: 0, setup: { hash: h, exp: Date.now() + SETUP_MS }, created_at: new Date().toISOString() };
        return doc;
      });
      return res(200, { token });
    }
    const id = typeof b.user_id === "string" ? b.user_id : "";
    if (b.action === "link") {
      const token = randomToken(), h = await sha256(token);
      await mutate(store, "meta/coaches", doc => {
        const c = doc.rows[id]; if (!c || !c.active) throw new HttpError(404, "Coach not found or not active.");
        c.setup = { hash: h, exp: Date.now() + SETUP_MS }; return doc;
      });
      return res(200, { token });
    }
    if (b.action === "deactivate" || b.action === "reactivate") {
      await mutate(store, "meta/coaches", doc => {
        const c = doc.rows[id]; if (!c) throw new HttpError(404, "Coach not found.");
        if (b.action === "deactivate") {
          if (id === me.user_id) throw bad("You can't deactivate yourself.");
          if (c.role === "admin" && c.active && Object.values(doc.rows).filter(x => x.role === "admin" && x.active).length < 2) throw bad("There must be at least one active admin.");
          c.active = false; c.setup = null;
        } else c.active = true;
        return doc;
      });
      return res(200, { ok: true });
    }
    throw bad("Invalid request.");
  }
  throw new HttpError(404, "Not found.");
}
