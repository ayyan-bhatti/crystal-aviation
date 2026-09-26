-- Hardening from the Supabase security advisor:
-- 1. Move the staff check out of the API-exposed `public` schema into `private`,
--    so it cannot be called via /rest/v1/rpc. RLS policies still use it.
-- 2. Stop API roles from executing Supabase's auto-RLS event-trigger function
--    (it only ever runs as an event trigger).
-- 3. Index the audit foreign keys.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members sm
    where sm.user_id = (select auth.uid())
      and sm.active
  );
$$;

revoke all on function private.is_active_staff() from public;
grant execute on function private.is_active_staff() to anon, authenticated;

-- Re-point every policy at the private function.
alter policy "read active or staff" on public.promotions
  using (
    (
      status = 'published'
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
    )
    or (select private.is_active_staff())
  );
alter policy "staff insert" on public.promotions with check ((select private.is_active_staff()));
alter policy "staff update" on public.promotions
  using ((select private.is_active_staff()))
  with check ((select private.is_active_staff()));
alter policy "staff delete" on public.promotions using ((select private.is_active_staff()));

alter policy "posters staff upload" on storage.objects
  with check (
    bucket_id = 'promotion-posters'
    and name ~ '^posters/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'
    and (select private.is_active_staff())
  );
alter policy "posters staff read" on storage.objects
  using (bucket_id = 'promotion-posters' and (select private.is_active_staff()));
alter policy "posters staff delete" on storage.objects
  using (bucket_id = 'promotion-posters' and (select private.is_active_staff()));

drop function public.is_active_staff();

-- Supabase's auto-enable-RLS event trigger function (present on new projects).
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

create index if not exists promotions_created_by_idx on public.promotions (created_by);
create index if not exists promotions_updated_by_idx on public.promotions (updated_by);
