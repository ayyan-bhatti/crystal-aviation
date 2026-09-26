# Launch checklist

Items the owner must confirm or supply. **Nothing below has been guessed on the website.**

## Business details to confirm

- [ ] **Second number on the card: `+96 6591018642`.** It is ambiguous (possibly a Saudi +966 number that is missing a digit). It isn't shown anywhere on the site. Confirm the correct number and whether it should appear.
- [ ] **Primary WhatsApp destination.** Provisionally Umar Farooq, +92 321 7643345. Confirm, or change `PUBLIC_WHATSAPP_NUMBER`. Both named contacts are listed on the Contact and About pages with their own WhatsApp buttons.
- [ ] **Exact map pin.** The site uses an address search ("Rafih Plaza, Main Gulberg Road, Faisalabad"). Send a Google Maps share link for the office.
- [ ] **Opening hours and social media accounts.** None are shown until supplied.
- [ ] **Hajj.** Excluded, because approval was unclear and there may be legal issues. Add it only after explicit owner confirmation.
- [ ] **Cars/drivers.** Deferred, so excluded from v1.

## Brand and content

- [ ] **Clean logo file** (SVG, or PNG with a transparent background) of the crystal, aircraft and gold wings. The header currently uses a text wordmark, and `public/favicon.svg` is a simple placeholder.
- [ ] **Real offers:** posters, prices (or "contact for price"), validity dates and terms. No offers are pre-loaded. The spoken "4–5 lakh" example isn't used.
- [ ] **Own photography (optional).** The current photos are temporary Unsplash images (see `docs/IMAGE-CREDITS.md`).
- [ ] **Review the page wording** for Umrah, Tours and Visa. It avoids guarantees, accreditations, customer numbers and years in business on purpose. Add such claims only with evidence.

## Accounts and access

- [ ] The domain registrar login is available to the owner, with renewal on the owner's account.
- [ ] A Cloudflare account (free) is owned by the business, not an individual developer.
- [ ] A Supabase project (free) is owned by the business. Record the database password in a password manager.
- [ ] Staff accounts are created (`npm run staff:add`), and each person has signed in and changed their password.
- [ ] Public sign-ups are **off** in Supabase Auth.
- [ ] The secret key exists only in `.env.local` on a trusted computer.

## Before switching the domain

- [ ] **Demo review.** The client has reviewed the site on the `workers.dev` preview URL.
- [ ] All existing DNS records are exported, **especially email (MX/TXT)**. See `DEPLOYMENT.md`.
- [ ] `npm test` passes, and `npm run test:db` passes against the real project (or a copy of it).
- [ ] An end-to-end check is done: publish a test offer, see it on the homepage, unpublish it, and check it has gone.
- [ ] WhatsApp buttons open the right chat with the right message on a real phone.

## Free-tier behaviour (tell the owner)

- [ ] **Supabase Free pauses a project after 1 week without activity.** When paused, the offers show a "couldn't load" message and everything else keeps working. Restore it from the dashboard.
- [ ] **There are no automatic backups.** Schedule a monthly `npm run backup:posters`.
- [ ] Free plans come with no uptime guarantee. Limits are listed in `DEPLOYMENT.md`.
