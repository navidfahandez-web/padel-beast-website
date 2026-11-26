import { $ } from "./util.js";

// Shows one pane of the login screen. kind: login | forgot | setpw | unconfigured
export function showLogin(kind = "login", note = "") {
  $("#app").hidden = true; $("#screen-login").hidden = false;
  for (const k of ["login", "forgot", "setpw", "unconfigured"]) $("#pane-" + k).hidden = k !== kind;
  for (const el of document.querySelectorAll("#screen-login .msg")) el.textContent = "";
  const msg = $("#pane-" + kind + " .msg"); if (msg && note) msg.textContent = note;
  document.title = "Coach login · Padel Beast";
  const first = $("#pane-" + kind + " input"); if (first) setTimeout(() => first.focus(), 30);
}
export const hideLogin = () => { $("#screen-login").hidden = true; $("#app").hidden = false; };

// Handles the three auth forms. Returns true if the submit was one of ours.
export async function onAuthSubmit(f, e, api, hooks) {
  const say = (pane, t) => { $("#pane-" + pane + " .msg").textContent = t; };
  if (f.id === "loginForm") {
    e.preventDefault(); const fd = new FormData(f), btn = f.querySelector("button[type=submit]"); btn.disabled = true; say("login", "Signing in…");
    try { await api.auth.signIn(String(fd.get("email")).trim(), String(fd.get("password"))); f.reset(); await hooks.enter(); }
    catch { say("login", "That email and password don't match. Try again, or use “Forgot password?”."); }
    btn.disabled = false; return true;
  }
  if (f.id === "forgotForm") {
    e.preventDefault(); const email = String(new FormData(f).get("email")).trim();
    try { await api.auth.resetPassword(email); } catch { /* same message either way, so nobody can probe which emails exist */ }
    say("forgot", "If that email belongs to a coach, a reset link is on its way. Check your inbox."); return true;
  }
  if (f.id === "pwForm") {
    e.preventDefault(); const fd = new FormData(f), a = String(fd.get("pw")), b = String(fd.get("pw2"));
    if (a.length < 10) { say("setpw", "Use at least 10 characters."); return true; }
    if (a !== b) { say("setpw", "The two passwords don't match."); return true; }
    try { await api.auth.updatePassword(a); history.replaceState(null, "", "/coaches/"); f.reset(); await hooks.enter(); }
    catch { say("setpw", "Could not set the password. The link may have expired: ask for a new one from “Forgot password?”."); }
    return true;
  }
  return false;
}
