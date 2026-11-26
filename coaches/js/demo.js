// LOCAL DEMO ONLY (api.js only loads this on localhost when Supabase is not configured).
// All names and data below are fictional. Nothing is saved: a reload resets it.
const clone = x => JSON.parse(JSON.stringify(x));
const PK = { coaches: ["user_id"], players: ["id"], lessons: ["id"], lesson_feedback: ["lesson_id", "player_id"], progress_reports: ["id"], objectives: ["id"], session_plans: ["id"], content: ["key"] };

export async function demoBackend() {
  const get = async p => (await fetch(p)).json();
  const meth = await get("/portal-ops/content/methodology.json");
  const plans = (await get("/portal-ops/content/session-plans.json")).plans;
  const now = new Date(), iso = n => new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
  const jr = (id, name, group, level = 1, extra = {}) => ({ id, name, level, program: "Junior programme", junior_group: group, main_coach: null, side: "Both", hand: "Right", start_date: "2026-10-01", goal: "Enjoy padel", health_notes: null, dob: "2015-05-01", school: "Demo School", parent_name: "Parent Demo", parent_phone: "000 000 000", kit_size: "M", milestones: {}, level_history: [], is_sample: false, ...extra });
  const T = {
    coaches: [
      { user_id: "demo-admin", name: "Demo Admin", email: "admin@demo.test", role: "admin", active: true },
      { user_id: "demo-coach", name: "Demo Coach", email: "coach@demo.test", role: "coach", active: true },
    ],
    players: [
      jr("dj01", "Alex Demo", "A"), jr("dj02", "Bailey Demo", "A", 1, { health_notes: "Demo note: tight calf, no sprints" }), jr("dj03", "Casey Demo", "A"),
      jr("dj04", "Drew Demo", "B", 2), jr("dj05", "Emery Demo", "B"), jr("dj06", "Frankie Demo", "C", 2),
      { ...jr("da01", "Demo Adult", null, 2), program: "Private VIP", dob: null, school: null, parent_name: null, parent_phone: null, kit_size: null, main_coach: "Demo Coach", goal: "Reach L3", milestones: { "2_0": true, "2_1": true } },
    ],
    lessons: [
      { id: "dl1", date: iso(14), coach_id: "demo-coach", coach_name: "Demo Coach", group_code: "A", module: 0, training: "T1", focus: "Assessment & intro to padel rules", objectives: "Know the court", summary: "Warm-up, court tour, mini rallies.", exercises: [{ name: "Court tour", min: "10", obj: "Know the lines" }], created_at: iso(14) },
      { id: "dl2", date: iso(7), coach_id: "demo-admin", coach_name: "Demo Admin", group_code: "A", module: 0, training: "T2", focus: "Grip & ready position", objectives: "Hold the racket correctly", summary: "Grip games and ready-position relay.", exercises: [], created_at: iso(7) },
    ],
    lesson_feedback: [
      { lesson_id: "dl1", player_id: "dj01", attendance: "Present", rating: 3, comment: "Good focus. Listened well.", improve: "Ready position", next_focus: "Grip" },
      { lesson_id: "dl1", player_id: "dj02", attendance: "Late", rating: 4, comment: "Great effort.", improve: "", next_focus: "Footwork" },
      { lesson_id: "dl2", player_id: "dj01", attendance: "Present", rating: 4, comment: "Improved since last lesson.", improve: "Grip", next_focus: "Forehand" },
      { lesson_id: "dl2", player_id: "dj03", attendance: "Absent", rating: 0, comment: "", improve: "", next_focus: "" },
    ],
    progress_reports: [
      { id: "dr1", player_id: "da01", date: iso(60), type: "Level test", coach_name: "Demo Coach", pillars: { position: 4, placement: 5, decision: 4, technique: 5, durability: 6 }, match: { errors: 5.1, optimal: 30, back: 45, rally: 6 }, strengths: "Good hands", improve: ["Too close to the net (stay 2–3 m)"], improve_notes: "", next_focus: "Positioning", homework: "Feet Zone", injury: "", created_at: iso(60) },
      { id: "dr2", player_id: "da01", date: iso(10), type: "Monthly progress review", coach_name: "Demo Admin", pillars: { position: 6, placement: 6, decision: 5, technique: 6, durability: 7 }, match: { errors: 4.6, optimal: 34, back: 41, rally: 6.4 }, strengths: "Better net presence", improve: [], improve_notes: "", next_focus: "Bandeja", homework: "", injury: "", created_at: iso(10) },
    ],
    objectives: [
      { id: "do1", player_id: "da01", kind: "Technique", title: "Bandeja Corner 6/10", target: "6/10", due: iso(-30), status: "In progress", result: "—" },
      { id: "do2", player_id: "da01", kind: "Tournament", title: "Demo Winter Open", target: null, due: null, status: "Registered", tournament_date: iso(-20), category: "Men's C", partner: "A. Partner", result: "—" },
    ],
    session_plans: plans.map(p => ({ id: p.id, module: p.module, training: p.training, objectives: p.objectives, exercises: p.exercises, updated_by_name: p.updatedBy })),
    content: [{ key: "methodology", data: meth }],
  };
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem("pb_demo_user")); } catch { /* none */ }
  const listeners = [];
  const meRole = () => (T.coaches.find(c => c.user_id === user?.id) || {}).role;
  const emit = (ev, s) => listeners.forEach(f => f(ev, s));

  return {
    auth: {
      async session() { return user ? { user } : null; },
      async signIn(email, password) {
        if (!email || !password) throw new Error("Invalid login credentials");
        user = { id: /admin/i.test(email) ? "demo-admin" : "demo-coach", email };
        sessionStorage.setItem("pb_demo_user", JSON.stringify(user)); emit("SIGNED_IN", { user });
      },
      async signOut() { user = null; sessionStorage.removeItem("pb_demo_user"); emit("SIGNED_OUT", null); },
      async resetPassword() { /* demo: pretend */ },
      async updatePassword() { /* demo */ },
      onChange(cb) { listeners.push(cb); },
    },
    async list(table) { await new Promise(r => setTimeout(r, 60)); return clone(T[table] || []); },
    async upsert(table, rows, onConflict) {
      const keys = (onConflict ? onConflict.split(",") : PK[table]).map(s => s.trim());
      for (const r of clone(rows)) {
        const i = T[table].findIndex(x => keys.every(k => x[k] === r[k]));
        if (i < 0) T[table].push({ created_at: new Date().toISOString(), ...r }); else T[table][i] = { ...T[table][i], ...r };
      }
    },
    async remove(table, match) {
      if (table !== "lesson_feedback" && meRole() !== "admin") throw new Error("Not allowed, or already deleted.");
      const hit = x => Object.entries(match).every(([k, v]) => x[k] === v);
      const before = T[table].length; T[table] = T[table].filter(x => !hit(x));
      if (T[table].length === before) throw new Error("Not allowed, or already deleted.");
      if (table === "players") for (const t of ["lesson_feedback", "progress_reports", "objectives"]) T[t] = T[t].filter(x => x.player_id !== match.id);
      if (table === "lessons") T.lesson_feedback = T.lesson_feedback.filter(x => x.lesson_id !== match.id);
    },
    async manage(action, p) {
      if (meRole() !== "admin") throw new Error("Admins only");
      if (action === "invite") T.coaches.push({ user_id: "demo-" + p.email, name: p.name, email: p.email, role: p.role === "admin" ? "admin" : "coach", active: true });
      else { const c = T.coaches.find(x => x.user_id === p.user_id); if (c) c.active = action === "reactivate"; }
    },
  };
}
