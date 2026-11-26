// Admin-only "Coaches" screen. Inviting, new links and deactivating go through the server.
// No passwords are created, shown or sent here: the admin hands over a one-time link and each coach chooses their own.
import { D, ME, S, hooks, toast, isAdmin } from "./state.js";
import { $, esc, today } from "./util.js";
import * as store from "./store.js";

const linkUrl = t => `${location.origin}/coaches/setup#t=${t}`;
const linkCard = () => !S.link ? "" : `<div class="card linkcard"><h3>Link for ${esc(S.link.name)}</h3>
  <p class="note">Send this to ${esc(S.link.name)} on WhatsApp. They open it and choose their own password. It works once and expires in 7 days. Anyone who has it can set the password, so send it only to them.</p>
  <div class="copyrow"><input id="linkInput" readonly value="${esc(linkUrl(S.link.token))}" aria-label="One-time password link" onfocus="this.select()"><button class="btn pri" data-act="copylink">Copy link</button><button class="btn" data-act="hidelink">Done</button></div></div>`;

export function viewCoaches() {
  const list = D.coaches.slice().sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  $("#detail").innerHTML = `<div class="card"><h2 style="font-size:26px">Coaches</h2><p class="note" style="margin:6px 0 14px">You invite a coach, get a one-time link and send it on WhatsApp. They choose their own password. You never see or send a password.</p>
  <div class="scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${list.map(c => `<tr><td><b>${esc(c.name)}</b>${c.user_id === ME.user_id ? ' <span class="note">(you)</span>' : ""}</td><td>${esc(c.email)}</td><td>${esc(c.role)}</td><td>${!c.active ? '<span class="no">Inactive</span>' : c.pending ? '<span class="note">Waiting for first login</span>' : '<span class="ok">Active</span>'}</td><td style="text-align:right">${c.user_id === ME.user_id ? "" : c.active
    ? `<button class="btn sm" data-act="link" data-id="${esc(c.user_id)}">New link</button> ` + (S.confirm === "c" + c.user_id ? `<span class="confirm">Deactivate ${esc(c.name)}?<button class="btn sm danger" data-act="deact" data-id="${esc(c.user_id)}">Deactivate</button><button class="btn sm" data-act="nocf">Keep</button></span>` : `<button class="btn sm danger" data-act="cf" data-c="c${esc(c.user_id)}">Deactivate</button>`)
    : `<button class="btn sm" data-act="react" data-id="${esc(c.user_id)}">Reactivate</button>`}</td></tr>`).join("")}</tbody></table></div>
  <p class="note">“New link” is also how a coach who forgot their password gets back in. Deactivating cuts access immediately; their past lesson reports stay.</p></div>
  ${linkCard()}
  <div class="card" style="margin-top:16px"><h3>Backup</h3><p class="note" style="margin:6px 0 12px">Download a full copy of every player, lesson, report and objective as one file. Do this regularly (for example every Sunday) and keep the file somewhere private: it contains children's information, so don't email it or upload it anywhere public.</p><button class="btn" data-act="backup">Download backup</button></div>
  <form class="card" id="cform" style="margin-top:16px"><h3>Invite a coach</h3><div class="form">
  <label>Full name<input name="name" required autocomplete="off"></label>
  <label>Email<input type="email" name="email" required autocomplete="off" inputmode="email"></label>
  <label>Role<select name="role"><option value="coach">Coach: write and edit reports</option><option value="admin">Admin: also delete records and manage coaches</option></select></label>
  </div><div class="line" style="margin-top:14px"><span class="note" id="inviteMsg" role="status"></span><button class="btn pri" type="submit">Create invite link</button></div></form>`;
}

export async function onClick(a, b) {
  if (!isAdmin()) return false;
  if (a === "backup") {
    try {
      const data = await store.backend().backup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
      const link = Object.assign(document.createElement("a"), { href: url, download: `padel-beast-portal-backup-${today()}.json` });
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast("Backup downloaded. Keep it private.");
    } catch (e) { toast(e.message || "Could not download the backup."); }
    return true;
  }
  if (a === "hidelink") { S.link = null; hooks.render(); return true; }
  if (a === "copylink") {
    const inp = $("#linkInput"); inp.select();
    try { await navigator.clipboard.writeText(inp.value); toast("Link copied"); } catch { toast("Press Cmd/Ctrl+C to copy"); }
    return true;
  }
  if (a === "link") {
    const c = D.coaches.find(x => x.user_id === b.dataset.id); S.confirm = null;
    try { const { token } = await store.manageCoach("link", { user_id: b.dataset.id }); S.link = { name: c?.name || "the coach", token }; } catch (e) { toast(e.message); }
    hooks.render(); scrollTo(0, 0); return true;
  }
  if (a === "deact" || a === "react") {
    S.confirm = null;
    try { await store.manageCoach(a === "deact" ? "deactivate" : "reactivate", { user_id: b.dataset.id }); toast(a === "deact" ? "Coach deactivated" : "Coach reactivated"); } catch (e) { toast(e.message); }
    hooks.render(); return true;
  }
  return false;
}

export async function onSubmit(f, e) {
  if (f.id !== "cform" || !isAdmin()) return false;
  e.preventDefault(); const fd = new FormData(f), msg = $("#inviteMsg"), btn = f.querySelector("button[type=submit]");
  btn.disabled = true; msg.textContent = "Creating…";
  try {
    const name = String(fd.get("name")).trim();
    const { token } = await store.manageCoach("invite", { name, email: String(fd.get("email")).trim().toLowerCase(), role: fd.get("role") });
    S.link = { name, token }; toast("Invite created. Copy the link and send it on WhatsApp."); hooks.render(); scrollTo(0, 0);
  } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  return true;
}
