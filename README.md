# Personal Workout Tracker

A mobile-first React and TypeScript workout application for the approved Office and Home three-day strength programs. It uses Supabase passwordless email authentication and Row Level Security so completed workouts, performed substitutions, and every set log stay private and synchronized across devices.

## What is implemented

- **Workout dashboard:** current Monday-through-Sunday workout count, Office/Home choice, manual Day 1–3 choice, recent workout, and the four exercises excluded from the next session.
- **Workout preview:** exact exercise order, first superset, sets and rep targets, unavailable-exercise warnings, and mandatory same-category replacements before starting.
- **Active workout:** Superset A/B round order, three editable set rows per exercise, load-mode-specific inputs, reps, effort, completion state, set notes, previous performance, equipment, form cues, and substitutions before the first completed set.
- **Autosave and resume:** an immediate same-device draft plus a debounced synchronized Supabase draft. Drafts never affect exclusions.
- **Review and completion:** incomplete-set warning, workout notes, final confirmation, concise summary, and a newly calculated global exclusion list.
- **History:** month calendar, full completed-workout records, substitutions, set details, corrections, and confirmed deletion.
- **Progress:** exercise-specific load or estimated-band-resistance charts, rep and effort charts, full set history, last performance, personal records, and weekly/monthly summaries.
- **Programs:** all six fixed templates and both location-specific substitution pools.
- **Account:** magic-link sign-in, current account, fixed pound unit, effort reference, and sign-out.

Hash navigation is used, so URLs such as `https://USERNAME.github.io/REPOSITORY/#/history` remain GitHub Pages-compatible after a refresh.

## Technology

- React 19
- TypeScript
- Vite
- Supabase Auth and Postgres Data API
- GitHub Actions and GitHub Pages
- Node's built-in test runner with TypeScript support through `tsx`

No Supabase service-role or secret key is used by the browser. The client only receives the Supabase project URL and publishable key.

## 1. Local setup

Requirements: Node.js 20.19 or newer. The included GitHub workflow uses Node.js 22.

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Then run:

```bash
npm test
npm run dev
```

Open the local URL printed by Vite. Add that exact local URL to Supabase's allowed redirect list as described below.

## 2. Create and configure Supabase

### Create the database

1. Create a Supabase project.
2. In the Supabase dashboard, open **SQL Editor** and create a new query.
3. Copy the complete contents of [`supabase/migrations/202608230001_initial_workout_schema.sql`](supabase/migrations/202608230001_initial_workout_schema.sql) into the editor.
4. Select **Run** once.
5. In **Table Editor**, confirm these six tables exist:
   - `exercises`
   - `workout_templates`
   - `workout_template_slots`
   - `workout_sessions`
   - `session_exercises`
   - `set_logs`

The migration seeds 47 stable exercise records, all six fixed templates, and all 24 template slots. It also adds database validation for ownership, location compatibility, same-category substitutions, inherited slot rules, unique exercises, and required set data.

### Enable passwordless email magic links

1. Open **Authentication → Providers → Email**.
2. Enable the Email provider.
3. Keep email confirmations enabled. The default Supabase magic-link template works when it contains the confirmation link variable.
4. Open **Authentication → URL Configuration**.
5. Set **Site URL** to the final GitHub Pages root URL, including the repository path and trailing slash:

   ```text
   https://USERNAME.github.io/REPOSITORY/
   ```

6. Under **Redirect URLs**, add both:

   ```text
   https://USERNAME.github.io/REPOSITORY/
   http://localhost:5173/**
   ```

   If Vite starts on a different local port, add that exact origin too. If you later use a custom domain, update the Site URL and add the custom-domain URL to Redirect URLs before testing magic links there.

Do not add `#/workout` to the Supabase redirect entry. Supabase returns to the application root, then the app switches to its hash route after the authenticated session is established.

### Get the two client values

