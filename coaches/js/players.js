import { LV, JR, JRS, GR, PIL, MET, KINDS, ST, RES, RATE, PERIOD } from "./content.js";
import { D, ME, S, hooks, toast, isAdmin, isJr, player, repsOf, objsOf, avg, msList, msPct, pass, lessonsOf, lessonTitle } from "./state.js";
import { $, esc, fmt, today, uid, setSelect } from "./util.js";
import * as store from "./store.js";
import { copyOut, lessonText } from "./lessons.js";

const done = async (fn, ok) => { try { await fn(); if (ok) toast(ok); hooks.render(); return true; } catch (e) { toast(e.message); return false; } };

// ───────── Roster (left rail / phone dropdown)
export function renderRoster() {
  const q = $("#search").value.trim().toLowerCase(), fl = $("#fLevel").value, fc = $("#fCoach").value, fg = $("#fGroup").value;
  const coaches = [...new Set(D.players.map(p => p.coach).filter(Boolean))].sort();
  const cs = $("#fCoach"), cur = cs.value;
  cs.innerHTML = '<option value="">All coaches</option>' + coaches.map(c => `<option${c === cur ? " selected" : ""}>${esc(c)}</option>`).join("");
  const list = D.players.filter(p => (!q || (p.name || "").toLowerCase().includes(q)) && (!fl || String(p.level) === fl) && (!fc || p.coach === fc) && (!fg || (fg === "jr" ? isJr(p) : p.group === fg)))
    .sort((a, b) => (a.group || "Z").localeCompare(b.group || "Z") || (a.name || "").localeCompare(b.name || ""));
  $("#roster").innerHTML = list.length ? list.map(p => {
    const r = repsOf(p.id).at(-1), lz = lessonsOf(p.id)[0];
    return `<button class="pl" data-act="pick" data-id="${esc(p.id)}" aria-current="${p.id === S.sel}"><span class="lv">L${esc(p.level)}</span><span><b>${esc(p.name)}</b><small>${p.group ? esc("Group " + p.group) + " · " : ""}${esc(p.coach || (isJr(p) ? "Rotating coaches" : "No coach"))} · ${lz ? "last lesson " + fmt(lz.date) : r ? "last report " + fmt(r.date) : "no lessons yet"}</small></span></button>`;
  }).join("") : '<p class="empty">No players match.</p>';
  $("#mobSel").innerHTML = '<option value="">Select a player…</option>' + D.players.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(p => `<option value="${esc(p.id)}"${p.id === S.sel ? " selected" : ""}>L${esc(p.level)} · ${esc(p.name)}</option>`).join("");
}

function ladder(p) {
  if (isJr(p)) {
    const m = msPct(p), cur = JR.findIndex((_, i) => !p.milestones?.["jr_" + i]);
    return `<div class="ladder" style="grid-template-columns:repeat(6,minmax(0,1fr))" role="img" aria-label="Junior programme: ${m.done} of 6 modules completed">${JRS.map((n, i) => { const dn = !!p.milestones?.["jr_" + i], here = i === cur; return `<div class="rung ${dn ? "done" : here ? "here" : ""}"><b>M${i + 1}</b><small>${esc(n)}</small>${here ? '<span class="dot"></span>' : ""}${dn ? '<span class="fill" style="width:100%"></span>' : ""}</div>`; }).join("")}</div>`;
  }
  const m = msPct(p), names = ["L1", "L2", "L3", "L4", "Comp"], sub = ["Beginner", "Intermediate", "Upper-Int.", "Advanced", "Competition"];
  return `<div class="ladder" role="img" aria-label="Level ${esc(p.level)}, ${m.pct}% of milestones to ${esc((LV[p.level] || LV[1]).next)}">${names.map((n, i) => { const lv = i + 1, cls = lv < p.level ? "done" : lv == p.level ? "here" : "", here = lv == p.level; return `<div class="rung ${cls}"><b>${n}</b><small>${sub[i]}${here ? ` · ${m.pct}%` : ""}</small>${here ? `<span class="dot"></span><span class="fill" style="width:${m.pct}%"></span>` : ""}${lv < p.level ? '<span class="fill" style="width:100%"></span>' : ""}</div>`; }).join("")}</div>`;
}

