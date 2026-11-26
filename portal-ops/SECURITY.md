# Security and privacy rules (must follow)

The portal stores **children's data**: names, feedback, dates of birth, parents' phone numbers and medical notes. Treat it like health data.

## Accounts and passwords
- **Invite-only.** There is no public sign-up. Only an active admin can invite a coach.
- **Each coach sets their own password** from a one-time link. Nobody creates, stores, sends or sees a password for someone else, and that includes Claude Code. The admin only hands over the link (by WhatsApp).
- Links are random 256-bit tokens, shown once, stored only as a SHA-256 hash, valid 7 days, and work once. They live in the URL fragment (`#t=`), so they are not sent to any server and not written to logs.
- Passwords: at least 10 characters, stored only as PBKDF2-SHA256 (600,000 iterations, per-password salt). They never leave the server and are never returned by any endpoint.
- "Forgot password" = the admin makes a new link (Coaches → New link). Changing a password signs out all of that coach's other sessions.
- Locked-out admin: recovery with the setup key (`PORTAL_SETUP_KEY`, a secret only Navid holds, set in Netlify).
- Recommended: Navid uses a long passphrase from a password manager.

## Sessions
- Random 256-bit session token in an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/portal`. Only its hash is stored. Sessions last 14 days.
- **Deactivating a coach cuts access on their very next request**: every request re-checks that the coach is still active and that the password hasn't changed.
- Logging out deletes the session on the server and clears the screen's data from memory.
- Login is rate limited: 8 wrong passwords lock that email for 15 minutes, 40 per address. Unknown emails and wrong passwords give the same message and take the same time.

## Roles
| Role | Can |
|---|---|
| `coach` | Read everything; add/edit players, lessons, feedback, progress reports, objectives, plans; remove a player from a lesson |
| `admin` | Everything a coach can, plus delete records, manage coaches, download a backup |

Enforced on the **server** for every request (there is no database-level security in Netlify Blobs, so `netlify/lib/portal-core.mjs` is the access control). The browser can never be trusted: the checks run again server-side even if a screen hides a button.
- An admin cannot deactivate themselves, and the last active admin can't be deactivated.
- All writes are validated: only known fields, types, lengths and allowed values; records can only point at players and lessons that exist.
- Concurrent saves use compare-and-swap (etags), so two coaches saving at once never overwrite each other.

## Setup key
- `PORTAL_SETUP_KEY` (Netlify environment variable, 16+ characters) guards only: creating the first admin, admin recovery, and the one-off data import. Wrong guesses are rate limited (10 per address per 15 minutes).
- It is never in the repo, never in the browser's code, and never sent in chat.
- After the first admin exists and data is imported, it can stay (needed for recovery/restore) or be removed.

## Website
- `/coaches/*`: `<meta name="robots" content="noindex,nofollow">`, `X-Robots-Tag: noindex`, `Disallow: /coaches` in robots.txt, not in a sitemap, `Cache-Control: no-store`, `X-Frame-Options: DENY`.
- All API responses are `no-store`. State-changing requests need a custom header and a matching Origin (CSRF protection on top of `SameSite=Strict`).
- HTTPS only (Netlify).
- No children's data in analytics, logs, error trackers, URLs or query strings. The server logs only error *names*, never messages or data. Forms can never submit natively into the URL.
- Use IDs in URLs (`/coaches/players/<id>`), never names.
- `portal-ops/`, `netlify/`, `package.json`, `netlify.toml` are blocked from the public site (`_redirects`).
- Methodology content is stored behind login (it is Navid's coaching IP), not in a public file.

## Data files
- `seed-data/` must never be committed or deployed (it is in `.gitignore`), and `.env` too.
- Delete local copies of the export and the `.env` after the import is verified.
- Backup files contain children's data: keep them private, never email or upload them publicly.

## Backups
- Netlify Blobs has no automatic backups. Admin → Coaches → **Download backup** every week, keep it private. Restore with `python3 scripts/import_seed.py --backup FILE`.

## Known limits (honest list)
- Anyone with an active coach login can read every player (that is the design: coaches rotate between groups).
- Netlify Blobs is a simple key-value store with no built-in audit log. Rows record who last changed them (`updated_by`) and when, but there is no history of old versions: use backups.
- Previews and production share one storage, so only use real children's data once the portal is live on the real address.

## Consent (for Navid, not code)
- Parents should agree in writing that the academy keeps coaching notes and contact/medical details for their child for the programme. Keep it with the sponsorship forms.
