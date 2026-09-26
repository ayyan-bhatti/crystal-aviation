# Deployment: Cloudflare Workers (Free) + Supabase (Free)

Nothing in this guide needs a payment card or a paid add-on. Don't enable paid products such as Workers Paid, Images, R2, Argo or Load Balancing, or Supabase Pro, without the owner's approval.

## What runs where

| Part | Where | Notes |
|---|---|---|
| Home, Umrah, Tours, Visa, About, Contact, `/admin` shell | Static files on Cloudflare | Static asset requests are served without running the Worker |
| `/promotions`, `/promotions/<slug>`, `/sitemap.xml` | Worker (on demand) | One small Supabase REST call each; `Cache-Control: no-store` |
| Offer lists on static pages | Visitor's browser → Supabase REST | Publishable key, RLS-protected, 6-second timeout |
| Dashboard | Visitor's browser → Supabase Auth/DB/Storage | Staff session + RLS; no server write endpoints exist |

## Free-tier limits (checked 27 Sep 2026; they can change)

- **Cloudflare Workers Free:** 100,000 Worker requests/day and **10 ms CPU per request**. Each on-demand page makes one fetch to Supabase and renders a short list. In the local `workerd` preview these pages responded in 15–70 ms of wall time, most of it network wait, which doesn't count as CPU. Real CPU use wasn't measured on Cloudflare because no account was available. After deploying, check *Workers → crystal-aviation → Metrics → CPU time*.
- **Supabase Free:**
  - 500 MB database;
  - 1 GB file storage;
  - 5 GB egress per month;
  - 50,000 monthly active users;
  - 2 active projects;
  - **no automatic backups** (see `BACKUP-RESTORE.md`);
  - **projects pause after 1 week without activity**. When paused, the brochure pages, phone numbers and WhatsApp links still work, and offer sections show a calm "couldn't load offers" message with a WhatsApp button. Restore the project from the Supabase dashboard. Regular visitor traffic that loads offers usually counts as activity, but don't rely on that alone.

Free plans come with no uptime guarantee.

## One-time deploy from a computer

1. Put the public values in `.env`. They're embedded at build time.
   ```
   PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   PUBLIC_WHATSAPP_NUMBER=923217643345
   PUBLIC_SITE_URL=https://thecrystalaviation.com
   ```
2. Sign in to a free Cloudflare account and deploy:
   ```bash
   npx wrangler login
   npm run deploy          # = astro build && wrangler deploy
   ```
   The site becomes available at `https://crystal-aviation.<account>.workers.dev`. Use this preview URL for the client's demo review before connecting the domain.

## Option: automatic deploys from GitHub (Workers Builds, free)

In *Workers & Pages → Create → Import a repository*, choose the repo and set:
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Build variables:** the four `PUBLIC_…` values above

Never add `SUPABASE_SECRET_KEY` here.

## Custom domain and HTTPS, keeping existing email and DNS

`thecrystalaviation.com` is already registered, and the agency may already have email or other records on it. **Before changing anything, take a screenshot or export of every existing DNS record** at the current DNS host, especially the **MX** and **TXT** records (SPF, DKIM, verification).

There are two paths:

1. **Move DNS to Cloudflare (recommended, free).**
   1. Add the site to Cloudflare on the Free plan and let it import the records.
   2. Compare the imported records against your export, and add any that are missing: MX, TXT, CNAMEs for email services.
   3. Only then change the nameservers at the domain registrar to the two Cloudflare nameservers shown.
   4. Once the zone is active, go to *Workers → crystal-aviation → Settings → Domains & Routes → Add → Custom domain*. Add `thecrystalaviation.com` and `www.thecrystalaviation.com`. Cloudflare creates the DNS records and a free HTTPS certificate automatically.
2. **Keep DNS where it is.** Workers custom domains need the zone on Cloudflare. If moving DNS isn't acceptable, keep the `workers.dev` URL and discuss other options first.

Leave the email records untouched: the website needs only the apex and `www` records Cloudflare adds. After switching, test sending and receiving email.

Redirect `www` → apex (or the reverse) with a free Cloudflare *Redirect Rule* so there is one canonical address matching `PUBLIC_SITE_URL`.

**This build did not change any DNS and did not purchase anything.**

## After deploying

- Open `/`, `/promotions`, one offer page, `/sitemap.xml` and `/robots.txt`.
- Sign in at `/admin`. Publish a test offer, check it shows on the homepage after a refresh, then unpublish it.
- Submit `https://thecrystalaviation.com/sitemap.xml` in Google Search Console (free).
- Watch *Workers → Metrics* (requests and CPU) and *Supabase → Reports* in the first weeks.
