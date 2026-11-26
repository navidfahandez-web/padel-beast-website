// Admin-only "Coaches" screen. Inviting and deactivating go through the server-side function:
// no passwords are created, shown or sent here. Each coach sets their own from the invite email.
import { D, ME, S, hooks, toast, isAdmin } from "./state.js";
import { $, esc } from "./util.js";
import * as store from "./store.js";

export function viewCoaches() {
  const list = D.coaches.slice().sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  $("#detail").innerHTML = `<div class="card"><h2 style="font-size:26px">Coaches</h2><p class="note" style="margin:6px 0 14px">Coaches are invited by email and set their own password. You never see or send a password.</p>
  <div class="scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${list.map(c => `<tr><td><b>${esc(c.name)}</b>${c.user_id === ME.user_id ? ' <span class="note">(you)</span>' : ""}</td><td>${esc(c.email)}</td><td>${esc(c.role)}</td><td>${c.active ? '<span class="ok">Active</span>' : '<span class="no">Inactive</span>'}</td><td style="text-align:right">${c.user_id === ME.user_id ? "" : c.active
    ? (S.confirm === "c" + c.user_id ? `<span class="confirm">Deactivate ${esc(c.name)}?<button class="btn sm danger" data-act="deact" data-id="${esc(c.user_id)}">Deactivate</button><button class="btn sm" data-act="nocf">Keep</button></span>` : `<button class="btn sm danger" data-act="cf" data-c="c${esc(c.user_id)}">Deactivate</button>`)
    : `<button class="btn sm" data-act="react" data-id="${esc(c.user_id)}">Reactivate</button>`}</td></tr>`).join("")}</tbody></table></div>
  <p class="note">Deactivating cuts access immediately. Their past lesson reports stay.</p></div>
  <form class="card" id="cform" style="margin-top:16px"><h3>Invite a coach</h3><div class="form">
  <label>Full name<input name="name" required autocomplete="off"></label>
  <label>Email<input type="email" name="email" required autocomplete="off" inputmode="email"></label>
  <label>Role<select name="role"><option value="coach">Coach: write and edit reports</option><option value="admin">Admin: also delete records and manage coaches</option></select></label>
  </div><div class="line" style="margin-top:14px"><span class="note" id="inviteMsg" role="status"></span><button class="btn pri">Send invite</button></div></form>`;
}

export async function onClick(a, b) {
  if (!isAdmin()) return false;
  if (a === "deact" || a === "react") {
    S.confirm = null;
    try { await store.manageCoach(a === "deact" ? "deactivate" : "reactivate", { user_id: b.dataset.id }); toast(a === "deact" ? "Coach deactivated" : "Coach reactivated"); } catch (e) { toast(e.message); }
    hooks.render(); return true;
  }
  return false;
}

export async function onSubmit(f, e) {
  if (f.id !== "cform" || !isAdmin()) return false;
  e.preventDefault(); const fd = new FormData(f), msg = $("#inviteMsg"), btn = f.querySelector("button");
  btn.disabled = true; msg.textContent = "Sending…";
  try {
    await store.manageCoach("invite", { name: String(fd.get("name")).trim(), email: String(fd.get("email")).trim().toLowerCase(), role: fd.get("role") });
    toast("Invite sent. They will set their own password from the email."); hooks.render();
  } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  return true;
}
