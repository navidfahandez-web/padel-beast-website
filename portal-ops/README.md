# Padel Beast Coach Portal: setup guide (for Navid)

Live address once switched on: **thepadelbeast.com/coaches**

The portal runs on the same Netlify account as the website. There is **no separate database to sign up for**: the data lives in Netlify Blobs (the same kind of storage coachnavid.com uses), and one Netlify Function does the login and all the saving.

You need to do **one thing in Netlify** (add one secret), then create your own admin login. That's it.

## What's in this folder

| Path | What it is |
|---|---|
| `../netlify/functions/portal.mjs` and `../netlify/lib/portal-core.mjs` | The server: login, security rules, saving data |
| `../coaches/` | The portal screens |
| `content/` | Your methodology and session plans (imported into the portal, never public) |
| `scripts/import_seed.py` | One-off import of the current players and reports, and restore from a backup |
| `scripts/dev_server.py` | Runs the portal on your own computer in demo mode |
| `tests/` | Automatic checks of the server rules (`core-test.html`) and a full simulator (`sim.html`) |
| `SECURITY.md` | The security rules the portal follows |

This folder and the server source are **blocked from the public website** (`_redirects`), and `seed-data/` and `.env` are in `.gitignore`.

## 1. Add the setup key in Netlify (you do this)

1. Make up a long secret: at least 16 characters, ideally 30+ (for example 5 random words and some numbers). Save it in your password manager. It is **only** for first-time setup, importing data and locked-out recovery.
2. Netlify → your **Padel Beast** site → **Site configuration → Environment variables → Add a variable**
   - Key: `PORTAL_SETUP_KEY`
   - Value: the secret
   - Scopes: all, including Functions
3. Save. (Netlify applies it on the next deploy.)

Never send the key in chat. If you ever think it leaked, change it in Netlify.

## 2. Preview the portal on Netlify

The work is on the `coach-portal` branch. Netlify builds it on its own:

- Netlify → **Site configuration → Build & deploy → Branches** → add branch deploys for `coach-portal` (or open a pull request, which gets a Deploy Preview).
- The first build installs the storage package (`@netlify/blobs`), so it takes a minute longer.
- Netlify shows the preview address, for example `https://coach-portal--yoursite.netlify.app`.

**Note:** previews and the real site share the same storage. Anything you create in the preview (your admin, players) is also what the live site will use once it is merged. That is fine because nobody uses it yet.

## 3. Create your admin login

Open `<preview address>/coaches/first-admin` (or just `/coaches/`: it jumps there while no admin exists).
Enter the setup key, your name, your email, and **choose your own password** (10+ characters). You're in as admin.

This page stops working the moment the first admin exists.

## 4. Import the current data (on your computer)

1. Create a text file `portal-ops/.env` with two lines:

```
PORTAL_URL=https://coach-portal--yoursite.netlify.app
PORTAL_SETUP_KEY=the-same-secret-as-in-netlify
```

2. Put `export-2026-11-25.json` in `portal-ops/seed-data/`. If coaches added reports in the old tool after 25 Nov, ask for a fresh export first.
3. In Terminal:

```bash
cd "portal-ops"
python3 scripts/import_seed.py --skip-samples
```

It prints counts only (never names), and is safe to run twice. `--skip-samples` leaves out the sample lessons and the sample adult player.

4. Afterwards **delete `seed-data/` and `.env`**. Neither is ever committed.

## 5. Invite the coaches

Log in → **Coaches** → enter name and email → **Create invite link** → **Copy link** → send it to the coach **on WhatsApp**.

The coach opens it and **chooses their own password**. The link works once and expires after 7 days. You never see or send a password.

- **Coach forgot their password?** Coaches → **New link** next to their name, and send it again.
- **Coach leaves?** **Deactivate**. Their access stops on their very next click. Their past reports stay.
- **You're locked out (admin)?** On the login page: Forgot password → *I'm the admin and I'm locked out* → enter the setup key and your email.

## 6. Go live

1. Check the preview with real logins (see the checklist below).
2. Merge `coach-portal` into `main` (Claude can do this when you say so). Netlify deploys the live site by itself.
3. Add `PORTAL_URL=https://thepadelbeast.com` to your local `.env` only if you need to import again.

### Checklist before going live

- [ ] Logged out, `/coaches` shows only the login page and `/api/portal/all` answers "Please log in."
- [ ] A **coach** login has no Coaches screen and no Delete buttons
- [ ] A **deactivated** coach is refused at login
- [ ] The invite link lands on "Choose your password" and works only once
- [ ] A lesson saved on a phone shows up on a laptop login
- [ ] `thepadelbeast.com/coaches` is not in Google (`noindex` and `robots.txt` are in place)
- [ ] You downloaded a backup once and kept it somewhere private

## Backups (please read)

Netlify Blobs has **no automatic backups**. So the Coaches screen has a **Download backup** button: one file with every player, lesson, report and objective.

- Do it **every Sunday**, or before anything risky. Keep the file private (it contains children's information): not by email, not on a shared drive.
- To restore: put the file in `portal-ops/` and run `python3 scripts/import_seed.py --backup the-file.json` (needs `.env` as in step 4). Coaches aren't in a backup: invite them again if the portal was empty.

## Parents' consent (not code)

Parents should agree in writing that the academy keeps coaching notes and contact/medical details for the programme. Keep it with the sponsorship forms.

## Trying it on your own computer

```bash
python3 portal-ops/scripts/dev_server.py 8766
```

- `http://localhost:8766/coaches/login`: **demo mode** with fictional data (any email and password; an email containing "admin" is the admin). Resets on reload. Demo mode only ever runs on `localhost`.
- `http://localhost:8766/portal-ops/tests/sim.html#reset`: the **real** screens with the **real** server code against a fake in-memory store. Use it to try first-admin, invites and permissions. Setup key in the simulator: `sim-setup-key-0123456789`.
- `http://localhost:8766/portal-ops/tests/core-test.html`: runs the automatic checks of the server rules (about 100 checks, ~25 seconds).
