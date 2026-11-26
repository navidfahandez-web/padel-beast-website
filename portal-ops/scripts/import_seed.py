#!/usr/bin/env python3
"""Import the Player Reports export + methodology + session plans into Supabase.
Python port of the brief's import-seed.mjs (this Mac has no Node). No packages needed.

Usage (from the portal-ops folder):
  1. Create portal-ops/.env  (never commit it) with:
       SUPABASE_URL=https://xxxx.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=...        <- keep this secret
  2. Put the private export at portal-ops/seed-data/export-2026-11-25.json  (gitignored)
  3. python3 scripts/import_seed.py --skip-samples     (recommended)
Safe to run twice: it upserts by id. Prints counts only, never names or notes.
"""
import json, os, sys, urllib.request, urllib.error
from pathlib import Path

root = Path(__file__).resolve().parent.parent
env = {}
envfile = root / ".env"
if envfile.exists():
    for line in envfile.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1); env[k.strip()] = v.strip().strip('"').strip("'")
url = (env.get("SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "").rstrip("/")
key = env.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not url or not key:
    sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in portal-ops/.env")
skip_samples = "--skip-samples" in sys.argv

def upsert(table, rows, on_conflict="id"):
    if not rows:
        print(f"{table}: 0"); return
    for i in range(0, len(rows), 200):
        batch = rows[i:i + 200]
        req = urllib.request.Request(
            f"{url}/rest/v1/{table}?on_conflict={on_conflict}", data=json.dumps(batch).encode(), method="POST",
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                     "Prefer": "resolution=merge-duplicates,return=minimal"})
        try:
            urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:
            sys.exit(f"{table} failed: HTTP {e.code} {e.read().decode()[:300]}")
    print(f"{table}: {len(rows)}")

def d(v): return v if v else None
def group_of(g): return g if g in ("A", "B", "C", "mixed", "adult") else None

exp = json.loads((root / "seed-data" / "export-2026-11-25.json").read_text())
plans = json.loads((root / "content" / "session-plans.json").read_text())["plans"]
meth = json.loads((root / "content" / "methodology.json").read_text())
keep = lambda r: not (skip_samples and r.get("sample"))

players = [p for p in exp["players"] if keep(p)]
player_ids = {p["id"] for p in players}
upsert("players", [{
    "id": p["id"], "name": p["name"], "level": p.get("level") or 1, "program": p.get("program") or "Private VIP",
    "junior_group": p.get("group") if p.get("group") in ("A", "B", "C") else None,
    "main_coach": d(p.get("coach")), "side": d(p.get("side")), "hand": d(p.get("hand")),
    "start_date": d(p.get("start")), "goal": d(p.get("goal")), "health_notes": d(p.get("health")),
    "dob": d(p.get("dob")), "school": d(p.get("school")), "parent_name": d(p.get("parent")),
    "parent_phone": d(p.get("phone")), "kit_size": d(p.get("kit")), "milestones": p.get("milestones") or {},
    "level_history": p.get("history") or [], "is_sample": bool(p.get("sample"))} for p in players])

lessons = [l for l in exp["lessons"] if keep(l)]
upsert("lessons", [{
    "id": l["id"], "date": l["date"], "coach_name": l.get("coach") or "Unknown", "group_code": group_of(l.get("group")),
    "module": None if l.get("module") in ("", None) else int(l["module"]), "training": d(l.get("training")),
    "focus": d(l.get("focus")), "objectives": d(l.get("objectives")), "summary": l.get("summary") or "",
    "exercises": l.get("exercises") or [], "is_sample": bool(l.get("sample"))} for l in lessons])

fb = []
for l in lessons:
    for pid, f in (l.get("fb") or {}).items():
        if pid not in player_ids: continue
        fb.append({"lesson_id": l["id"], "player_id": pid, "attendance": f.get("present") or "Present",
                   "rating": int(f.get("rating") or 0), "comment": d(f.get("comment")),
                   "improve": d(f.get("improve")), "next_focus": d(f.get("next"))})
upsert("lesson_feedback", fb, "lesson_id,player_id")

upsert("progress_reports", [{
    "id": r["id"], "player_id": r["playerId"], "date": r["date"], "type": d(r.get("type")), "coach_name": d(r.get("coach")),
    "pillars": r.get("pillars") or {}, "match": {k: v for k, v in (r.get("match") or {}).items() if v not in ("", None)},
    "strengths": d(r.get("strengths")), "improve": r.get("improve") or [], "improve_notes": d(r.get("improveNotes")),
    "next_focus": d(r.get("nextFocus")), "homework": d(r.get("homework")), "injury": d(r.get("injury")),
    "is_sample": bool(r.get("sample"))}
    for r in exp.get("progressReports", []) if keep(r) and r["playerId"] in player_ids])

upsert("objectives", [{
    "id": o["id"], "player_id": o["playerId"], "kind": o["kind"], "title": o["title"], "target": d(o.get("target")),
    "due": d(o.get("due")), "status": o.get("status") or "Open", "tournament_date": d(o.get("date")),
    "category": d(o.get("category")), "partner": d(o.get("partner")), "result": o.get("result") or "—",
    "is_sample": bool(o.get("sample"))}
    for o in exp.get("objectives", []) if keep(o) and o["playerId"] in player_ids])

upsert("session_plans", [{"id": p["id"], "module": p["module"], "training": p["training"], "objectives": p["objectives"],
                          "exercises": p["exercises"], "updated_by_name": p.get("updatedBy") or "Navid"} for p in plans])
upsert("content", [{"key": "methodology", "data": meth}], "key")
print("Done (sample records skipped)." if skip_samples else "Done (including sample records).")
