import { JRS, GRL, TRAIN, RATE, QUICK, LV } from "./content.js";
import { D, ME, S, hooks, toast, isAdmin, isJr, player, lessonsOf, groupIds, lessonTitle, planFor, curModule, prevLesson, nextSession, lastFb } from "./state.js";
import { $, esc, fmt, today, uid, byDateDesc } from "./util.js";
import * as store from "./store.js";

const done = async (fn, ok) => { try { await fn(); if (ok) toast(ok); return true; } catch (e) { toast(e.message); return false; } };

// ───────── Copy for parent / player
export function lessonText(l, pid) {
  const p = D.players.find(x => x.id === pid) || {}, f = l.fb?.[pid] || {};
  return ["PADEL BEAST · Lesson report", `${p.name} · ${fmt(l.date)} · Coach ${l.coach || ""}`, lessonTitle(l) ? "Lesson: " + lessonTitle(l) : "", l.objectives ? "Objectives: " + l.objectives : "", l.summary ? "\nWhat we did: " + l.summary : "", (l.exercises || []).length ? "Exercises: " + l.exercises.map(x => x.name).join(", ") : "", "\nAttendance: " + (f.present || "Present"), f.rating ? `Rating: ${f.rating}/5 (${RATE[f.rating]})` : "", f.comment ? "Feedback: " + f.comment : "", f.improve ? "To improve: " + f.improve : "", f.next ? "Next lesson: " + f.next : ""].filter(Boolean).join("\n");
}
export async function copyOut(t, anchor) {
  try { await navigator.clipboard.writeText(t); toast("Copied. Paste it into WhatsApp or email."); }
  catch { const ta = document.createElement("textarea"); ta.value = t; ta.rows = 10; ta.style.marginTop = "8px"; anchor.after(ta); ta.select(); toast("Select all and copy the text below"); }
}