export function renderDetail() {
  const p = player(), el = $("#detail");
  if (!p) { el.innerHTML = `<div class="card"><h2 style="font-size:36px">Pick a player</h2><p class="empty">${D.players.length ? "Choose a player from the list to see their progress, write a report or set objectives." : "No players yet. Add your first player to start writing reports."}</p><button class="btn pri" data-act="add">+ Add player</button></div>`; return; }
  const L = LV[p.level] || LV[1], m = msPct(p);
  el.innerHTML = `<div class="card"><div class="phead"><div class="big">L${esc(p.level)}<small>${esc(L.name.split(" ").slice(1).join(" "))}</small></div><div><h2>${esc(p.name)}</h2><div class="meta"><span>${esc(p.program || "")}</span>${p.group ? `<span><b>${esc(GR[p.group] || "Group " + p.group)}</b></span>` : ""}<span>${p.coach ? "Coach " + esc(p.coach) : "Rotating coaches"}</span><span>${esc(p.side || "")}</span><span>${p.hand ? esc(p.hand) + "-handed" : ""}</span>${p.start ? `<span>Since ${fmt(p.start)}</span>` : ""}</div>${p.goal ? `<div class="meta"><span>Goal: ${esc(p.goal)}</span></div>` : ""}${isJr(p) && (p.parent || p.phone || p.dob || p.school) ? `<div class="meta">${p.dob ? `<span>Born ${fmt(p.dob)}</span>` : ""}${p.school ? `<span>${esc(p.school)}</span>` : ""}${p.parent || p.phone ? `<span>Parent: ${esc([p.parent, p.phone].filter(Boolean).join(" · "))}</span>` : ""}${p.kit ? `<span>Kit ${esc(p.kit)}</span>` : ""}</div>` : ""}${p.health ? `<div class="meta"><span class="no" style="font-weight:500">Health: ${esc(p.health)}</span></div>` : ""}${p.sample ? '<div class="note" style="margin-top:4px">Sample player to show how reports look.</div>' : ""}</div><div class="acts"><button class="btn sm" data-act="editp">Edit</button>${p.level < 4 ? `<button class="btn sm" data-act="promote">Passed test → L${p.level + 1}</button>` : ""}</div></div>${ladder(p)}<p class="note" style="margin:8px 0 0">${isJr(p) ? `${m.done} of 6 modules completed · Junior Sponsorship Programme${PERIOD ? ", " + esc(PERIOD) : ""} · Padel level L${esc(p.level)}` : `${m.done} of ${m.total} milestones toward ${esc(L.next)} · Level focus: ${esc(L.focus)}`}</p></div>
  <div class="tabs" role="tablist">${[["progress", "Progress"], ["lessons", "Lessons (" + lessonsOf(p.id).length + ")"], ["new", S.edit ? "Edit progress report" : "Progress report"], ["reports", "Progress reports (" + repsOf(p.id).length + ")"], ["objectives", "Objectives & tournaments"]].map(([k, t]) => `<button class="tab" role="tab" data-act="tab" data-tab="${k}" aria-selected="${S.tab === k}">${t}</button>`).join("")}</div>
  <div id="pane"></div>`;
  ({ progress: paneProgress, lessons: paneLessons, new: paneNew, reports: paneReports, objectives: paneObj })[S.tab](p);
}

