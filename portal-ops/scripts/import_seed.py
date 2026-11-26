#!/usr/bin/env python3
"""Load data into the Coach Portal: the old Player Reports export, or a backup file downloaded from the portal.
No packages needed (this Mac has no Node). Prints counts only, never names or notes.

Setup (on your own computer, never committed):
  1. Put the setup key (the same value as PORTAL_SETUP_KEY in Netlify) and the site address in portal-ops/.env:
       PORTAL_URL=https://thepadelbeast.com            (or the Netlify preview address while testing)
       PORTAL_SETUP_KEY=the-long-secret-you-chose-in-netlify
  2. Put the private export at portal-ops/seed-data/export-2026-11-25.json  (gitignored)

Usage (from the portal-ops folder):
  python3 scripts/import_seed.py --skip-samples        first import (recommended: leaves out the sample lessons)
  python3 scripts/import_seed.py --backup FILE.json    restore from a backup downloaded with "Download backup"
Safe to run twice: records are matched by id and overwritten.
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
url = (env.get("PORTAL_URL") or os.environ.get("PORTAL_URL") or "").rstrip("/")
key = env.get("PORTAL_SETUP_KEY") or os.environ.get("PORTAL_SETUP_KEY")
if not url or not key:
    sys.exit("Set PORTAL_URL and PORTAL_SETUP_KEY in portal-ops/.env")
if not url.startswith("https://") and not url.startswith("http://localhost"):
    sys.exit("PORTAL_URL must start with https://")
skip_samples = "--skip-samples" in sys.argv
def arg(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv and sys.argv.index(name) + 1 < len(sys.argv) else None

def upsert(table, rows, on_conflict=None):
    if not rows:
        print(f"{table}: 0"); return
    for i in range(0, len(rows), 100):
        req = urllib.request.Request(
            f"{url}/api/portal/import", data=json.dumps({"table": table, "rows": rows[i:i + 100]}).encode(), method="POST",
            headers={"Content-Type": "application/json", "X-Portal": "1", "X-Setup-Key": key, "User-Agent": "padel-beast-import"})
        try:
            urllib.request.urlopen(req, timeout=60)
        except urllib.error.HTTPError as e:
            try: msg = json.loads(e.read().decode()).get("error", "")
            except Exception: msg = ""
            sys.exit(f"{table} failed: HTTP {e.code} {msg}")
        except urllib.error.URLError as e:
            sys.exit(f"Could not reach {url}: {e.reason}")
    print(f"{table}: {len(rows)}")

# ----- restore mode: a backup downloaded from the portal -----
if arg("--backup"):
    bk = json.loads(Path(arg("--backup")).read_text())
    stamped = ("created_at", "created_by", "updated_at", "updated_by")
    clean = lambda rows: [{k: v for k, v in r.items() if k not in stamped} for r in rows]
    for t in ("players", "lessons", "lesson_feedback", "progress_reports", "objectives", "session_plans"):
        upsert(t, clean(bk.get(t, [])))
    upsert("content", bk.get("content", []))
    sys.exit("Restore done. Coaches are not part of a backup: invite them again from the Coaches screen if the portal was empty.")

def d(v): return v if v else None
def group_of(g): return g if g in ("A", "B", "C", "mixed", "adult") else None

exp = json.loads(Path(arg("--seed") or root / "seed-data" / "export-2026-11-25.json").read_text())
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
upsert("lesson_feedback", fb)

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
upsert("content", [{"key": "methodology", "data": meth}])
print("Done (sample records skipped)." if skip_samples else "Done (including sample records).")
