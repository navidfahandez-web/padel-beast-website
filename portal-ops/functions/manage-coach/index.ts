// Supabase Edge Function: manage-coach
// Lets an ACTIVE ADMIN invite, deactivate or reactivate a coach. Runs server-side with the
// service-role key (injected by Supabase, never exposed to the browser).
// Deploy: Supabase dashboard > Edge Functions > Deploy a new function > paste this file, keep "Verify JWT" ON.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://thepadelbeast.com/coaches/";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Who is calling? Use their own token.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Not signed in" }, 401);

  // 2. Are they an active admin?
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: me } = await admin.from("coaches").select("role, active").eq("user_id", user.id).maybeSingle();
  if (!me || !me.active || me.role !== "admin") return json({ error: "Admins only" }, 403);

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const action = body.action;

  if (action === "invite") {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = body.role === "admin" ? "admin" : "coach";
    if (!name || name.length > 80) return json({ error: "Enter the coach's name" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email" }, 400);

    const { data: existing } = await admin.from("coaches").select("user_id").eq("email", email).maybeSingle();
    if (existing) return json({ error: "That email is already a coach. Use Reactivate if they are inactive." }, 409);

    // The coach receives an email and sets their OWN password. Nobody creates or sees it.
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: SITE, data: { name } });
    if (error || !data?.user) return json({ error: error?.message ?? "Could not send the invite" }, 400);
    const { error: e2 } = await admin.from("coaches").insert({ user_id: data.user.id, name, email, role });
    if (e2) return json({ error: e2.message }, 400);
    return json({ ok: true });
  }

  if (action === "deactivate" || action === "reactivate") {
    const target = String(body.user_id ?? "");
    if (!target) return json({ error: "Missing coach" }, 400);
    if (target === user.id && action === "deactivate") return json({ error: "You can't deactivate yourself" }, 400);
    const active = action === "reactivate";
    const { error } = await admin.from("coaches").update({ active }).eq("user_id", target);
    if (error) return json({ error: error.message }, 400);
    // Data access is cut instantly by row-level security; banning also blocks new sign-ins.
    await admin.auth.admin.updateUserById(target, { ban_duration: active ? "none" : "876000h" });
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
