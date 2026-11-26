# Security and privacy rules (must follow)

The portal stores **children's data**: names, feedback, dates of birth, parents' phone numbers and medical notes. Treat it like health data.

## Accounts and passwords
- **Invite-only.** Public sign-up is disabled. Only an admin can invite a coach.
- **Each coach sets their own password** from the invite email. Nobody creates, stores, emails or messages passwords for someone else, and that includes Claude Code.
- Password reset by email ("Forgot password?").
- Minimum password length 10 (Supabase → Authentication → Policies). Recommend MFA (TOTP) for admins.
- Deactivating a coach (`coaches.active = false`) must cut their access immediately (RLS checks `active`). Also sign them out (Supabase admin `signOut` for that user) or delete the auth user if they leave.

## Roles
| Role | Can |
|---|---|
| `coach` | Read everything; add/edit players, lessons, feedback, progress reports, objectives, plans |
| `admin` | Everything a coach can, plus delete records and manage coaches |

First admin (run once in the SQL editor after Navid accepts his invite):
```sql
insert into coaches (user_id, name, email, role)
select id, 'Navid', email, 'admin' from auth.users where email = 'NAVID_EMAIL_HERE';
```

## Database
- **Row-level security is ON for every table** (see `database/schema.sql`). Every policy checks `is_coach()` / `is_admin()`, which require an **active** row in `coaches` for `auth.uid()`.
- The **anon key** in the browser is fine because of RLS. The **service-role key** bypasses RLS: use it only in server functions and the local import script, never in front-end code or git.
- Test it: with the anon key and no session, `select * from players` must return 0 rows. With a deactivated coach's session, also 0.

## Website
- `/coaches/*`: `<meta name="robots" content="noindex,nofollow">`, `Disallow: /coaches` in robots.txt, not in the sitemap.
- HTTPS only. Session cookies `Secure`, `HttpOnly` where the framework allows (Next.js + `@supabase/ssr`).
- No children's data in analytics, logs, error trackers (Sentry etc.), URLs or query strings.
- Use IDs in URLs (`/coaches/players/jr01`), never names.

## Data files
- `seed-data/` must never be committed or deployed. Add to `.gitignore`:
  ```
  padel-beast-coach-portal/seed-data/
  .env
  ```
- Delete local copies of the export after the import is verified.

## Backups
- Supabase Pro includes daily backups; on the Free plan, schedule a weekly `pg_dump` (or Supabase CLI `db dump`) to a private location Navid controls. Tell Navid which.

## Consent (for Navid, not code)
- Parents should agree in writing that the academy keeps coaching notes and contact/medical details for their child for the programme. Keep it with the sponsorship forms.
