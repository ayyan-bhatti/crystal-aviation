# The Crystal Aviation website

Travel-services, promotions and enquiry website for **The Crystal Aviation**, Faisalabad (Luxury Travel Solutions). It includes a small staff dashboard for publishing homepage offers.

- **Stack:**
  - Astro 7 + TypeScript, with React islands and a CSS token system;
  - Cloudflare Workers Free (static assets + on-demand offer pages);
  - Supabase Free (PostgreSQL, Auth, Storage).
- **Costs:** no recurring hosting, database or CMS fees at the expected scale. See the free-tier limits in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **Scope (v1):** Umrah, international tours and visa-file assistance, promotions, and WhatsApp/phone enquiries. There is **no** booking engine, payments, customer accounts or document uploads. A WhatsApp enquiry is not a booking.

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321, demo mode if Supabase isn't configured
npm test           # unit tests + migration/RLS policy tests (no network needed)
npm run check      # type checking
npm run build && npm run preview   # production build in Cloudflare's workerd runtime
```

Connecting Supabase and creating staff accounts: [docs/SETUP.md](docs/SETUP.md).

## Documentation

| Document | For |
|---|---|
| [docs/OWNER-GUIDE.md](docs/OWNER-GUIDE.md) | Staff: sign in; add, edit, publish or hide offers; posters; expiry; passwords |
| [docs/SETUP.md](docs/SETUP.md) | Developer: Supabase project, migration, staff provisioning, env vars, tests |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Cloudflare deploy, custom domain and HTTPS, keeping email DNS, free-tier limits |
| [docs/BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md) | Manual backup and restore of offers **and** poster files |
| [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md) | Items the owner must confirm before launch |
| [docs/PLAN.md](docs/PLAN.md) | Plan, confirmed requirements and implementation decisions |
| [docs/REPORT.md](docs/REPORT.md) | What works, what was tested, what's blocked |
| [docs/IMAGE-CREDITS.md](docs/IMAGE-CREDITS.md) | Photo sources and licences (temporary photos) |

## Project layout

```
src/
  config/site.ts           business facts from the card (single source)
  lib/                     pricing, Karachi dates, WhatsApp links, public data client
  lib/admin/               dashboard: Supabase client, poster pipeline, form rules
  components/offers/       offer card, detail view (shared by site + preview), live list
  components/admin/        dashboard UI
  pages/                   routes (promotions/* and sitemap.xml render on demand)
supabase/migrations/       schema, RLS, storage bucket and policies
scripts/                   staff provisioning, backup/restore (trusted computer only)
tests/unit, tests/sql, tests/db
```

## Security model in one paragraph

- **Browser access:** the browser only ever holds the Supabase *publishable* key.
- **Who can read what:** Row Level Security lets anyone read currently active published offers. Only users listed as active in `staff_members` can see drafts or change anything, and that includes poster uploads and deletes through Storage policies.
- **Changing the staff list:** nobody can do it through the API. The owner uses the secret key on a trusted computer (`npm run staff:add`) or the Supabase dashboard.
- **Revoking access:** takes effect on the next request, even for an open session.
- **No privileged endpoints:** the site has no server endpoints that write data.
