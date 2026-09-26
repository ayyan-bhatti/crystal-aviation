# Owner guide: managing offers on your website

Go to **thecrystalaviation.com/admin**. The page isn't linked from the website; bookmark it.

## Sign in

Enter your email and password, then select **Sign in**.

- There is no public sign-up. Only people the owner adds can get in.
- When you're finished, especially on a shared computer, select **Sign out**.

## Add an offer

1. Select **+ Add offer**.
2. Type a **Title**, e.g. "December Umrah offer".
3. Choose the **Type of offer**: Umrah, International tour, Airline tickets, Hotel booking, Visa assistance or Other.
4. Select **Choose poster image** and pick a JPEG, PNG or WebP file. It's resized automatically, and the whole poster is always shown without cropping.
5. Fill in **Describe the poster** in a few words, e.g. "December Umrah offer poster". This is read aloud to people who can't see images.
6. Optional: add a **Short summary** and a **Description**. Write the important details (price, dates, what's included) here as well as on the poster. Customers and Google can read text, not pictures.
7. **Price.** Pick one option:
   - **Contact for price** (the default): no amount is shown.
   - **Starting from**: one amount, e.g. "From PKR 250,000".
   - **Fixed price**: one amount.
   - **Price range**: lowest and highest amounts.
8. Optional: set **Valid through**, the last day the offer should show. It disappears by itself at midnight Pakistan time at the end of that day. You don't have to remember to remove it.
9. Tick **Feature on the homepage** if it should appear on the front page.
10. Select **Preview** to see exactly what customers will see.
11. Select **Publish**. The offer is live straight away; refresh the website to see it. Or select **Save draft** to finish it later. Drafts are never shown to customers.

Under **More details** you can add optional extras:
- destination, duration and travel dates;
- what's included and not included (one item per line);
- terms;
- a **Show from** date for offers that should start later;
- the order of offers;
- the offer's web address.

> **Poster images are public files.** Anyone who has an image's link can open it, even while the offer is a draft. Never upload passports, customer documents or anything private.

## Change an offer

Find it in the list and select **Edit**. Make your changes, then select **Save changes**. You'll see a green message only after the change has really been saved. If you see a red message, nothing was saved; read it, fix the problem and try again.

## Replace the poster

**Edit** → **Replace poster** → choose the new image → **Save changes**. The old image is removed automatically once the new one is saved safely.

## Hide or remove an offer

- **Unpublish:** the offer goes back to draft and is hidden from the website. You can publish it again later.
- **More → Hide (archive):** hidden and kept for your records.
- **More → Delete…:** permanently removes it after you confirm. This can't be undone.

**Duplicate** (under **More**) makes a draft copy, which is handy for a similar offer next month.

## What the status labels mean

| Label | Meaning |
|---|---|
| Live on website | Customers can see it now |
| Draft | Only staff can see it |
| Scheduled | Published, but its **Show from** date hasn't arrived yet |
| Expired | Its **Valid through** date has passed, so it's hidden automatically |
| Hidden | Archived |

## Your password

**Account → Change password.** Enter your current password, then the new one twice. It needs at least 10 characters with letters and numbers.

## If you forget your password or lose access

There is no "forgot password" email. Ask the owner or developer. They can set a temporary password for you (see `SETUP.md`, "Create staff accounts"). Sign in with it, then change it under **Account**.

If a staff member leaves, the owner should revoke their access straight away with `npm run staff:add -- revoke <email>`, or the SQL in `SETUP.md`. It takes effect immediately.

## Good to know

- Enquiries go to WhatsApp. The website never confirms a booking by itself.
- If you see "Session expired", sign in again in the box that appears. Anything you were typing is kept.
- If the website says offers couldn't be loaded, the database may be paused. See `DEPLOYMENT.md` (free plan inactivity) or contact your developer.