function paneProgress(p) {
  const reps = repsOf(p.id), last = reps.at(-1), prev = reps.at(-2), scored = reps.filter(r => avg(r) != null), lastS = scored.at(-1), prevS = scored.at(-2), L = LV[p.level] || LV[1], objs = objsOf(p.id);
  const lastM = [...reps].reverse().find(r => r.match && Object.values(r.match).some(v => v !== "" && v != null));
  const pil = lastS ? PIL.map(([k, n]) => { const v = +lastS.pillars?.[k] || 0, d = prevS ? v - (+prevS.pillars?.[k] || 0) : 0; return `<div class="row"><span>${esc(n)}</span><span class="bar"><i style="width:${v * 10}%"></i></span><span class="num"><b>${v || "—"}</b></span><span class="num ${d > 0 ? "up" : d < 0 ? "down" : "flat"}">${prevS ? (d > 0 ? "+" + d : d === 0 ? "±0" : d) : ""}</span></div>`; }).join("") : `<p class="empty">${reps.length ? "No pillar scores yet. Add them in a progress report." : "No reports yet. Write the first one to see scores here."}</p>`;
  const met = MET.map(([k, n, dir]) => { const v = lastM?.match?.[k], t = L.t[k], ok = pass(k, v, t); return `<tr><td>${esc(n)}</td><td class="num">${v !== "" && v != null ? esc(v) : "—"}</td><td class="num">${t != null ? (dir === "low" ? "≤ " : "≥ ") + t : "—"}</td><td>${ok == null ? "" : ok ? '<span class="ok">On target</span>' : '<span class="no">Not yet</span>'}</td></tr>`; }).join("");
  const open = objs.filter(o => o.kind !== "Tournament" && !["Achieved", "Missed"].includes(o.status));
  const tours = objs.filter(o => o.kind === "Tournament").sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const next = tours.find(t => t.status !== "Played" && t.status !== "Withdrew");
  const lsn = lessonsOf(p.id), pres = lsn.filter(l => (l.fb?.[p.id]?.present || "Present") !== "Absent" ? true : false), rated = pres.map(l => +l.fb?.[p.id]?.rating).filter(n => n > 0), lastL = lsn[0];
  $("#pane").innerHTML = `<div class="grid2">
  <div class="card"><h3>Lessons</h3><p class="trophy">${lsn.length ? Math.round(pres.length / lsn.length * 100) + "% attendance" : "No lessons yet"}${rated.length ? " · " + (rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1) + "/5 average" : ""}</p><p class="note">${pres.length} of ${lsn.length} lessons attended</p>${lastL ? `<p>Last lesson <b>${fmt(lastL.date)}</b> with ${esc(lastL.coach || "—")}${lessonTitle(lastL) ? " · " + esc(lessonTitle(lastL)) : ""}</p>${lastL.fb?.[p.id]?.comment ? `<p>${esc(lastL.fb[p.id].comment)}</p>` : ""}${lastL.fb?.[p.id]?.next ? `<p><span class="note">Next lesson focus</span><br>${esc(lastL.fb[p.id].next)}</p>` : ""}` : ""}<button class="btn sm" data-act="newLesson">+ Lesson report</button></div>
  <div class="card"><h3>Pillar scores</h3>${pil}${lastS ? `<p class="note">Latest: ${fmt(lastS.date)} by ${esc(lastS.coach || "—")}${prevS ? " · change vs " + fmt(prevS.date) : ""}</p>` : ""}</div>
  <div class="card"><div class="line"><h3>Progress over time</h3><select id="metric" style="width:auto">${[["pillars", "Pillar average"], ["rating", "Lesson rating (1–5)"], ...MET.map(m => [m[0], m[1]])].map(([k, n]) => `<option value="${k}"${S.metric === k ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></div><div class="fig" id="fig"><svg id="chart"></svg></div></div>
  <div class="card"><h3>GlassWall data vs ${esc(L.next)} target</h3><div class="scroll"><table><thead><tr><th>Metric</th><th class="num">Latest</th><th class="num">Target</th><th></th></tr></thead><tbody>${met}</tbody></table></div><p class="note">${lastM ? "From report of " + fmt(lastM.date) : "Add match data to a report to compare with the level targets."}</p></div>
  <div class="card"><h3>Areas to improve</h3>${last?.improve?.length ? `<div>${last.improve.map(a => `<span class="tag">${esc(a)}</span>`).join("")}</div>` : '<p class="empty">None recorded yet.</p>'}${last?.nextFocus ? `<p><span class="note">Next focus</span><br>${esc(last.nextFocus)}</p>` : ""}${last?.homework ? `<p><span class="note">Homework</span><br>${esc(last.homework)}</p>` : ""}</div>
  <div class="card"><h3>${isJr(p) ? "Junior programme modules" : "Milestones to " + esc(L.next)}</h3>${msList(p).map(([t, k]) => { const on = !!p.milestones?.[k]; return `<label class="ms${on ? " on" : ""}"><input type="checkbox" data-ms="${esc(k)}"${on ? " checked" : ""}><span>${esc(t)}</span></label>`; }).join("")}<p class="note">${isJr(p) ? "Tick a module when the player has met its key objectives (end-of-month review)." : "Pass mark 70/100 with half the points in each part (Level Books)."}</p></div>
  <div class="card"><h3>Objectives</h3>${open.length ? open.map(o => `<div class="obj" style="grid-template-columns:minmax(0,1fr) auto"><span>${esc(o.title)}<small>${esc(o.kind)}${o.due ? " · due " + fmt(o.due) : ""}${o.target ? " · " + esc(o.target) : ""}</small></span><span class="tag">${esc(o.status)}</span></div>`).join("") : '<p class="empty">No open objectives.</p>'}
  <h3 style="margin-top:18px">Tournaments</h3>${tours.length ? `<p class="trophy">${tours.filter(t => t.status === "Played").length} played · ${tours.filter(t => ["Planned", "Registered"].includes(t.status)).length} coming up</p>${next ? `<p>Next: <b>${esc(next.title)}</b> · ${fmt(next.date)}${next.category ? " · " + esc(next.category) : ""}</p>` : ""}` : '<p class="empty">No tournaments yet. Add one under Objectives & tournaments.</p>'}</div>
  </div>`;
  drawChart(p);
}

function drawChart(p) {
  const s = $("#chart"); if (!s) return;
  const reps = repsOf(p.id), k = S.metric, L = LV[p.level] || LV[1];
  const pts = k === "rating" ? lessonsOf(p.id).slice().reverse().map(l => ({ d: l.date, v: +l.fb?.[p.id]?.rating || null })).filter(x => x.v)
    : reps.map(r => ({ d: r.date, v: k === "pillars" ? avg(r) : (r.match?.[k] === "" || r.match?.[k] == null ? null : +r.match[k]) })).filter(x => x.v != null && !isNaN(x.v));
  const draw = () => {
    const W = s.clientWidth, H = s.clientHeight; if (!W) return;
    if (pts.length < 1) { s.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="currentColor" opacity=".6" font-size="14">No data yet for this measure</text>`; return; }
    const tgt = k === "pillars" || k === "rating" ? null : L.t[k], vals = pts.map(x => x.v).concat(tgt != null ? [tgt] : []);
    const fix = k === "pillars" ? 10 : k === "rating" ? 5 : 0; let lo = fix ? 0 : Math.min(...vals), hi = fix || Math.max(...vals); const pad = (hi - lo) * .15 || 1; if (!fix) { lo = Math.max(0, lo - pad); hi = hi + pad; }
    const l = 36, r = 14, t = 14, b = 28, x = i => l + (pts.length === 1 ? (W - l - r) / 2 : i * (W - l - r) / (pts.length - 1)), y = v => t + (H - t - b) * (1 - (v - lo) / (hi - lo)), narrow = W < 420;
    let g = [lo, (lo + hi) / 2, hi].map(v => `<line x1="${l}" x2="${W - r}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".12"/><text x="${l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="currentColor" opacity=".6">${+v.toFixed(1)}</text>`).join("");
    if (tgt != null) g += `<line x1="${l}" x2="${W - r}" y1="${y(tgt)}" y2="${y(tgt)}" stroke="#1F5F57" stroke-width="2" stroke-dasharray="6 5"/><text x="${W - r}" y="${y(tgt) - 6}" text-anchor="end" font-size="12" fill="currentColor" font-weight="600">${esc(L.next)} target ${tgt}</text>`;
    g += `<polyline fill="none" stroke="#E25743" stroke-width="3" stroke-linejoin="round" points="${pts.map((q, i) => x(i) + "," + y(q.v)).join(" ")}"/>`;
    g += pts.map((q, i) => `<circle cx="${x(i)}" cy="${y(q.v)}" r="5" fill="#FFC82C" stroke="#0A163A" stroke-width="2"><title>${esc(fmt(q.d))}: ${q.v.toFixed(1)}</title></circle>`).join("");
    const step = Math.ceil(pts.length / (narrow ? 3 : 6));
    g += pts.map((q, i) => i % step && i !== pts.length - 1 ? "" : `<text x="${x(i)}" y="${H - 8}" text-anchor="${pts.length > 1 && i === pts.length - 1 ? "end" : i === 0 && pts.length > 1 ? "start" : "middle"}" font-size="12" fill="currentColor" opacity=".6">${esc(new Date(q.d + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }))}</text>`).join("");
    s.innerHTML = g;
  };
  if (S.ro) S.ro.disconnect(); S.ro = new ResizeObserver(draw); S.ro.observe(s); draw();
}

