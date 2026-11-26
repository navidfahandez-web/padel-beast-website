// Maps database rows <-> the shapes the screens use, and performs every save.
// Never log or print player data here.
import { D, ME } from "./state.js";
import { uid } from "./util.js";
import { initContent } from "./content.js";

let api = null;
export const useBackend = b => { api = b; };
export const backend = () => api;
const nn = v => (v === "" || v === undefined ? null : v);
const toNum = v => (v === "" || v == null || isNaN(+v) ? null : +v);

const fromPlayer = r => ({ id: r.id, name: r.name, level: r.level, program: r.program, group: r.junior_group || "", coach: r.main_coach || "", side: r.side || "", hand: r.hand || "", start: r.start_date || "", goal: r.goal || "", health: r.health_notes || "", dob: r.dob || "", school: r.school || "", parent: r.parent_name || "", phone: r.parent_phone || "", kit: r.kit_size || "", milestones: r.milestones || {}, history: r.level_history || [], sample: !!r.is_sample, createdAt: r.created_at || "" });
const toPlayer = p => ({ id: p.id, name: p.name, level: p.level, program: p.program, junior_group: nn(p.group), main_coach: nn(p.coach), side: nn(p.side), hand: nn(p.hand), start_date: nn(p.start), goal: nn(p.goal), health_notes: nn(p.health), dob: nn(p.dob), school: nn(p.school), parent_name: nn(p.parent), parent_phone: nn(p.phone), kit_size: nn(p.kit), milestones: p.milestones || {}, level_history: p.history || [] });
const fromReport = r => ({ id: r.id, playerId: r.player_id, date: r.date, type: r.type || "", coach: r.coach_name || "", pillars: r.pillars || {}, match: r.match || {}, strengths: r.strengths || "", improve: r.improve || [], improveNotes: r.improve_notes || "", nextFocus: r.next_focus || "", homework: r.homework || "", injury: r.injury || "", sample: !!r.is_sample, createdAt: r.created_at || "" });
const fromObjective = r => ({ id: r.id, playerId: r.player_id, kind: r.kind, title: r.title, target: r.target || "", due: r.due || "", status: r.status, date: r.tournament_date || "", category: r.category || "", partner: r.partner || "", result: r.result || "—", createdAt: r.created_at || "" });

export async function loadAll() {
  const [co, pl, ls, fb, rp, ob, sp, ct] = await Promise.all(["coaches", "players", "lessons", "lesson_feedback", "progress_reports", "objectives", "session_plans", "content"].map(t => api.list(t)));
  const meth = ct.find(c => c.key === "methodology");
  if (!meth) throw new Error("Coaching content is missing. Ask Navid to run the import.");
  initContent(meth.data);
  D.coaches = co;
  D.players = pl.map(fromPlayer);
  const byLesson = {};
  for (const f of fb) (byLesson[f.lesson_id] ||= []).push(f);
  D.lessons = ls.map(l => {
    const rows = byLesson[l.id] || [], fbm = {};
    rows.forEach(f => { fbm[f.player_id] = { present: f.attendance, rating: f.rating, comment: f.comment || "", improve: f.improve || "", next: f.next_focus || "" }; });
    return { id: l.id, date: l.date, coachId: l.coach_id, coach: l.coach_name, group: l.group_code || "", module: l.module ?? "", training: l.training || "", focus: l.focus || "", objectives: l.objectives || "", summary: l.summary || "", exercises: l.exercises || [], sample: !!l.is_sample, createdAt: l.created_at || "", players: rows.map(f => f.player_id), fb: fbm };
  });
  D.reports = rp.map(fromReport);
  D.objectives = ob.map(fromObjective);
  D.plans = sp.map(p => ({ id: p.id, module: p.module, training: p.training, objectives: p.objectives || "", exercises: p.exercises || [], updatedBy: p.updated_by_name || "" }));
}

// Run a write, then refresh everything so all screens agree. Errors bubble up as readable messages.
async function write(fn) { try { await fn(); } catch (e) { throw new Error(friendly(e)); } await loadAll(); }
function friendly(e) {
  const m = String(e?.message || e || "");
  if (/row-level security|permission|not allowed/i.test(m)) return "You don't have permission to do that.";
  if (/fetch|network|failed to/i.test(m)) return "Could not reach the server. Check your connection and try again.";
  return "Could not save. Please try again.";
}

export const savePlayer = p => write(() => api.upsert("players", [toPlayer(p)]));
export const deletePlayer = id => write(() => api.remove("players", { id }));

export function saveLesson(rec, fbMap, plan) {
  return write(async () => {
    const old = D.lessons.find(l => l.id === rec.id);
    await api.upsert("lessons", [{ id: rec.id, date: rec.date, coach_id: nn(rec.coachId), coach_name: rec.coach, group_code: nn(rec.group), module: rec.module === "" ? null : +rec.module, training: nn(rec.training), focus: nn(rec.focus), objectives: nn(rec.objectives), summary: rec.summary, exercises: rec.exercises }]);
    const ids = Object.keys(fbMap);
    await api.upsert("lesson_feedback", ids.map(pid => { const f = fbMap[pid]; return { lesson_id: rec.id, player_id: pid, attendance: f.present || "Present", rating: +f.rating || 0, comment: nn(f.comment), improve: nn(f.improve), next_focus: nn(f.next) }; }), "lesson_id,player_id");
    for (const pid of (old?.players || []).filter(x => !ids.includes(x))) await api.remove("lesson_feedback", { lesson_id: rec.id, player_id: pid });
    if (plan) await api.upsert("session_plans", [{ id: plan.id, module: plan.module, training: plan.training, objectives: nn(plan.objectives), exercises: plan.exercises, updated_by_name: ME.name }]);
  });
}
export const deleteLesson = id => write(() => api.remove("lessons", { id }));

export const saveReport = r => write(() => api.upsert("progress_reports", [{ id: r.id, player_id: r.playerId, date: r.date, type: nn(r.type), coach_name: nn(r.coach), pillars: r.pillars, match: Object.fromEntries(Object.entries(r.match || {}).map(([k, v]) => [k, toNum(v)]).filter(([, v]) => v != null)), strengths: nn(r.strengths), improve: r.improve || [], improve_notes: nn(r.improveNotes), next_focus: nn(r.nextFocus), homework: nn(r.homework), injury: nn(r.injury) }]));
export const deleteReport = id => write(() => api.remove("progress_reports", { id }));

export const saveObjective = o => write(() => api.upsert("objectives", [{ id: o.id, player_id: o.playerId, kind: o.kind, title: o.title, target: nn(o.target), due: nn(o.due), status: o.status, tournament_date: nn(o.date), category: nn(o.category), partner: nn(o.partner), result: o.result || "—" }]));
export const deleteObjective = id => write(() => api.remove("objectives", { id }));

export async function manageCoach(action, payload) { try { await api.manage(action, payload); } catch (e) { throw new Error(e.message || "Could not complete that."); } await loadAll(); }
export const newId = uid;
