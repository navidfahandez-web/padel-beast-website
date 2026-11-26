# Padel Beast Coach Portal: setup guide (for Navid)

Live address once switched on: **thepadelbeast.com/coaches**

The portal is built and tested with fictional demo data. To make it real you create the database
yourself (about 30 minutes), then send Claude two public values. Nobody but you ever sees a password
or the secret key.

## What's in this folder

| Path | What it is |
|---|---|
| `database/01-schema.sql` | All tables and the security rules (row-level security) |
| `database/02-content.sql` | A login-only table for your methodology (levels, drills, junior modules) |
| `functions/manage-coach/` | The small server function that invites, deactivates and reactivates coaches |
| `content/` | Methodology and session-plan files that get imported into the database |
| `scripts/import_seed.py` | One-off import of the current players and reports |
| `scripts/dev_server.py` | Runs the portal on your own computer for testing |
| `SECURITY.md` | The security rules the portal follows |

This folder is **blocked from the public website** (`_redirects`), and `seed-data/` and `.env` are in `.gitignore`.

## 1. Create the Supabase project (you do this)

1. Go to supabase.com and sign up. The Free plan is enough to start.
2. **New project.** Name it `padel-beast-portal`. Choose a region close to Abu Dhabi (Frankfurt or Mumbai). Save the database password in your password manager.
3. **Authentication → Providers → Email:** turn **off** "Allow new users to sign up" (invite-only). Keep email on.
4. **Authentication → Policies (or Sign In / Providers → Email):** set minimum password length to **10**.
5. **Authentication → URL Configuration:**
   - Site URL: `https://thepadelbeast.com/coaches/`
   - Redirect URLs: add `https://thepadelbeast.com/coaches/` and `https://thepadelbeast.com/coaches/login`
6. **Authentication → Emails:** the built-in sender is rate-limited (a few emails per hour). Fine for inviting 4 coaches. Later, add a custom SMTP sender (for example Resend) for reliability.

## 2. Create the tables

**SQL Editor → New query.** Paste the whole of `database/01-schema.sql`, Run. Then paste `database/02-content.sql`, Run.

Test: in the SQL editor run `select count(*) from players;` (0 is correct). Under **Authentication → Policies** every table should show RLS enabled.

## 3. Deploy the invite function

This is what lets an admin invite coaches from the portal without ever touching the secret key in a browser.

1. **Edge Functions → Deploy a new function → Via editor.** Name it exactly `manage-coach`.
2. Paste the contents of `functions/manage-coach/index.ts`.
3. Keep **Verify JWT** switched **on**. Deploy.

(The function reads `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` automatically. You don't set them.)

## 4. Make yourself the first admin

1. **Authentication → Users → Invite user.** Enter your email. Open the email, click the link, choose your own password (10+ characters).
2. **SQL Editor**, run this once with your real email:

```sql
insert into coaches (user_id, name, email, role)
select id, 'Navid', email, 'admin' from auth.users where email = 'YOUR_EMAIL_HERE';
```

3. **Recommended:** turn on two-factor (TOTP) for your own login once you're in.

## 5. Send Claude two values

From **Project Settings → API**:

- **Project URL** (`https://xxxx.supabase.co`)
- **anon / publishable key**. This one is meant to be public; the security rules protect the data.

**Never send the `service_role` key** in chat. It goes only in the next step, on your own computer.

Claude puts those two values into `coaches/js/config.js` and pushes the branch.

## 6. Import the current data (on your computer)

1. Create a text file `portal-ops/.env` with two lines:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=paste-the-service_role-key-here
```

2. Put `export-2026-11-25.json` in `portal-ops/seed-data/`. If coaches have added reports in the old tool since 25 Nov, ask for a fresh export first.
3. In Terminal:

```bash
cd "portal-ops"
python3 scripts/import_seed.py --skip-samples
```

It prints counts only (never names). It is safe to run twice. `--skip-samples` leaves out the sample lessons and the sample adult player.

4. When it has worked, **delete `seed-data/` and `.env`** (or at least the key). Neither is ever committed.

## 7. Invite the coaches

Log in at `/coaches/login`, open **Coaches**, enter name and email, **Send invite**. Each coach gets an email and sets **their own password**. To remove someone, press **Deactivate**: their access stops immediately and their past reports stay.
"Forgot password?" on the login page covers resets.

## 8. Preview, then go live

- The work is on the `coach-portal` git branch. Netlify can build a preview for it (Site settings → Build & deploy → Branches → add `coach-portal`, or open the pull request, which gets a Deploy Preview).
- Check the preview with real logins first (see the checklist below).
- Going live = merging `coach-portal` into `main`. Netlify deploys by itself. Don't merge before steps 1–6 are done: until `config.js` has the Supabase values, the live page only says the portal isn't switched on.

### Checklist before going live

- [ ] Logged out, the Supabase API returns nothing: `select * from players` with the anon key and no login gives 0 rows
- [ ] A **coach** login can't see the Coaches screen and has no Delete buttons
- [ ] A **deactivated** coach is refused at login
- [ ] Invite email arrives and the link lands on the "choose your password" screen
- [ ] "Forgot password?" email arrives and works
- [ ] `thepadelbeast.com/coaches` is not in Google (`noindex` + `robots.txt` are in place)
- [ ] A lesson saved on a phone shows up on a laptop login

## Backups

- **Free plan:** no automatic backups. Run a weekly dump to a private folder only you control (needs the Supabase CLI and the database password): `supabase db dump --db-url "postgresql://…" -f backup.sql`.
- **Pro plan** ($25/month): daily backups included. Worth it once real lesson history matters.

## Parents' consent (not code)

Parents should agree in writing that the academy keeps coaching notes and contact/medical details for the programme. Keep it with the sponsorship forms.

## Running it on your computer (demo mode)

```bash
python3 portal-ops/scripts/dev_server.py 8766
```

Then open `http://localhost:8766/coaches/login`. While `config.js` is empty it runs on fictional demo data stored only in memory. Demo mode never switches on anywhere except `localhost`.