function paneNew(p) {
  const L = LV[p.level] || LV[1], r = S.edit ? D.reports.find(x => x.id === S.edit) : null;
  const v = k => r?.pillars?.[k] ?? 5, m = k => r?.match?.[k] ?? "";
  const allAreas = [...new Set([...L.areas, ...S.areas])];
  $("#pane").innerHTML = `<form class="card" id="rform"><h3>${r ? "Edit progress report" : "Progress report for " + esc(p.name)}</h3><p class="note" style="margin:-6px 0 14px">A deeper review every few weeks (pillars, match data, areas to improve). For a single lesson, use a lesson report.</p><div class="form">
  <label>Date<input type="date" name="date" value="${esc(r?.date || today())}" required></label>
  <label>Session type<select name="type">${["Private lesson", "Group class", "Match review (GlassWall)", "Level test", "Monthly progress review", "Tournament debrief"].map(t => `<option${r?.type === t ? " selected" : ""}>${t}</option>`).join("")}</select></label>
  <div class="full"><label style="margin-bottom:8px">Pillar scores, 1 to 10</label>${PIL.map(([k, n]) => `<div class="sl"><span>${esc(n)}</span><input type="range" min="1" max="10" name="p_${k}" value="${esc(v(k))}" aria-label="${esc(n)}"><output>${esc(v(k))}</output></div>`).join("")}</div>
  <div class="full"><label>GlassWall match data (optional)</label><div class="form" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:4px">${MET.map(([k, n]) => `<label>${esc(n)}<input name="m_${k}" inputmode="decimal" value="${esc(m(k))}" placeholder="${esc(L.t[k] ?? "")}"></label>`).join("")}</div><p class="note">Placeholders show the ${esc(L.next)} target.</p></div>
  <label class="full">Strengths today<textarea name="strengths" placeholder="What went well">${esc(r?.strengths || "")}</textarea></label>
  <div class="full"><label>Areas to improve (from the ${esc(L.name)} book, tap to add)</label><div class="chips" id="chips" style="margin-top:6px">${allAreas.map(a => `<button type="button" class="chip" data-act="area" data-a="${esc(a)}" aria-pressed="${S.areas.has(a)}">${esc(a)}</button>`).join("")}</div><div style="display:flex;gap:8px;margin-top:8px"><input id="customArea" placeholder="Add your own area"><button type="button" class="btn sm" data-act="addArea">Add</button></div></div>
  <label class="full">Notes on areas to improve<textarea name="improveNotes" placeholder="What you saw, and the cue that worked">${esc(r?.improveNotes || "")}</textarea></label>
  <label>Next session focus<input name="nextFocus" value="${esc(r?.nextFocus || "")}" placeholder="One clear focus"></label>
  <label>Homework drill<input name="homework" list="drills" value="${esc(r?.homework || "")}" placeholder="e.g. ${esc(L.drills[0] || "")}"><datalist id="drills">${L.drills.map(d => `<option value="${esc(d)}">`).join("")}</datalist></label>
  <label class="full">Durability and injury check<input name="injury" value="${esc(r?.injury || "")}" placeholder="Pain, load, warm-up done, physio advice"></label>
  </div><div class="line" style="margin-top:16px"><span class="note">Saved for all coaches as ${esc(r?.coach || ME.name)}.</span><span style="display:flex;gap:8px">${r ? '<button type="button" class="btn" data-act="cancelEdit">Cancel</button>' : ""}<button class="btn pri">${r ? "Update report" : "Save report"}</button></span></div></form>`;
}

