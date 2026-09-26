# Setup: Supabase, staff accounts and local development

Audience: the developer or technical owner. Allow about 30 minutes.

## 1. Create the Supabase project (Free plan)

1. Sign in at https://supabase.com. Create a **new** project just for this website. The Free plan needs no payment card. Choose a region near Pakistan (for example Mumbai or Singapore) and a strong database password. Keep the password in a password manager.
2. **Authentication → Sign In / Providers → Email.** Leave email/password on.
3. **Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".** Staff accounts are created only by the owner (step 4).
4. **Authentication → Providers → Email → "Confirm email"** can stay on. The provisioning script creates accounts that are already confirmed, so no emails are sent.
5. **Authentication → Policies (Passwords):** set the minimum length to **10** and require letters and digits.
6. **Authentication → URL Configuration:** set Site URL to `https://thecrystalaviation.com`.

> The built-in Supabase email service is heavily rate-limited and not meant for production. This site never relies on it: there are no invite, magic-link or "forgot password" emails. Password recovery is owner-assisted (see the owner guide).

## 2. Apply the database migration

Choose one option.

- **Option A (easiest): SQL Editor.** Open *SQL Editor → New query*, paste the full contents of `supabase/migrations/20260927000001_promotions.sql`, and select **Run**. Do this once.
- **Option B: CLI.** Put the *Session pooler* connection string in `.env.local` as `SUPABASE_DB_URL`, then run `npm run db:push`.

This creates:
- the `promotions` table;
- the `staff_members` allowlist;
- the `public_promotions` view;
- the staff-check function;
- all Row Level Security policies;
- the public `promotion-posters` storage bucket (3 MB limit, JPEG/PNG/WebP only) and its policies.

## 3. Environment variables

Copy `.env.example`:

| File | Contains | Used by |
|---|---|---|
| `.env` | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `PUBLIC_WHATSAPP_NUMBER`, `PUBLIC_SITE_URL` | website builds |
| `.env.local` | the above plus `SUPABASE_SECRET_KEY` and optionally `SUPABASE_DB_URL` | local admin scripts only |

- The **publishable key** (`sb_publishable_…`) is safe in the browser because RLS protects every table.
- The **secret key** (`sb_secret_…`) bypasses RLS. Keep it only in `.env.local` on a trusted computer. Never put it in `.env`, in any `PUBLIC_` variable, in Cloudflare, or in git. Both `.env` files are git-ignored.

## 4. Create staff accounts

On the trusted computer, with `.env.local` filled in:

```bash
npm run staff:add -- add umar@example.com --name "Umar Farooq" --role owner
npm run staff:add -- add zeeshan@example.com --name "Zeeshan Saleem"
npm run staff:add -- list
```

- You type the password at a hidden prompt. It is never written to a file.
- Hand the password over in person. Staff can change it under **Account** after signing in.
- Other commands: `reset-password <email>`, `revoke <email>`, `restore <email>`.
- Revoking works at once, even for someone who is already signed in, because every database request checks the allowlist.

**Without the script (dashboard only):**
1. *Authentication → Users → Add user → Create new user*. Enter the email and password and tick **Auto Confirm User**.
2. Copy the new user's UID.
3. In the SQL Editor, run:
   ```sql
   insert into public.staff_members (user_id, role, display_name)
   values ('<paste-uid>', 'editor', 'Name');
   ```
   To revoke later: `update public.staff_members set active = false where user_id = '<uid>';`

Promotion editors never need access to the Supabase dashboard, GitHub, Cloudflare or DNS.

## 5. Run locally

```bash
npm install
npm run dev            # http://localhost:4321  (runs in Cloudflare's workerd runtime)
```

- **No credentials in `.env`?** `npm run dev` shows general service entries (Umrah packages, Baku holidays, airline tickets and so on) with photos and "Contact for price", so the site can be reviewed before Supabase is connected. They have no prices, dates or other invented details. Production builds never include them; without configuration a production build shows an "offers unavailable" message instead.
- **To preview a production build in workerd:** `npm run build && npm run preview`.

## 6. Tests

| Command | What it checks |
|---|---|
| `npm test` | Unit tests (pricing, Karachi dates, WhatsApp encoding, form rules) plus the migration and RLS/storage policies in real PostgreSQL (PGlite). Needs no network or Docker. |
| `npm run test:db` | **Live API tests** against a real Supabase project: anonymous, non-staff, staff and revoked users; drafts; expiry; storage upload, overwrite and delete. |
| `npm run check` | TypeScript and Astro checks |

**Setting up `npm run test:db`:** create `.env.test` with `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY` and `SUPABASE_TEST_SECRET_KEY`.
- **Local stack (Docker):** run `npm run db:local:start`. It uses ports 55621–55629 so it doesn't clash with other local Supabase projects, and project id `crystal_aviation`.
- **Hosted project:** use a spare one, not the live one, and also set `ALLOW_REMOTE_DB_TESTS=yes`.

The tests create temporary users, rows and files and delete them afterwards.

## 7. Orphaned poster files (occasional tidy-up)

Replacing or deleting a poster removes the old file once it is no longer used by any offer. If a network failure interrupts that step, a file can be left behind. To list leftovers, run this in the SQL Editor:

```sql
select o.name, o.created_at
from storage.objects o
where o.bucket_id = 'promotion-posters'
  and not exists (select 1 from public.promotions p where p.image_path = o.name)
order by o.created_at;
```

Delete them from *Storage → promotion-posters* in the dashboard.

## 8. Types

`src/lib/types.ts` holds the hand-maintained TypeScript types for the tables. After changing the schema, you can generate the Supabase types with `npm run db:types` (needs `SUPABASE_DB_URL`) and compare.