1. Open the Supabase project's **Connect** dialog or **Project Settings → API**.
2. Copy the project URL into `VITE_SUPABASE_URL`.
3. Copy the **publishable key** into `VITE_SUPABASE_PUBLISHABLE_KEY`. A legacy `anon` key also works if the project still presents that format.
4. Never use a secret key or legacy `service_role` key in `.env`, GitHub Actions, or client code.

### Security model

The migration enables Row Level Security on every exposed table, revokes default anonymous access, and grants signed-in users only the operations needed by the app.

- Exercise and template tables are read-only to authenticated users.
- `workout_sessions`, `session_exercises`, and `set_logs` carry `user_id`.
- Separate `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies require `(select auth.uid()) = user_id`.
- Child-row validation requires ownership to match the securely related parent record.
- Exclusions are derived from the most recent completed session, so drafts and abandoned workouts cannot replace the exclusion state.
- Deleting or correcting history immediately changes progress calculations; deleting the latest workout causes exclusions to derive from the next-most-recent completed workout.

## 3. Deploy through GitHub Pages

### Put the project in GitHub

1. Create a new empty GitHub repository.
2. Put the contents of this project at the repository root. `package.json` and `index.html` should be at the top level.
3. Commit and push the files to the `main` branch.

### Add the build variables

In the GitHub repository:

1. Open **Settings → Secrets and variables → Actions → Variables**.
2. Add repository variable `VITE_SUPABASE_URL` with the Supabase project URL.
3. Add repository variable `VITE_SUPABASE_PUBLISHABLE_KEY` with the publishable key.

These values are intentionally client-visible. Row Level Security, not key secrecy, protects each user's records.

### Turn on GitHub Pages deployment

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`, or open **Actions → Test and deploy to GitHub Pages → Run workflow**.
4. The workflow installs exact lockfile dependencies, runs all automated tests, runs the production build, uploads `dist`, and deploys it to Pages.
5. When the workflow completes, open the URL shown in the `github-pages` deployment environment.
6. Confirm that this same root URL is the Site URL and an allowed Redirect URL in Supabase.

The deployment workflow is [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

## Required environment variables

| Variable | Local location | GitHub location | Purpose |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env.local` | Actions repository variable | Supabase project origin |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env.local` | Actions repository variable | Browser-safe Supabase API key |

Vite embeds variables beginning with `VITE_` in the browser bundle. Never create a `VITE_` variable containing a database password, secret key, or service-role credential.

## Tests and production build

Run both before committing:

```bash
npm test
npm run build
```

The automated tests cover:

- cross-location exclusions from the most recent completed workout;
- drafts not affecting exclusions;
- same-category substitution validation and subtype preference;
- inherited position, set count, superset, and rep range;
- blocked excluded and already-selected substitutes;
- every load-entry mode;
- all six approved templates and all 24 exact slots;
- authenticated-user RLS policy coverage for all workout-history tables;
- publishable-key-only deployment configuration; and
- relative Vite assets plus refresh-safe hash navigation for GitHub Pages.

## Demonstration links

No unverified demonstration URL is fabricated. Every catalog entry currently stores `null`, and the interface displays **“Demonstration link not added.”** See [`DEMONSTRATION_LINKS.md`](DEMONSTRATION_LINKS.md) for the complete verification list.

## Current assumptions and limitations

- Pounds are the only weight unit in version 1.
- Exercises are fixed by the approved catalog. This version does not include catalog editing.
- The normal target is three workouts per Monday-through-Sunday week. A fourth workout is allowed only after a prominent confirmation.
- The app does not prescribe, infer, or automatically increase weight.
- Band charts use only the entered estimated resistance. The exact band description remains attached to every historical set.
- Bodyweight progress shows reps and effort. It never invents a weight value.
- Autosave writes immediately to the device and synchronizes after a short debounce. If the device is offline, the draft remains resumable there and synchronizes after a later edit when connectivity returns.
- If the same draft is edited simultaneously on two devices, the last synchronized edit wins. Completed workout history remains synchronized and protected by RLS.
- The database migration must be applied before the first authenticated data request. The app cannot create tables with a browser key.
- No estimated one-rep maximum, workout timer, nutrition, social, gamification, or unrelated feature is included.
