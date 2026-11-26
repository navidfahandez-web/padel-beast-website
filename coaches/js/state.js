import { PIL, MET, LV, JR, JRS } from "./content.js";
import { $, byDateDesc } from "./util.js";

export const D = { players: [], lessons: [], reports: [], objectives: [], plans: [], coaches: [] };
export const ME = { user_id: null, name: "", email: "", role: "coach" };
export const S = { view: "players", lf: null, sel: null, tab: "progress", metric: "pillars", edit: null, areas: new Set(), confirm: null, okt: null, kind: "Technique", lg: "", lc: "", dz: false };
export const hooks = { render() {}, go() {} };
export const isAdmin = () => ME.role === "admin";

export const isJr = p => p.program === "Junior programme";
export const player = () => D.players.find(p => p.id === S.sel);
export const repsOf = id => D.reports.filter(r => r.playerId === id).sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || ""));
export const objsOf = id => D.objectives.filter(o => o.playerId === id);
export const avg = r => { const v = PIL.map(p => +r.pillars?.[p[0]]).filter(n => n > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
export const msList = p => isJr(p) ? JR.map((t, i) => [t, "jr_" + i]) : (LV[p.level] || LV[1]).ms.map((t, i) => [t, p.level + "_" + i]);
export const msPct = p => { const l = msList(p); const done = l.filter(([, k]) => p.milestones?.[k]).length; return { done, total: l.length, pct: l.length ? Math.round(done / l.length * 100) : 0 }; };
export const pass = (k, v, t) => { if (v == null || v === "" || t == null) return null; const m = MET.find(x => x[0] === k); return m[2] === "low" ? +v <= t : +v >= t; };
export const lessonsOf = id => D.lessons.filter(l => (l.players || []).includes(id)).sort(byDateDesc);
export const groupIds = g => D.players.filter(x => isJr(x) && x.group === g).map(x => x.id);
export const lessonTitle = l => { const m = l.module !== "" && l.module != null && JRS[l.module] ? `M${+l.module + 1} ${JRS[l.module]}${l.training ? " · " + l.training : ""}` : ""; return [m, l.focus].filter(Boolean).join(" — "); };
export const planFor = (m, t) => m === "" || m == null || !t ? null : D.plans.find(x => x.id === "M" + (+m + 1) + t);
export const curModule = () => ({ 9: 0, 10: 1, 11: 2, 0: 3, 1: 4, 2: 5 })[new Date().getMonth()] ?? "";
export function prevLesson(g, ids) { return D.lessons.filter(l => l.id !== S.lf?.id && ((["A", "B", "C"].includes(g) && l.group === g) || (l.players || []).some(i => ids.includes(i)))).sort(byDateDesc)[0]; }
export function nextSession(l) { if (!l || l.module === "" || l.module == null || !l.training) return null; let m = +l.module, t = +l.training.slice(1) + 1; if (t > 8) { m++; t = 1; } return m > 5 ? null : { m, t: "T" + t }; }
export function lastFb(id) { const l = D.lessons.filter(x => x.id !== S.lf?.id && (x.players || []).includes(id)).sort(byDateDesc).find(x => x.fb?.[id]); return l ? { l, f: l.fb[id] } : null; }

export const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(S.okt); S.okt = setTimeout(() => t.classList.remove("show"), 2600); };
export const banner = m => { const b = $("#banner"); b.hidden = !m; b.textContent = m || ""; };