// ───────── Lesson list
export function viewLessons() {
  if (S.lf) return lessonForm();
  const fg = S.lg || "", fc = S.lc || "";
  const coaches = [...new Set(D.lessons.map(l => l.coach).filter(Boolean))].sort();
  const list = D.lessons.filter(l => (!fg || l.group === fg) && (!fc || l.coach === fc)).sort(byDateDesc);
  $("#detail").innerHTML = `<div class="card"><div class="line"><div><h2 style="font-size:26px">Lesson reports</h2><p class="note" style="margin:6px 0 0">One report per lesson: what was done, plus a personal report for every player in it. Coaches and players can change from week to week.</p></div><button class="btn pri" data-act="newLesson">+ New lesson report</button></div>
  <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><select id="lg" style="width:auto" aria-label="Filter by group"><option value="">All groups</option>${Object.entries(GRL).map(([k, v]) => `<option value="${k}"${fg === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select><select id="lc" style="width:auto" aria-label="Filter by coach"><option value="">All coaches</option>${coaches.map(c => `<option${c === fc ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></div></div>
  <div style="margin-top:16px">${list.length ? list.map(lessonCard).join("") : '<div class="card"><p class="empty">No lesson reports yet. After each lesson, the coach who ran it writes one.</p></div>'}</div>`;
}
function lessonCard(l) {
  const ps = (l.players || []).map(id => [id, D.players.find(p => p.id === id), l.fb?.[id] || {}]);
  const present = ps.filter(x => x[2].present !== "Absent").length;
  return `<article class="rep"><div class="line"><h4>${fmt(l.date)} · ${esc(GRL[l.group] || "Lesson")}${l.sample ? ' <span class="tag" style="background:var(--pink);color:var(--navy)">Sample</span>' : ""}</h4><span class="note">Coach ${esc(l.coach || "—")} · ${present}/${ps.length} present</span></div>
  ${lessonTitle(l) ? `<p><b>${esc(lessonTitle(l))}</b></p>` : ""}${l.objectives ? `<p><span class="k">Objectives</span>${esc(l.objectives)}</p>` : ""}${l.summary ? `<p><span class="k">What we did</span>${esc(l.summary)}</p>` : ""}
  ${(l.exercises || []).length ? `<p><span class="k">Exercises</span>${l.exercises.map(x => `<span class="tag">${esc(x.name)}${x.min ? " · " + esc(x.min) + " min" : ""}${x.obj ? " · " + esc(x.obj) : ""}</span>`).join("")}</p>` : ""}
  <details><summary style="cursor:pointer;font-weight:600;padding:8px 0;min-height:44px">Personal reports (${ps.length})</summary>${ps.map(([id, p, f]) => `<div class="obj" style="grid-template-columns:minmax(0,1fr) auto"><span><b>${esc(p?.name || "Removed player")}</b> <span class="tag">${esc(f.present || "Present")}</span>${f.rating ? `<span class="tag">${esc(f.rating)}/5 ${esc(RATE[f.rating] || "")}</span>` : ""}<small>${esc([f.comment, f.improve ? "To improve: " + f.improve : "", f.next ? "Next: " + f.next : ""].filter(Boolean).join(" · "))}</small></span>${p ? `<button class="btn sm" data-act="copyL" data-l="${esc(l.id)}" data-p="${esc(id)}">Copy for ${isJr(p) ? "parent" : "player"}</button>` : ""}</div>`).join("")}</details>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" data-act="editL" data-id="${esc(l.id)}">Edit</button>${!isAdmin() ? "" : S.confirm === "l" + l.id ? `<span class="confirm">Delete this lesson report?<button class="btn sm danger" data-act="delL" data-id="${esc(l.id)}">Delete</button><button class="btn sm" data-act="nocf">Keep</button></span>` : `<button class="btn sm danger" data-act="cf" data-c="l${esc(l.id)}">Delete</button>`}</div></article>`;
}

// ───────── Lesson form
function newLF(l) { S.lf = { focusInit: null, id: l?.id || null, group: l?.group || "", players: new Set(l?.players || []), fb: JSON.parse(JSON.stringify(l?.fb || {})) }; }
const trOpts = (mod, sel) => mod === "" || mod == null || !TRAIN[mod] ? '<option value="">—</option>' : '<option value="">—</option>' + TRAIN[mod].map((t, i) => `<option value="T${i + 1}"${sel === "T" + (i + 1) ? " selected" : ""}>T${i + 1} · ${esc(t)}</option>`).join("");

function pickHtml() {
  const by = { A: [], B: [], C: [], o: [] };
  D.players.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).forEach(p => (isJr(p) && by[p.group] ? by[p.group] : by.o).push(p));
  return [["A", "Group A"], ["B", "Group B"], ["C", "Group C"], ["o", "Other players"]].filter(([k]) => by[k].length).map(([k, n]) => `<div style="margin:6px 0"><span class="note">${n}</span><div class="chips" style="margin-top:4px">${by[k].map(p => `<button type="button" class="chip" data-act="lp" data-id="${esc(p.id)}" aria-pressed="${S.lf.players.has(p.id)}">${esc(p.name)}</button>`).join("")}</div></div>`).join("");
}
function fbHtml() {
  const ids = [...S.lf.players].filter(id => D.players.some(x => x.id === id));
  if (!ids.length) return '<p class="empty">Tap the players who were in this lesson.</p>';
  return ids.map(id => {
    const p = D.players.find(x => x.id === id), f = S.lf.fb[id] || {}, lf = lastFb(id);
    return `<div class="fb rep" data-pid="${esc(id)}"><div class="line"><h4>${esc(p.name)} <span class="tag">L${esc(p.level)}${p.group ? " · Group " + esc(p.group) : ""}</span></h4><select data-f="present" style="width:auto" aria-label="Attendance for ${esc(p.name)}">${["Present", "Late", "Absent"].map(x => `<option${(f.present || "Present") === x ? " selected" : ""}>${x}</option>`).join("")}</select></div>
    ${lf && (lf.f.next || lf.f.improve) ? `<p class="pnote">Last time (${fmt(lf.l.date)}): work on <b>${esc(lf.f.next || lf.f.improve)}</b></p>` : ""}<div class="rate" role="radiogroup" aria-label="Rating for ${esc(p.name)}">${[1, 2, 3, 4, 5].map(n => `<label class="rb"><input type="radio" name="r_${esc(id)}" value="${n}"${+f.rating === n ? " checked" : ""}><span>${n}</span></label>`).join("")}<span class="note">${f.rating ? esc(RATE[f.rating]) : "Rating 1–5"}</span></div>
    <div class="form" style="margin-top:10px"><div class="full chips qc">${QUICK.map(q => `<button type="button" class="chip" data-act="qc" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div><label class="full">Personal feedback<textarea data-f="comment" placeholder="What ${esc(p.name)} did well today and what to work on">${esc(f.comment || "")}</textarea></label><label>Area to improve<input data-f="improve" value="${esc(f.improve || "")}" list="ar_${esc(id)}"><datalist id="ar_${esc(id)}">${(LV[p.level] || LV[1]).areas.map(a => `<option value="${esc(a)}">`).join("")}</datalist></label><label>Next lesson focus<input data-f="next" value="${esc(f.next || "")}">${lf?.f.next ? `<button type="button" class="chip" style="margin-top:6px" data-act="sameNext" data-v="${esc(lf.f.next)}">Same as last time: ${esc(lf.f.next)}</button>` : ""}</label></div></div>`;
  }).join("");
}
function syncFb() {
  document.querySelectorAll("#fbwrap .fb").forEach(c => {
    const f = {}; c.querySelectorAll("[data-f]").forEach(i => (f[i.dataset.f] = i.value.trim()));
    const r = c.querySelector("input[type=radio]:checked"); f.rating = r ? +r.value : 0; S.lf.fb[c.dataset.pid] = f;
  });
}
function handoverHtml() {
  const ids = [...S.lf.players].filter(id => D.players.some(x => x.id === id)), prev = prevLesson(S.lf.group, ids);
  if (!ids.length && !prev) return "";
  const rows = ids.map(id => { const p = D.players.find(x => x.id === id), lf = lastFb(id), f = lf?.f || {}; return `<tr><td><b>${esc(p.name)}</b></td><td>${lf ? `${esc(f.present || "Present")}${f.rating ? " · " + esc(f.rating) + "/5" : ""} <span class="note">(${fmt(lf.l.date)}, ${esc(lf.l.coach || "—")})</span>` : '<span class="note">First lesson</span>'}</td><td>${esc(f.next || f.improve || "—")}</td><td>${p.health ? `<b style="color:var(--bad)">${esc(p.health)}</b>` : "—"}</td></tr>`; }).join("");
  return `<div class="hand" id="hand"><h4>Hand-over from the last lesson</h4>${prev ? `<p style="margin:0 0 6px"><b>${fmt(prev.date)} · Coach ${esc(prev.coach || "—")}</b>${lessonTitle(prev) ? " · " + esc(lessonTitle(prev)) : ""}</p>${prev.summary ? `<p style="margin:0 0 8px">${esc(prev.summary)}</p>` : ""}` : '<p style="margin:0 0 8px">No earlier lesson for this group yet.</p>'}${rows ? `<div class="scroll"><table class="stack"><thead><tr><th>Player</th><th>Last time</th><th>Work on today</th><th>Health</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}</div>`;
}
const refreshHand = () => { const el = $("#handwrap"); if (el) el.innerHTML = handoverHtml(); };

function applyPlan(force) {
  const m = $("#lmod")?.value, t = $("#ltr")?.value, note = $("#planNote"); if (!note) return;
  if (m === "" || !t) { note.textContent = "Pick a module and training to load its plan."; return; }
  const pl = planFor(m, t);
  if (!pl) { note.textContent = 'No saved plan for this session yet. Fill in the exercises and tick "Save as the plan".'; return; }
  const ins = [0, 1, 2, 3, 4].map(i => ["n", "m", "o"].map(k => document.querySelector(`[name=ex_${k}${i}]`)));
  const empty = ins.every(r => !r[0].value.trim());
  if (!empty && !force) { note.innerHTML = 'A plan exists for this session. <button type="button" class="btn sm" data-act="loadPlan">Replace with the plan</button>'; return; }
  ins.forEach((r, i) => { const x = pl.exercises?.[i] || {}; r[0].value = x.name || ""; r[1].value = x.min || ""; r[2].value = x.obj || ""; });
  const o = $("[name=objectives]"); if (o && (force || !o.value.trim())) o.value = pl.objectives || "";
  note.textContent = `Plan loaded${pl.updatedBy ? " (last updated by " + pl.updatedBy + ")" : ""}. Change anything that was different today.`;
}

function coachField(l) {
  if (!isAdmin()) return `<label>Coach who ran the lesson<input value="${esc(l?.coach || ME.name)}" readonly aria-readonly="true"></label>`;
  const active = D.coaches.filter(c => c.active), cur = l ? (l.coachId || "name:" + l.coach) : ME.user_id;
  const opts = active.map(c => `<option value="${esc(c.user_id)}"${cur === c.user_id ? " selected" : ""}>${esc(c.name)}</option>`);
  if (l && !active.some(c => c.user_id === l.coachId)) opts.push(`<option value="${esc(l.coachId || "name:" + l.coach)}" selected>${esc(l.coach)}</option>`);
  return `<label>Coach who ran the lesson<select name="coach">${opts.join("")}</select></label>`;
}

export function lessonForm() {
  const l = S.lf.id ? D.lessons.find(x => x.id === S.lf.id) : null;
  const g = S.lf.group || "A", nx = l ? null : nextSession(prevLesson(g, [...S.lf.players]));
  const mod = l ? (l.module ?? "") : (nx ? nx.m : curModule()), trSel = l ? l.training : (nx ? nx.t : "");
  if (!l && S.lf.focusInit == null && nx) S.lf.focusInit = TRAIN[nx.m]?.[+nx.t.slice(1) - 1] || "";
  const ex = [...(l?.exercises || [])]; while (ex.length < 5) ex.push({});
  $("#detail").innerHTML = `<form class="card" id="lform"><div class="line"><h3>${l ? "Edit lesson report" : "New lesson report"}</h3><button type="button" class="btn sm" data-act="closeL">Cancel</button></div>
  <div id="handwrap" style="margin-bottom:16px">${handoverHtml()}</div>
  <div class="form">
  <label>Date<input type="date" name="date" value="${esc(l?.date || today())}" required></label>
  ${coachField(l)}
  <label>Group<select name="group" id="lgroup">${Object.entries(GRL).map(([k, v]) => `<option value="${k}"${g === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
  <label>Junior module<select name="module" id="lmod"><option value="">Not a junior module</option>${JRS.map((n, i) => `<option value="${i}"${String(mod) === String(i) ? " selected" : ""}>M${i + 1} · ${esc(n)}</option>`).join("")}</select></label>
  <label>Training session<select name="training" id="ltr">${trOpts(mod, trSel)}</select></label>
  <label>Lesson focus<input name="focus" id="lfocus" value="${esc(l?.focus || S.lf.focusInit || "")}" placeholder="e.g. Forehand volley basics"></label>
  <label class="full">Session objectives<input name="objectives" value="${esc(l?.objectives || "")}" placeholder="What the players should be able to do by the end"></label>
  <label class="full">What we did in the lesson<textarea name="summary" required placeholder="Warm-up, drills and games, what the group worked on and how it went">${esc(l?.summary || "")}</textarea></label>
  <div class="full"><label>Exercises</label><p class="pnote" id="planNote"></p>${ex.slice(0, 5).map((x, i) => `<div class="exr"><input name="ex_n${i}" value="${esc(x.name || "")}" placeholder="Exercise ${i + 1}" aria-label="Exercise ${i + 1}"><input name="ex_m${i}" value="${esc(x.min || "")}" inputmode="numeric" placeholder="Min" aria-label="Minutes"><input name="ex_o${i}" value="${esc(x.obj || "")}" placeholder="Objective" aria-label="Objective"></div>`).join("")}<label class="ms" style="border:0;margin-top:6px"><input type="checkbox" name="savePlan"><span>Save these exercises as the plan for this session, so the next coach starts from them</span></label></div>
  <div class="full"><label>Players in this lesson: tap to add or remove</label><div id="lpick">${pickHtml()}</div></div>
  </div>
  <div class="line" style="margin:22px 0 10px"><h3>Personal reports</h3><button type="button" class="btn sm ball" data-act="allPresent">Everyone present · 3/5</button></div><div id="fbwrap">${fbHtml()}</div>
  <div class="line" style="margin-top:16px"><span class="note">1 needs a lot of work · 2 developing · 3 good · 4 very good · 5 excellent</span><button class="btn pri">${l ? "Update lesson report" : "Save lesson report"}</button></div></form>`;
  applyPlan(false);
}

export function startLesson(p) {
  newLF(null);
  const g = p ? (isJr(p) && p.group ? p.group : "adult") : "A";
  S.lf.group = g; S.lf.players = new Set(p && !(isJr(p) && p.group) ? [p.id] : groupIds(g));
  S.view = "lessons"; S.confirm = null; $("#detail").innerHTML = ""; hooks.go("lessons"); scrollTo(0, 0);
}

// ───────── Event handlers
export async function onClick(a, b) {
  if (a === "newLesson") { startLesson(S.view === "players" ? player() : null); return true; }
  if (a === "editL") { newLF(D.lessons.find(x => x.id === b.dataset.id)); S.view = "lessons"; $("#detail").innerHTML = ""; hooks.go("lessons"); scrollTo(0, 0); return true; }
  if (a === "closeL") { S.lf = null; hooks.render(); return true; }
  if (a === "lp") { syncFb(); const id = b.dataset.id; S.lf.players.has(id) ? S.lf.players.delete(id) : S.lf.players.add(id); b.setAttribute("aria-pressed", S.lf.players.has(id)); $("#fbwrap").innerHTML = fbHtml(); refreshHand(); return true; }
  if (a === "loadPlan") { applyPlan(true); return true; }
  if (a === "allPresent") { syncFb(); [...S.lf.players].forEach(id => { const f = S.lf.fb[id] || {}; f.present = f.present || "Present"; if (f.present === "Absent") f.present = "Present"; if (!f.rating) f.rating = 3; S.lf.fb[id] = f; }); $("#fbwrap").innerHTML = fbHtml(); toast("Everyone marked present, 3/5. Change the exceptions."); return true; }
  if (a === "qc") { const ta = b.closest(".fb").querySelector("[data-f=comment]"), q = b.dataset.q; ta.value = ta.value.trim() ? ta.value.trim().replace(/[.]?$/, ". ") + q : q; b.setAttribute("aria-pressed", "true"); return true; }
  if (a === "sameNext") { b.closest("label").querySelector("[data-f=next]").value = b.dataset.v; return true; }
  if (a === "delL") { S.confirm = null; await done(() => store.deleteLesson(b.dataset.id), "Lesson report deleted"); hooks.render(); return true; }
  if (a === "copyL") { const l = D.lessons.find(x => x.id === b.dataset.l); if (l) copyOut(lessonText(l, b.dataset.p), b); return true; }
  return false;
}

export function onChange(t) {
  if (t.id === "lg" || t.id === "lc") { S[t.id] = t.value; viewLessons(); return true; }
  if (t.id === "lgroup") {
    syncFb(); S.lf.group = t.value;
    if (["A", "B", "C"].includes(t.value)) { S.lf.players = new Set(groupIds(t.value)); $("#lpick").innerHTML = pickHtml(); $("#fbwrap").innerHTML = fbHtml(); }
    refreshHand();
    if (!S.lf.id) { const nx = nextSession(prevLesson(t.value, [...S.lf.players])); if (nx) { $("#lmod").value = String(nx.m); $("#ltr").innerHTML = trOpts(nx.m, nx.t); $("#lfocus").value = TRAIN[nx.m][+nx.t.slice(1) - 1]; applyPlan(false); } }
    return true;
  }
  if (t.id === "lmod") { $("#ltr").innerHTML = trOpts(t.value, ""); applyPlan(false); return true; }
  if (t.id === "ltr") { const m = $("#lmod").value; if (t.value && m !== "") $("#lfocus").value = TRAIN[+m][+t.value.slice(1) - 1]; applyPlan(false); return true; }
  if (t.type === "radio" && t.closest(".rate")) { t.closest(".rate").querySelector(".note").textContent = RATE[+t.value]; return true; }
  return false;
}

export async function onSubmit(f, e) {
  if (f.id !== "lform") return false;
  e.preventDefault(); syncFb();
  const fd = new FormData(f), ids = [...S.lf.players].filter(id => D.players.some(x => x.id === id));
  if (!ids.length) { toast("Pick at least one player"); return true; }
  const fb = {}; ids.forEach(id => (fb[id] = S.lf.fb[id] || { present: "Present", rating: 0, comment: "", improve: "", next: "" }));
  const ex = [0, 1, 2, 3, 4].map(i => ({ name: String(fd.get("ex_n" + i) || "").trim(), min: String(fd.get("ex_m" + i) || "").trim(), obj: String(fd.get("ex_o" + i) || "").trim() })).filter(x => x.name);
  const old = S.lf.id ? D.lessons.find(x => x.id === S.lf.id) : null;
  let coachId = old ? old.coachId : ME.user_id, coach = old ? old.coach : ME.name;
  if (isAdmin()) { const v = String(fd.get("coach") || ""); const c = D.coaches.find(x => x.user_id === v); if (c) { coachId = c.user_id; coach = c.name; } }
  const mod = fd.get("module"), rec = { id: S.lf.id || uid(), date: fd.get("date"), coachId, coach, group: fd.get("group"), module: mod === "" ? "" : +mod, training: fd.get("training") || "", focus: String(fd.get("focus") || "").trim(), objectives: String(fd.get("objectives") || "").trim(), summary: String(fd.get("summary") || "").trim(), exercises: ex };
  const plan = fd.get("savePlan") && rec.module !== "" && rec.training ? { id: "M" + (rec.module + 1) + rec.training, module: rec.module, training: rec.training, objectives: rec.objectives, exercises: ex } : null;
  if (await done(() => store.saveLesson(rec, fb, plan), old ? "Lesson report updated" : "Lesson report saved")) { S.lf = null; hooks.render(); scrollTo(0, 0); }
  return true;
}
