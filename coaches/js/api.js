// Backend facade. Two implementations with the same shape:
//   - Supabase (production)
//   - In-memory demo (ONLY on localhost, ONLY when Supabase is not configured) so the UI can be tried offline.
import { CONFIG } from "./config.js";

const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
export const configured = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
export const demo = !configured && LOCAL;

const ORDER = { coaches: ["user_id"], players: ["id"], lessons: ["id"], lesson_feedback: ["lesson_id", "player_id"], progress_reports: ["id"], objectives: ["id"], session_plans: ["id"], content: ["key"] };

function supabaseBackend() {
  const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return {
    auth: {
      async session() { const { data } = await sb.auth.getSession(); return data.session; },
      async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
      async signOut() { await sb.auth.signOut(); },
      async resetPassword(email) { await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/coaches/" }); },
      async updatePassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw error; },
      onChange(cb) { sb.auth.onAuthStateChange((event, session) => cb(event, session)); },
    },
    async list(table) {
      let all = [], from = 0;
      for (;;) {
        let q = sb.from(table).select("*");
        for (const c of ORDER[table] || []) q = q.order(c);
        const { data, error } = await q.range(from, from + 999);
        if (error) throw error;
        all = all.concat(data);
        if (data.length < 1000) return all;
        from += 1000;
      }
    },
    async upsert(table, rows, onConflict = "id") {
      const { error } = await sb.from(table).upsert(rows, { onConflict });
      if (error) throw error;
    },
    async remove(table, match) {
      let q = sb.from(table).delete();
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
      const { data, error } = await q.select();
      if (error) throw error;
      if (!data.length) throw new Error("Not allowed, or already deleted.");
    },
    async manage(action, payload) {
      const { data, error } = await sb.functions.invoke("manage-coach", { body: { action, ...payload } });
      if (error) {
        let msg = "Could not complete that.";
        try { msg = (await error.context.json()).error || msg; } catch { /* keep generic */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
    },
  };
}

export async function getBackend() {
  if (configured) return supabaseBackend();
  if (demo) return (await import("./demo.js")).demoBackend();
  return null; // not configured, not local: the UI shows a "not set up" message
}
