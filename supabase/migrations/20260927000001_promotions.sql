-- The Crystal Aviation — promotions schema, staff allowlist, RLS and storage policies.
-- All timestamps are stored as UTC timestamptz. The UI enters and displays dates in Asia/Karachi.

-- ---------------------------------------------------------------------------
-- Staff allowlist
-- ---------------------------------------------------------------------------
create table public.staff_members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'editor' check (role in ('owner', 'editor')),
  active      boolean not null default true,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.staff_members is
  'Authorization allowlist for the promotions dashboard. Managed only by the owner/developer via SQL or the service-role provisioning script.';

alter table public.staff_members enable row level security;

-- Staff can see only their own row (used by the dashboard to show its access state).
create policy "staff read own membership"
  on public.staff_members for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policies: regular users can never change the allowlist.
revoke all on public.staff_members from anon, authenticated;
grant select on public.staff_members to authenticated;

-- ---------------------------------------------------------------------------
-- Staff check helper.
-- SECURITY DEFINER so it can read staff_members without depending on (and
-- recursing through) that table's RLS. Search path locked, identifiers qualified.
-- ---------------------------------------------------------------------------
create function public.is_active_staff()
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

revoke all on function public.is_active_staff() from public;
grant execute on function public.is_active_staff() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------
create table public.promotions (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (char_length(slug) between 3 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null check (char_length(btrim(title)) between 3 and 120),
  category      text not null check (category in ('umrah', 'tour', 'flight', 'hotel', 'visa', 'other')),
  destination   text check (destination is null or char_length(destination) <= 80),
  summary       text check (summary is null or char_length(summary) <= 300),
  description   text check (description is null or char_length(description) <= 5000),
  image_path    text check (image_path is null or image_path ~ '^posters/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'),
  image_alt     text check (image_alt is null or char_length(image_alt) <= 250),
  pricing_mode  text not null default 'quote' check (pricing_mode in ('quote', 'from', 'fixed', 'range')),
  price_min     numeric(12, 2) check (price_min is null or price_min > 0),
  price_max     numeric(12, 2) check (price_max is null or price_max > 0),
  currency      text not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  price_basis   text check (price_basis is null or price_basis in ('per_person', 'per_couple', 'per_family', 'per_group', 'per_booking')),
  duration      text check (duration is null or char_length(duration) <= 80),
  travel_start  date,
  travel_end    date,
  inclusions    text[] not null default '{}' check (cardinality(inclusions) <= 30),
  exclusions    text[] not null default '{}' check (cardinality(exclusions) <= 30),
  terms         text check (terms is null or char_length(terms) <= 3000),
  status        text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  starts_at     timestamptz,
  expires_at    timestamptz,
  featured      boolean not null default false,
  sort_order    integer not null default 0 check (sort_order between -1000 and 1000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null,
  updated_by    uuid references auth.users (id) on delete set null,

  -- Pricing rules: quote hides amounts; from/fixed need one amount; range needs both with max >= min.
  constraint promotions_pricing_valid check (
    (pricing_mode = 'quote' and price_min is null and price_max is null)
    or (pricing_mode in ('from', 'fixed') and price_min is not null and price_max is null)
    or (pricing_mode = 'range' and price_min is not null and price_max is not null and price_max >= price_min)
  ),
  constraint promotions_travel_dates_valid check (travel_end is null or travel_start is null or travel_end >= travel_start),
  constraint promotions_window_valid check (expires_at is null or starts_at is null or expires_at > starts_at),
  -- A published offer must show something: a poster (with alt text) or a written description.
  constraint promotions_published_has_content check (
    status <> 'published'
    or (image_path is not null and image_alt is not null and char_length(btrim(image_alt)) > 0)
    or (image_path is null and char_length(btrim(coalesce(description, ''))) > 0)
  ),
  constraint promotions_image_alt_needed check (image_path is null or image_alt is not null)
);

comment on column public.promotions.expires_at is
  'Exclusive UTC expiry. For a "valid through" date D (Asia/Karachi), this is D+1 00:00 PKT.';

create index promotions_public_order_idx
  on public.promotions (featured desc, sort_order asc, created_at desc)
  where status = 'published';
create index promotions_category_idx on public.promotions (category) where status = 'published';
create index promotions_expires_idx on public.promotions (expires_at) where status = 'published';
create index promotions_image_path_idx on public.promotions (image_path) where image_path is not null;
create index promotions_updated_idx on public.promotions (updated_at desc);

-- Editor IDs and timestamps come from the session, never from client input.
create function public.promotions_set_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.title := btrim(new.title);
  return new;
end;
$$;

create trigger promotions_audit
  before insert or update on public.promotions
  for each row execute function public.promotions_set_audit();

create function public.staff_members_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger staff_members_touch
  before update on public.staff_members
  for each row execute function public.staff_members_touch();

alter table public.promotions enable row level security;

-- Anyone may read currently active published offers. Active staff may read everything.
create policy "read active or staff"
  on public.promotions for select
  to anon, authenticated
  using (
    (
      status = 'published'
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
    )
    or (select public.is_active_staff())
  );

create policy "staff insert"
  on public.promotions for insert
  to authenticated
  with check ((select public.is_active_staff()));

create policy "staff update"
  on public.promotions for update
  to authenticated
  using ((select public.is_active_staff()))
  with check ((select public.is_active_staff()));

create policy "staff delete"
  on public.promotions for delete
  to authenticated
  using ((select public.is_active_staff()));

revoke all on public.promotions from anon, authenticated;
grant select on public.promotions to anon;
grant select, insert, update, delete on public.promotions to authenticated;

-- ---------------------------------------------------------------------------
-- Public view: only currently active offers, with public columns only.
-- security_invoker => underlying RLS applies to the caller; the WHERE clause
-- additionally hides drafts from logged-in staff browsing the public site.
-- ---------------------------------------------------------------------------
create view public.public_promotions
with (security_invoker = true)
as
select
  id, slug, title, category, destination, summary, description,
  image_path, image_alt, pricing_mode, price_min, price_max, currency, price_basis,
  duration, travel_start, travel_end, inclusions, exclusions, terms,
  starts_at, expires_at, featured, sort_order, updated_at
from public.promotions
where status = 'published'
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at > now());

revoke all on public.public_promotions from anon, authenticated;
grant select on public.public_promotions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public-read marketing posters, staff-only writes, no overwrites.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promotion-posters', 'promotion-posters', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "posters staff upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'promotion-posters'
    and name ~ '^posters/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'
    and (select public.is_active_staff())
  );

-- Staff need SELECT on objects they manage (upload responses and deletes read the row).
create policy "posters staff read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'promotion-posters' and (select public.is_active_staff()));

create policy "posters staff delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'promotion-posters' and (select public.is_active_staff()));

-- Deliberately no UPDATE policy: an uploaded poster is never overwritten in place.
-- Replacing a poster uploads a new unique object and deletes the old one after the save succeeds.
