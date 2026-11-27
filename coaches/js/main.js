import { getBackend, demo, onSessionExpired } from "./api.js";
import * as store from "./store.js";
import { D, ME, S, hooks, banner, isAdmin } from "./state.js";
import { $, $$ } from "./util.js";
import { showLogin, hideLogin, onAuthSubmit } from "./auth.js";
import * as Players from "./players.js";
import * as Lessons from "./lessons.js";
import * as Admin from "./admin.js";

let api = null;
// "Choose your password" links look like /coaches/setup#t=TOKEN. The token stays in the URL fragment (never sent to a server or logs),
// is read once, then removed from the address bar.
hooks.setup = { token: null };
const takeSetupToken = () => {
  if (location.pathname.replace(/\/$/, "") !== "/coaches/setup") return null;
  const t = new URLSearchParams(location.hash.slice(1)).get("t");
  history.replaceState(null, "", "/coaches/setup"); return t;
};
hooks.showSetup = async () => {
  try {
    const info = await api.auth.setupInfo(hooks.setup.token);
    showLogin("setpw"); $("#setupHello").textContent = `Welcome, ${info.name}. Choose your own password (at least 10 characters). Only you will know it.`;
  } catch (e) { hooks.setup.token = null; showLogin("login", e.status === 400 ? e.message : "Could not check that link. Please try again."); }
};

function applyRoute() {
  const [a, b] = location.pathname.replace(/^\/coaches\/?/, "").split("/").filter(Boolean);
  S.confirm = null;
  if (a !== "team") S.link = null;
  if (a === "lessons") S.view = "lessons";
  else if (a === "team" && isAdmin()) { S.view = "team"; S.lf = null; }
  else { S.view = "players"; S.lf = null; if (a === "players" && b) S.sel = decodeURIComponent(b); }
  if (S.sel && !D.players.some(p => p.id === S.sel)) S.sel = null;
}
hooks.go = (path, replace) => {
  const url = "/coaches/" + path;
  if (location.pathname !== url) history[replace ? "replaceState" : "pushState"](null, "", url);
  applyRoute(); render();
};

function render() {
  $("#nav-team").hidden = !isAdmin();
  $("main").classList.toggle("full", S.view !== "players");
  $$(".views button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === S.view));
  Players.renderRoster();
  if (S.view === "lessons") Lessons.viewLessons();
  else if (S.view === "team") Admin.viewCoaches();
  else Players.renderDetail();
}
hooks.render = render;

const busy = () => $("#lform") || (S.tab === "new" && $("#rform")) || ($("#oform") && $("#oform").contains(document.activeElement)) || $("#dlg").open || $("#cform input:focus");

async function enter() {
  const session = await api.auth.session();
  if (!session) { showLogin("login"); return; }
  const me = session.user;
  Object.assign(ME, { user_id: me.user_id, name: me.name, email: me.email, role: me.role });
  try { await store.loadAll(); } catch (e) { showLogin("login", e.message || "Could not load the portal. Please try again."); return; }
  hideLogin(); document.title = "Coach Portal · Padel Beast";
  $("#whoName").textContent = ME.name;
  if (demo) banner("Demo mode: fictional data, kept on this computer only. Log in with any email and password (an email containing “admin” is the admin).");
  applyRoute(); render();
  if (location.pathname.replace(/\/$/, "") !== "/coaches" && !/^\/coaches\/(players|lessons|team)/.test(location.pathname)) history.replaceState(null, "", "/coaches/");
}
hooks.enter = enter;

// Forget everything on screen and in memory, so nothing lingers once someone has logged out.
function wipe() {
  Lessons.clearDraft();
  for (const k of Object.keys(D)) D[k] = [];
  Object.assign(ME, { user_id: null, name: "", email: "", role: "coach" }); Object.assign(S, { sel: null, lf: null, tab: "progress", view: "players", confirm: null, link: null });
  for (const id of ["#roster", "#detail", "#mobSel", "#whoName"]) $(id).innerHTML = "";
  banner("");
  $("#dlg").open && $("#dlg").close();
}
async function leave() {
  try { await api.auth.signOut(); } catch { /* ignore */ }
  wipe(); history.replaceState(null, "", "/coaches/login"); showLogin("login");
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act;
  if (a === "auth-forgot") return showLogin("forgot");
  if (a === "auth-login") return showLogin("login");
  if (a === "auth-recover") return showLogin("recover");
  if (a === "logout") return leave();
  if (a === "view") { S.lf = null; S.confirm = null; const v = b.dataset.v; hooks.go(v === "players" ? (S.sel ? "players/" + S.sel : "players") : v); return; }
  (await Lessons.onClick(a, b)) || (await Players.onClick(a, b)) || (await Admin.onClick(a, b));
});
document.addEventListener("change", async e => { const t = e.target; Lessons.onChange(t) || (await Players.onChange(t)); });
document.addEventListener("input", e => { const t = e.target; if (t.type === "range") t.nextElementSibling.textContent = t.value; if (t.id === "search") Players.renderRoster(); Lessons.onInput(t); });
// Block the browser's own form submit synchronously (before any await), so nothing is ever sent as a URL query.
// Only the player dialog (method="dialog") is left alone: the browser closes it itself.
document.addEventListener("submit", e => { if (e.target.id !== "pform") e.preventDefault(); }, true);
document.addEventListener("submit", async e => {
  const f = e.target;
  if (await onAuthSubmit(f, e, api, hooks)) return;
  (await Lessons.onSubmit(f, e)) || (await Players.onSubmit(f, e)) || (await Admin.onSubmit(f, e));
});
window.addEventListener("popstate", () => { if (ME.user_id) { applyRoute(); render(); } });
document.addEventListener("visibilitychange", async () => {
  if (document.hidden || !ME.user_id || busy()) return;
  try { await store.loadAll(); if (!busy()) render(); } catch { /* keep what is on screen */ }
});

(async function boot() {
  Players.initPlayerDialog();
  api = await getBackend();
  store.useBackend(api);
  onSessionExpired(() => { if (ME.user_id) { wipe(); history.replaceState(null, "", "/coaches/login"); showLogin("login", "Your session ended. Please log in again."); } });
  hooks.setup.token = takeSetupToken();
  let status;
  try { status = await api.auth.status(); } catch { showLogin("unconfigured"); $("#pane-unconfigured .msg").textContent = "Could not reach the portal server. Please try again in a moment."; return; }
  if (hooks.setup.token) { await hooks.showSetup(); return; }
  if (!status.ready) {
    if (status.bootstrap) { showLogin("firstadmin"); return; }
    showLogin("unconfigured"); $("#pane-unconfigured .msg").textContent = "Setup isn't finished yet: the admin still needs to add the setup key in Netlify."; return;
  }
  if (await api.auth.session()) await enter(); else showLogin("login");
})();