function paneReports(p) {
  const reps = repsOf(p.id).reverse();
  $("#pane").innerHTML = reps.length ? reps.map(r => `<article class="rep"><div class="line"><h4>${fmt(r.date)} · ${esc(r.type || "Report")}</h4><span class="note">Coach ${esc(r.coach || "—")} · avg ${avg(r)?.toFixed(1) ?? "—"}/10</span></div>
  <p>${PIL.map(([k, n]) => `<span class="tag">${esc(n)} ${esc(r.pillars?.[k] ?? "—")}</span>`).join("")}</p>
  ${r.match && Object.values(r.match).some(v => v !== "" && v != null) ? `<p><span class="k">GlassWall</span>${MET.filter(([k]) => r.match[k] !== "" && r.match[k] != null).map(([k, n]) => `${esc(n)}: <b>${esc(r.match[k])}</b>`).join(" · ")}</p>` : ""}
  ${r.strengths ? `<p><span class="k">Strengths</span>${esc(r.strengths)}</p>` : ""}
  ${r.improve?.length ? `<p><span class="k">Areas to improve</span>${r.improve.map(a => `<span class="tag">${esc(a)}</span>`).join("")}</p>` : ""}
  ${r.improveNotes ? `<p>${esc(r.improveNotes)}</p>` : ""}${r.nextFocus ? `<p><span class="k">Next focus</span>${esc(r.nextFocus)}</p>` : ""}${r.homework ? `<p><span class="k">Homework</span>${esc(r.homework)}</p>` : ""}${r.injury ? `<p><span class="k">Durability</span>${esc(r.injury)}</p>` : ""}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" data-act="copy" data-id="${esc(r.id)}">Copy for player</button><button class="btn sm" data-act="editr" data-id="${esc(r.id)}">Edit</button>${!isAdmin() ? "" : S.confirm === "r" + r.id ? `<span class="confirm">Delete this report?<button class="btn sm danger" data-act="delr" data-id="${esc(r.id)}">Delete</button><button class="btn sm" data-act="nocf">Keep</button></span>` : `<button class="btn sm danger" data-act="cf" data-c="r${esc(r.id)}">Delete</button>`}</div></article>`).join("")
    : '<div class="card"><p class="empty">No reports yet for this player.</p><button class="btn pri" data-act="tab" data-tab="new">Write the first report</button></div>';
}

