import { $ } from "./util.js";

// Shows one pane of the login screen. kind: login | forgot | setpw | firstadmin | recover | unconfigured
const PANES = ["login", "forgot", "setpw", "firstadmin", "recover", "unconfigured"];
export function showLogin(kind = "login", note = "") {
  $("#app").hidden = true; $("#screen-login").hidden = false;
  for (const k of PANES) $("#pane-" + k).hidden = k !== kind;
  for (const el of document.querySelectorAll("#screen-login .msg")) el.textContent = "";
  const msg = $("#pane-" + kind + " .msg"); if (msg && note) msg.textContent = note;
  document.title = "Coach login · Padel Beast";
  const first = $("#pane-" + kind + " input"); if (first) setTimeout(() => first.focus(), 30);
}
export const hideLogin = () => { $("#screen-login").hidden = true; $("#app").hidden = false; };

// Handles the auth forms. Returns true if the submit was one of ours.
// hooks: enter() loads the portal after a successful login; setup = { token } for the "choose your password" link.
export async function onAuthSubmit(f, e, api, hooks) {
  const say = (pane, t) => { $("#pane-" + pane + " .msg").textContent = t; };
  const busy = on => { const b = f.querySelector("button[type=submit]"); if (b) b.disabled = on; };
  const fd = () => new FormData(f);
  if (f.id === "loginForm") {
    e.preventDefault(); const d = fd(); busy(true); say("login", "Signing in…");
    try { await api.auth.signIn(String(d.get("email")).trim(), String(d.get("password"))); f.reset(); await hooks.enter(); }
    catch (err) { say("login", err.status === 401 || err.status === 403 || err.status === 429 ? err.message : "Could not sign in. Check your connection and try again."); }
    busy(false); return true;
  }
  if (f.id === "pwForm") {
    e.preventDefault(); const d = fd(), a = String(d.get("pw")), b = String(d.get("pw2"));
    if (a.length < 10) { say("setpw", "Use at least 10 characters."); return true; }
    if (a !== b) { say("setpw", "The two passwords don't match."); return true; }
    busy(true); say("setpw", "Saving…");
    try { await api.auth.setPassword(hooks.setup.token, a); hooks.setup.token = null; f.reset(); history.replaceState(null, "", "/coaches/"); await hooks.enter(); }
    catch (err) { say("setpw", err.message || "Could not set the password."); }
    busy(false); return true;
  }
  if (f.id === "firstForm") {
    e.preventDefault(); const d = fd(), a = String(d.get("pw")), b = String(d.get("pw2"));
    if (a.length < 10) { say("firstadmin", "Use at least 10 characters."); return true; }
    if (a !== b) { say("firstadmin", "The two passwords don't match."); return true; }
    busy(true); say("firstadmin", "Creating…");
    try { await api.auth.firstAdmin(String(d.get("key")).trim(), String(d.get("name")).trim(), String(d.get("email")).trim(), a); f.reset(); history.replaceState(null, "", "/coaches/"); await hooks.enter(); }
    catch (err) { say("firstadmin", err.message || "Could not create the admin."); }
    busy(false); return true;
  }
  if (f.id === "recoverForm") {
    e.preventDefault(); const d = fd(); busy(true); say("recover", "Checking…");
    try {
      const { token } = await api.auth.recover(String(d.get("key")).trim(), String(d.get("email")).trim());
      f.reset(); hooks.setup.token = token; await hooks.showSetup();
    } catch (err) { say("recover", err.message || "Could not do that."); }
    busy(false); return true;
  }
  return false;
}
