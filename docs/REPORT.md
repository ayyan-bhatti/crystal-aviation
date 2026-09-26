# Build report (27 September 2026)

## What works

- **Public website**, mobile-first, blue-and-gold identity with a text wordmark:
  - pages: Home, Umrah, International Tours, Visa Assistance, Offers, Offer detail, About, Contact, Photo credits and 404;
  - SEO basics: titles, descriptions, canonical URLs, Open Graph tags, `robots.txt`, a dynamic `sitemap.xml`, and TravelAgency structured data built only from facts on the card.
- **Offers:**
  - The homepage shows featured published offers. The service pages show matching offers, and `/promotions` has category filters when more than one category exists.
  - `/promotions/<slug>` is rendered on demand with per-offer metadata.
  - Price display modes are quote, from, fixed and range. "Contact for price" is shown whenever there is no amount, never zero.
  - The exclusive Karachi-midnight expiry is enforced in the database, the public view, the lists, the detail route and the sitemap.
  - Open pages drop an offer when it expires and revalidate when the tab regains focus.
  - Load failures and timeouts (6 s) show a calm WhatsApp alternative, not "no offers". Expired or draft links show a generic "no longer available" page.
- **Enquiries:**
  - URL-encoded `wa.me` links per page and per offer;
  - an optional composer labelled **Continue on WhatsApp**;
  - call and email fallbacks;
  - no data stored.
- **Staff dashboard (`/admin`, noindex):**
  - sign in, and a re-sign-in dialog on session expiry that keeps edits;
  - add, edit, preview, save draft, publish, unpublish, archive, duplicate, and delete with confirmation;
  - in-browser poster optimisation (≤ 2200 px, ≤ 2.8 MB, JPEG/PNG/WebP, metadata stripped) and unique upload paths;
  - an orphan-safe replace flow: the old file is deleted only after the new one is saved, and only if unused;
  - stale-edit protection;
  - password change with current-password check;
  - clear saved/published/error states, shown only after the server accepts the change.
- **Security (implemented in SQL):**
  - RLS on all tables;
  - a `staff_members` allowlist that can't be changed through the API;
  - a `SECURITY DEFINER` staff check with an empty `search_path`;
  - editor IDs set by a trigger from the session;
  - a public poster bucket with staff-only upload and delete, a path pattern, no overwrite, and a 3 MB limit restricted to JPEG/PNG/WebP;
  - immediate revocation.
- **Scripts:**
  - staff provisioning with hidden password prompts;
  - backup and restore of offers plus poster files;
  - database push and type generation.

## What was tested

| Check | Result |
|---|---|
| `npm run check` (Astro + TypeScript) | 0 errors, 0 warnings |
| `npm test`: 38 unit tests (pricing, Karachi boundaries, WhatsApp encoding, slugs, form rules) | Pass |
| `npm test`: 20 policy tests running the **real migration in PostgreSQL 17 (PGlite)** with stand-in `auth`/`storage` schemas. Covers anonymous, non-staff, staff and revoked users; drafts; future and expired offers; the exact expiry boundary; constraints; storage insert, overwrite and delete; allowlist self-elevation | Pass |
| `astro build` (Cloudflare adapter) | Pass. Demo fixtures confirmed absent from `dist/`; no secret key in the bundle |
| `astro preview` in **workerd**: all routes, status codes, `no-store` on dynamic routes, security headers, 503 on missing config, 404 on bad slugs | Pass |
| Headless Chrome: no horizontal overflow at 320/360/390 px on all pages; mobile menu opens and closes with Escape, and focus returns; the sticky WhatsApp bar doesn't cover content | Pass, after fixing header overflow at 320 px and a middleware header bug found during testing |

## Not tested yet (blocked)

- **`npm run test:db`** (live Supabase API: Auth, PostgREST, Storage) has **not run**. The local Supabase stack couldn't start because Docker Desktop's engine failed ("read-only file system", then "unable to start"). I did not repair or restart Docker, because other projects' containers run there. The suite is ready. Run it once Docker works (`npm run db:local:start`) or against a spare hosted project (see `SETUP.md` §6).
- **Dashboard end-to-end in a browser** (log in, upload, publish, public refresh) needs a Supabase project. It is built and type-checked but not exercised against a live backend.
- **Cloudflare deployment and real CPU metrics** need a Cloudflare account. Local workerd preview only.
- **Content from the agency:** clean logo, real offers and prices, the ambiguous second number, WhatsApp routing and the map pin. See `LAUNCH-CHECKLIST.md`.

## Commands

```bash
npm install
npm run dev                 # local dev (demo mode without Supabase)
npm test                    # unit + SQL policy tests
npm run check               # types
npm run build && npm run preview
npm run staff:add -- add <email> --name "<Name>"      # needs .env.local
npm run test:db             # needs .env.test (see SETUP.md)
npm run deploy              # needs `npx wrangler login`
```
