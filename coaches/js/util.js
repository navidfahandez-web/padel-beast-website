export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 9));
export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const fmt = d => { if (!d) return ""; const x = new Date(d + "T00:00"); return isNaN(x) ? esc(d) : x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
export const byDateDesc = (a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "");
// Set a <select> value even if the stored value is not one of the listed options (e.g. imported data)
export function setSelect(el, val) {
  if (val == null || val === "") return;
  if (![...el.options].some(o => o.value === String(val) || o.text === String(val))) el.add(new Option(String(val), String(val)));
  el.value = String(val);
}
