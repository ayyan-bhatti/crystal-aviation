# Implementation plan and assumptions

## Plan

1. Scaffold Astro 7 + TypeScript, React islands, the Cloudflare adapter (Workers + static assets) and a small CSS token system.
2. Build the public pages: Home, Umrah, International Tours, Visa Assistance, Promotions, Promotion detail, About, Contact, 404.
3. Write the Supabase migrations: `promotions`, `staff_members`, the `public_promotions` view, RLS, the storage bucket and its policies, constraints and indexes.
4. Build the `/admin` React dashboard: log in → add → upload poster → details → preview → publish, plus edit, duplicate, unpublish/archive, delete and password change.
5. Add WhatsApp and call enquiry helpers and the enquiry composer.
6. Test:
   - unit tests for pricing, Karachi dates and WhatsApp encoding;
   - RLS and storage tests via direct API calls against a local Supabase stack;
   - a production build and a `workerd` preview.
7. Write the docs: owner guide, setup and provisioning, deployment, backup and restore, launch checklist, final report.

## Confirmed requirements (from the client brief and card)

- Business identity, both named contacts, landline, email, address and domain as printed on the card.
- Services: Umrah, international tours (Baku, Thailand, Singapore and Malaysia as examples) and visa file assistance (UK, USA, Europe).
- Staff can publish and remove homepage offers themselves, including airline-ticket and hotel promotions.
- Enquiries start on WhatsApp or by phone. No online booking.
- A demo is reviewed before launch.

## Implementation decisions (reversible)

| Decision | Why / how to change |
|---|---|
| Primary WhatsApp = Umar Farooq, +92 321 7643345 | Provisional. Set `PUBLIC_WHATSAPP_NUMBER`. Needs owner confirmation. |
| `+96 6591018642` not shown anywhere | Ambiguous (+966 Saudi?). Listed in the launch checklist. |
| Hajj excluded | Not approved; possible legal issue. |
| Cars/drivers excluded | Deferred by client. |
| Default pricing mode = quote-only | No approved prices supplied. |
| Text wordmark (Cinzel) instead of the logo | No clean logo file supplied. The card is kept only as a reference in `docs/brand-reference/`. |
| Offer lists on prerendered pages load in the browser, directly from Supabase with the publishable key | Keeps Worker CPU near zero, keeps the brochure working when Supabase is paused, and lets lists revalidate when the tab regains focus. |
| `/promotions`, `/promotions/[slug]` and `/sitemap.xml` are rendered on demand with `Cache-Control: no-store` | Shareable, SEO-friendly per-offer HTML with no stale shared cache. |
| The public reads use the `public_promotions` view (security invoker) | The active rule (published, started, not expired) is evaluated with the database `now()`. |
| Public poster bucket | Posters are marketing material. Draft poster URLs are public, and the editor says so. |
| Asia/Karachi dates use a fixed UTC+05:00 offset | Pakistan has not observed DST since 2009. The rule is isolated in `src/lib/dates.ts`. |
| Adapter `imageService: 'compile'` and `session: false` | Avoids the Cloudflare Images binding and KV provisioning, which could be billed. |
| English only | Strings are kept in `src/content/` so Urdu can be added later. |

## Assumptions

- Photography is temporary Unsplash-licensed material stored locally (see `docs/IMAGE-CREDITS.md`) until the agency supplies its own.
- No opening hours, social accounts, accreditations or history are published, because none were supplied.