function paneObj(p) {
  const objs = objsOf(p.id), tours = objs.filter(o => o.kind === "Tournament").sort((a, b) => (b.date || "").localeCompare(a.date || "")), oth = objs.filter(o => o.kind !== "Tournament").sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
  const isT = S.kind === "Tournament";
  const item = o => { const sts = o.kind === "Tournament" ? ST.Tournament : ST.def; return `<div class="obj"><span><b>${esc(o.title)}</b><small>${o.kind === "Tournament" ? [fmt(o.date), o.category, o.partner ? "with " + o.partner : "", o.result && o.result !== "—" ? "Result: " + o.result : ""].filter(Boolean).map(esc).join(" · ") : [o.kind, o.target, o.due ? "due " + fmt(o.due) : ""].filter(Boolean).map(esc).join(" · ")}</small></span>
  <span style="display:flex;gap:6px">${o.kind === "Tournament" ? `<select data-res="${esc(o.id)}" aria-label="Result">${RES.map(x => `<option${o.result === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>` : ""}<select data-st="${esc(o.id)}" aria-label="Status">${sts.map(x => `<option${o.status === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></span>
  ${!isAdmin() ? "<span></span>" : S.confirm === "o" + o.id ? `<span class="confirm"><button class="btn sm danger" data-act="delo" data-id="${esc(o.id)}">Delete</button><button class="btn sm" data-act="nocf">Keep</button></span>` : `<button class="btn sm danger" data-act="cf" data-c="o${esc(o.id)}" aria-label="Delete">Remove</button>`}</div>`; };
  $("#pane").innerHTML = `<div class="grid2"><form class="card" id="oform"><h3>Add objective</h3><div class="form">
  <label class="full">Type<select name="kind" id="okind">${KINDS.map(k => `<option${S.kind === k ? " selected" : ""}>${esc(k)}</option>`).join("")}</select></label>
  <label class="full">${isT ? "Tournament name" : "Objective"}<input name="title" required placeholder="${isT ? "e.g. Padel Beast Winter Open" : "e.g. Bandeja Corner 6/10 in the test"}"></label>
  ${isT ? `<label>Date<input type="date" name="date" required></label><label>Category<input name="category" placeholder="e.g. Men's C, Mixed, Junior U14"></label><label>Partner<input name="partner"></label><label>Status<select name="status">${ST.Tournament.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>`
    : `<label>Target<input name="target" placeholder="e.g. errors ≤ ${esc((LV[p.level] || LV[1]).t.errors)}"></label><label>Due date<input type="date" name="due"></label>`}
  </div><button class="btn pri" style="margin-top:14px">Add ${isT ? "tournament" : "objective"}</button></form>
  <div class="card"><h3>Tournaments</h3><p class="trophy">${tours.filter(t => t.status === "Played").length} played</p>${tours.length ? tours.map(item).join("") : '<p class="empty">No tournaments yet.</p>'}</div>
  <div class="card" style="grid-column:1/-1"><h3>Objectives</h3>${oth.length ? oth.map(item).join("") : '<p class="empty">No objectives yet. Set one pillar goal per 8-week block.</p>'}</div></div>`;
}

function paneLessons(p) {
  const list = lessonsOf(p.id);
  $("#pane").innerHTML = (list.length ? list.map(l => { const f = l.fb?.[p.id] || {}; return `<article class="rep"><div class="line"><h4>${fmt(l.date)} · ${esc(lessonTitle(l) || "Lesson")}</h4><span class="note">Coach ${esc(l.coach || "—")} · ${esc(f.present || "Present")}${f.rating ? " · " + esc(f.rating) + "/5 " + esc(RATE[f.rating]) : ""}</span></div>${l.summary ? `<p><span class="k">What the group did</span>${esc(l.summary)}</p>` : ""}${f.comment ? `<p><span class="k">Personal feedback</span>${esc(f.comment)}</p>` : ""}${f.improve ? `<p><span class="k">Area to improve</span>${esc(f.improve)}</p>` : ""}${f.next ? `<p><span class="k">Next lesson focus</span>${esc(f.next)}</p>` : ""}<button class="btn sm" data-act="copyL" data-l="${esc(l.id)}" data-p="${esc(p.id)}">Copy for ${isJr(p) ? "parent" : "player"}</button></article>`; }).join("") : '<div class="card"><p class="empty">No lesson reports for this player yet.</p></div>') + '<button class="btn pri" style="margin-top:8px" data-act="newLesson">+ New lesson report</button>';
}

function copyText(r) {
  const p = D.players.find(x => x.id === r.playerId) || {}, L = LV[p.level] || LV[1];
  const lines = ["PADEL BEAST · Player report", `${p.name} · ${L.name} · ${fmt(r.date)}`, `Coach: ${r.coach || ""} · ${r.type || ""}`, "", "Scores (1–10): " + PIL.map(([k, n]) => `${n} ${r.pillars?.[k] ?? "-"}`).join(" · ")];
  if (r.match && Object.values(r.match).some(v => v !== "" && v != null)) lines.push("Match data: " + MET.filter(([k]) => r.match[k] !== "" && r.match[k] != null).map(([k, n]) => `${n} ${r.match[k]} (target ${L.t[k]})`).join(" · "));
  if (r.strengths) lines.push("", "Strengths: " + r.strengths);
  if (r.improve?.length) lines.push("", "Areas to improve: " + r.improve.join(", "));
  if (r.improveNotes) lines.push(r.improveNotes);
  if (r.nextFocus) lines.push("", "Next focus: " + r.nextFocus);
  if (r.homework) lines.push("Homework: " + r.homework);
  if (r.injury) lines.push("Body check: " + r.injury);
  return lines.join("\n");
}

// ───────── Player add/edit dialog
let editPlayer = null;
export function openPlayer(p) {
  editPlayer = p; S.dz = false;
  const f = $("#pform"); f.reset(); $("#dlgTitle").textContent = p ? "Edit player" : "Add player";
  const v = p || { level: 1, start: today() };
  for (const el of f.elements) { if (el.name && v[el.name] != null && v[el.name] !== "") { el.tagName === "SELECT" ? setSelect(el, v[el.name]) : (el.value = v[el.name]); } }
  jrToggle(); renderDz(); $("#dlg").showModal();
}
export function jrToggle() { const f = $("#pform"); const on = f.elements.program.value === "Junior programme"; f.querySelectorAll(".jr").forEach(x => (x.hidden = !on)); }
function renderDz() {
  const f = $("#pform"); let dz = f.querySelector(".dz"); if (dz) dz.remove();
  if (!editPlayer || !isAdmin()) return;
  const id = editPlayer.id, n = { l: lessonsOf(id).length, r: repsOf(id).length, o: objsOf(id).length };
  dz = document.createElement("div"); dz.className = "dz"; dz.style.marginTop = "14px";
  dz.innerHTML = S.dz ? `<p class="note" style="color:var(--bad)">This permanently deletes ${esc(editPlayer.name)} and their ${n.l} lesson report${n.l === 1 ? "" : "s"}, ${n.r} progress report${n.r === 1 ? "" : "s"} and ${n.o} objective${n.o === 1 ? "" : "s"}. It cannot be undone.</p><span class="confirm"><button type="button" class="btn sm danger" data-act="delp" data-id="${esc(id)}">Yes, delete everything</button><button type="button" class="btn sm" data-act="nodelp">Keep player</button></span>` : '<button type="button" class="btn sm danger" data-act="askdelp">Delete player…</button>';
  f.querySelector(".form").after(dz);
}
export function initPlayerDialog() {
  $("#addPlayer").addEventListener("click", () => openPlayer(null));
  $("#dlg").addEventListener("close", async () => {
    if ($("#dlg").returnValue !== "save") return;
    const fd = new FormData($("#pform")), name = String(fd.get("name") || "").trim(); if (!name) return;
    const base = editPlayer || { milestones: {}, history: [] }, id = editPlayer?.id || uid();
    const rec = { ...base, id, name, group: String(fd.get("group") || ""), dob: fd.get("dob") || "", school: String(fd.get("school") || "").trim(), parent: String(fd.get("parent") || "").trim(), phone: String(fd.get("phone") || "").trim(), kit: String(fd.get("kit") || "").trim(), level: +fd.get("level"), program: fd.get("program"), coach: String(fd.get("coach") || "").trim(), side: fd.get("side"), hand: fd.get("hand"), start: fd.get("start"), goal: String(fd.get("goal") || "").trim(), health: String(fd.get("health") || "").trim() };
    if (rec.program !== "Junior programme") { rec.group = ""; }
    if (await done(() => store.savePlayer(rec), editPlayer ? "Player updated" : "Player added")) { S.sel = id; hooks.go("players/" + id, true); }
  });
}

// ───────── Event handlers (called from main.js; return true when handled)
export async function onClick(a, b) {
  const p = player();
  if (a === "pick") { S.sel = b.dataset.id; S.tab = "progress"; S.edit = null; S.confirm = null; hooks.go("players/" + S.sel); return true; }
  if (a === "tab") { S.tab = b.dataset.tab; S.confirm = null; S.edit = null; if (S.tab === "new") S.areas = new Set(); renderDetail(); return true; }
  if (a === "add") { openPlayer(null); return true; }
  if (a === "editp") { openPlayer(p); return true; }
  if (a === "askdelp") { S.dz = true; renderDz(); return true; }
  if (a === "nodelp") { S.dz = false; renderDz(); return true; }
  if (a === "delp") { const id = b.dataset.id; $("#dlg").close("cancel"); if (await done(() => store.deletePlayer(id), "Player deleted")) { S.sel = null; hooks.go("players"); } return true; }
  if (a === "promote") { if (!p) return true; await done(() => store.savePlayer({ ...p, level: p.level + 1, history: [...(p.history || []), { date: today(), from: p.level, to: p.level + 1 }] }), `${p.name} moved up to L${p.level + 1}`); return true; }
  if (a === "area") { const v = b.dataset.a; S.areas.has(v) ? S.areas.delete(v) : S.areas.add(v); b.setAttribute("aria-pressed", S.areas.has(v)); return true; }
  if (a === "addArea") { const i = $("#customArea"), v = i.value.trim(); if (!v) return true; S.areas.add(v); const c = document.createElement("button"); c.type = "button"; c.className = "chip"; c.dataset.act = "area"; c.dataset.a = v; c.setAttribute("aria-pressed", "true"); c.textContent = v; $("#chips").append(c); i.value = ""; return true; }
  if (a === "editr") { const r = D.reports.find(x => x.id === b.dataset.id); S.edit = r.id; S.areas = new Set(r.improve || []); S.tab = "new"; renderDetail(); return true; }
  if (a === "cancelEdit") { S.edit = null; S.tab = "reports"; renderDetail(); return true; }
  if (a === "cf") { S.confirm = b.dataset.c; hooks.render(); return true; }
  if (a === "nocf") { S.confirm = null; hooks.render(); return true; }
  if (a === "delr") { S.confirm = null; await done(() => store.deleteReport(b.dataset.id), "Report deleted"); return true; }
  if (a === "delo") { S.confirm = null; await done(() => store.deleteObjective(b.dataset.id), "Removed"); return true; }
  if (a === "copy") { const r = D.reports.find(x => x.id === b.dataset.id); if (r) copyOut(copyText(r), b); return true; }
  return false;
}

export async function onChange(t) {
  const p = player();
  if (t.id === "metric") { S.metric = t.value; drawChart(p); return true; }
  if (t.id === "okind") { S.kind = t.value; paneObj(p); return true; }
  if (t.dataset.ms != null && p) { const ms = { ...(p.milestones || {}) }; ms[t.dataset.ms] = t.checked; await done(() => store.savePlayer({ ...p, milestones: ms })); return true; }
  if (t.dataset.st) { const o = D.objectives.find(x => x.id === t.dataset.st); await done(() => store.saveObjective({ ...o, status: t.value })); return true; }
  if (t.dataset.res) { const o = D.objectives.find(x => x.id === t.dataset.res); await done(() => store.saveObjective({ ...o, result: t.value, status: t.value !== "—" ? "Played" : o.status })); return true; }
  if (t.id === "mobSel" && t.value) { S.sel = t.value; S.tab = "progress"; hooks.go("players/" + S.sel); return true; }
  if (t.id === "fLevel" || t.id === "fCoach" || t.id === "fGroup") { renderRoster(); return true; }
  if (t.name === "program" && t.closest("#pform")) { jrToggle(); return true; }
  return false;
}

export async function onSubmit(f, e) {
  const p = player();
  if (f.id === "rform") {
    e.preventDefault(); const fd = new FormData(f), pillars = {}, match = {};
    PIL.forEach(([k]) => (pillars[k] = +fd.get("p_" + k)));
    MET.forEach(([k]) => { const v = String(fd.get("m_" + k) || "").replace(",", ".").trim(); match[k] = v === "" || isNaN(+v) ? "" : +v; });
    const old = S.edit ? D.reports.find(x => x.id === S.edit) : null;
    const rec = { id: old?.id || uid(), playerId: p.id, date: fd.get("date"), type: fd.get("type"), coach: old?.coach || ME.name, pillars, match, strengths: String(fd.get("strengths") || "").trim(), improve: [...S.areas], improveNotes: String(fd.get("improveNotes") || "").trim(), nextFocus: String(fd.get("nextFocus") || "").trim(), homework: String(fd.get("homework") || "").trim(), injury: String(fd.get("injury") || "").trim() };
    if (await done(() => store.saveReport(rec), old ? "Report updated" : "Report saved")) { S.edit = null; S.areas = new Set(); S.tab = "progress"; hooks.render(); }
    return true;
  }
  if (f.id === "oform") {
    e.preventDefault(); const fd = new FormData(f), kind = fd.get("kind");
    const rec = { id: uid(), playerId: p.id, kind, title: String(fd.get("title") || "").trim() };
    if (kind === "Tournament") Object.assign(rec, { date: fd.get("date"), category: String(fd.get("category") || "").trim(), partner: String(fd.get("partner") || "").trim(), status: fd.get("status"), result: "—" });
    else Object.assign(rec, { target: String(fd.get("target") || "").trim(), due: fd.get("due") || "", status: "Open" });
    await done(() => store.saveObjective(rec), "Added");
    return true;
  }
  return false;
}
