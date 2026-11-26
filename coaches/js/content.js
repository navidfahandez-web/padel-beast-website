// Coaching methodology (levels, milestones, drills, junior modules...) is loaded from the database
// after login (table "content", key "methodology"), never from a public file.
export let LV = {}, JR = [], JRS = [], TRAIN = [], GR = {}, GRL = {}, PIL = [], MET = [], KINDS = [];
export let ST = { def: [], Tournament: [] }, RES = [], RATE = [""], QUICK = [], PERIOD = "";

export function initContent(m) {
  LV = {};
  for (const [n, l] of Object.entries(m.levels || {})) {
    LV[n] = { name: l.name, next: l.nextLevel, focus: l.focus, t: l.nextLevelTargets || {}, ms: l.milestones || [], areas: l.areasToImprove || [], drills: l.keyDrills || [] };
  }
  const jp = m.juniorProgramme || {}, mods = jp.modules || [];
  JR = mods.map(x => x.description);
  JRS = mods.map(x => x.short);
  TRAIN = mods.map(x => (x.sessions || []).map(s => s.focus));
  GR = jp.groups || {};
  PERIOD = jp.period || "";
  GRL = m.lessonGroups || {};
  PIL = (m.pillars || []).map(p => [p.key, p.label]);
  MET = (m.glasswallMetrics || []).map(x => [x.key, x.label, x.better === "low" ? "low" : "high"]);
  KINDS = m.objectiveKinds || [];
  ST = { def: (m.objectiveStatuses || {}).default || [], Tournament: (m.objectiveStatuses || {}).Tournament || [] };
  RES = m.tournamentResults || [];
  RATE = ["", ...[1, 2, 3, 4, 5].map(n => (m.ratingScale || {})[n] || "")];
  QUICK = m.quickComments || [];
}
