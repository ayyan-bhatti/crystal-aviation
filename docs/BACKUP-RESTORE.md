# Backup and restore

**Supabase Free has no automatic backups.** A database export doesn't include uploaded poster files, so back up **both**. Suggested schedule: monthly, and before any big change. Keep the backups private, because they contain drafts.

## Quick backup (offers + posters)

On the trusted computer, with `.env.local` containing `PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`:

```bash
npm run backup:posters
```

This writes `backups/<date-time>/` containing:
- `promotions.json`: every offer, including drafts;
- `staff_members.json`: the allowlist, for reference;
- `posters/`: every poster image file.

Copy that folder to a second place, such as an external drive or private cloud storage.

## Full database dump (optional, more complete)

Needs the Supabase CLI and a connection string. Docker isn't needed for `db dump`.

```bash
npx supabase db dump --db-url "$SUPABASE_DB_URL" -f backups/schema.sql
npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f backups/data.sql
```

**Without the CLI:** in the dashboard, open *Table Editor → promotions → Export → CSV*.

## Restore into the same or a new project

1. **New project only:** apply `supabase/migrations/20260927000001_promotions.sql` (see `SETUP.md`, step 2).
2. Run:
   ```bash
   npm run backup:posters -- restore backups/<date-time>
   ```
   This re-uploads any missing posters with their original file names, so offer links keep working. It then upserts every offer by ID.
3. Recreate staff accounts with `npm run staff:add -- add …`. User accounts and passwords aren't part of the backup.
4. **Moved to a new project?** Update `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` and redeploy.

**Restoring from a SQL dump instead:** run `schema.sql`, then `data.sql`, in the SQL Editor or with `psql`. Then restore the poster files by running only the poster part of the restore command, or upload them through *Storage*.

Restore note: the database trigger records who created each offer from the signed-in session. On restore those "created by" fields are empty, and "created at" becomes the restore time.
