# LG CubeSat Hardware Library

One place for every hardware part on the satellite: projects, folders, components, KiCad files, Onshape links, weekly updates and comments. Only `@lgsstudent.org` accounts can sign in.

Built with Next.js 16 on Vercel and Supabase (database, sign-in, file storage). Both run on free plans.

## How it works

- **Projects** are hardware areas (ADCS, Biomission, EPS…). Anyone can create and edit projects and folders. Folders nest.
- **Components** belong to one owner. The owner, people they add as editors, and the admin can change a component, post its updates and upload files. Anyone can comment.
- **Weekly updates** are three lines per component: done, next and blocked. A component goes amber after 7 days without an update and red after 14, or red at once when its latest update lists a blocker.
- **Weekly meetings** have a page per week with the slides link and every update from that week.
- **Trash**: deleting moves things to the trash. Only the admin can restore. Every change is in the activity log on the Admin page.
- The permission rules live in the database (`supabase/migrations`), so they hold even if someone calls the API directly. `supabase/tests/permissions.test.sql` checks them.

## Run it on your computer

Needs Node 20+ and Docker.

```bash
npm install
npx supabase start          # local database, sign-in and storage
cp .env.example .env.local  # then paste the ANON_KEY that `npx supabase status` prints
npx supabase db reset       # loads the schema and fictional test data
npm run dev
```

Sign in at http://localhost:3000 with `alex.rivera@lgsstudent.org` (the test admin). The sign-in email shows up at http://127.0.0.1:54324.

Checks: `npx supabase test db` (permission rules), `npm run lint`, `npm run build`.

## Put it online (one time)

Do these in order. **Sign in yourself first** in step 4: the first person to sign in becomes the admin.

1. **Supabase**: create a free project. In SQL Editor, run every file in `supabase/migrations` in order (or `npx supabase link` then `npx supabase db push`). Do not run `seed.sql`.
2. **Email sign-in**: set up your own email sender (see Limits below), then paste the two files in `supabase/templates` into Supabase's email templates.
3. **Vercel**: import the GitHub repo. Add environment variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase > Project Settings > API) and `NEXT_PUBLIC_SITE_URL` (your Vercel URL).
4. In Supabase > Authentication > URL Configuration, set Site URL to the Vercel URL and add `https://<your-vercel-url>/**` to Redirect URLs. Then sign in.
5. Make a second admin on the Admin page, so the team is never locked out.
6. **Backups**: add the repository secret `SUPABASE_DB_URL` (Supabase > Connect > Session pooler). The weekly GitHub Action backs up the database and stops the free project from pausing. Keep this repository private, because backups contain names and school emails.

## Limits worth knowing

- Supabase free: 500 MB database, 1 GB file storage, 50 MB per file, no automatic backups (hence the Action).
- Email-link sign-in needs your own email sender in production (Supabase's built-in one only sends a few emails an hour). Set up custom SMTP (for example Brevo) under Authentication → Emails → SMTP Settings, and paste `supabase/templates/magic_link.html` and `supabase/templates/confirm_signup.html` into the **Magic link** and **Confirm signup** templates. Those templates send people to `/auth/confirm`, so a link works on any device for an hour.
- **Google sign-in is hidden.** The school's Google Workspace blocks apps its admin hasn't approved, so the button only led to an error. The code is still here. Once IT allows the app, create a Google OAuth client (redirect URI `https://<your-project>.supabase.co/auth/v1/callback`), paste its ID and secret into Supabase > Authentication > Providers > Google, and set `NEXT_PUBLIC_GOOGLE_SIGNIN=on` in Vercel.
- Onshape links open in Onshape. The school's Onshape documents are private, so teammates need access there too.
