/**
 * Runs the real migration SQL in PGlite (PostgreSQL 17 compiled to WebAssembly)
 * and checks the RLS rules by switching Postgres roles, the same mechanism
 * Supabase uses. The `auth` and `storage` schemas are minimal stand-ins, so
 * this does NOT replace tests/db/rls.test.ts against a real Supabase API.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets,
  name text not null, owner uuid, created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
`;

const STAFF = '11111111-1111-4111-8111-111111111111';
const OUTSIDER = '22222222-2222-4222-8222-222222222222';
const REVOKED = '33333333-3333-4333-8333-333333333333';
const uuid = () => crypto.randomUUID();

let db: PGlite;

/** Run `sql` as a Supabase role with an optional signed-in user id. */
async function as<T = Record<string, unknown>>(role: 'anon' | 'authenticated', uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}
async function expectError(p: Promise<unknown>, code: RegExp) {
  await expect(p).rejects.toThrow(code);
}
const slugsFor = async (role: 'anon' | 'authenticated', uid: string | null, table = 'promotions') =>
  (await as<{ slug: string }>(role, uid, `select slug from ${table} order by slug`)).rows.map((r) => r.slug);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const dir = join(process.cwd(), 'supabase', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  await db.exec(`insert into auth.users (id, email) values
    ('${STAFF}', 'staff@example.test'), ('${OUTSIDER}', 'out@example.test'), ('${REVOKED}', 'rev@example.test');
    insert into public.staff_members (user_id, role, active) values ('${STAFF}', 'editor', true), ('${REVOKED}', 'editor', true);`);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`reset role;
    update public.staff_members set active = true;
    delete from public.promotions;
    delete from storage.objects;
    insert into public.promotions (slug, title, category, description, status, starts_at, expires_at) values
      ('active',   'Active',   'umrah', 'd', 'published', null, now() + interval '1 day'),
      ('draft',    'Draft',    'umrah', 'd', 'draft',     null, null),
      ('future',   'Future',   'tour',  'd', 'published', now() + interval '1 day', null),
      ('expired',  'Expired',  'tour',  'd', 'published', null, now() - interval '1 second'),
      ('archived', 'Archived', 'visa',  'd', 'archived',  null, null);`);
});

describe('migration', () => {
  it('applies cleanly and enables RLS on every exposed table', async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relname in ('promotions', 'staff_members') order by relname`,
    );
    expect(r.rows).toEqual([
      { relname: 'promotions', relrowsecurity: true },
      { relname: 'staff_members', relrowsecurity: true },
    ]);
  });

  it('the staff helper is SECURITY DEFINER with a locked search_path', async () => {
    const r = await db.query<{ prosecdef: boolean; proconfig: string[] }>(
      `select prosecdef, proconfig from pg_proc where proname = 'is_active_staff'`,
    );
    expect(r.rows[0].prosecdef).toBe(true);
    expect(r.rows[0].proconfig).toContain('search_path=""');
  });
});

describe('reading', () => {
  it('anonymous: only active published offers (table and view)', async () => {
    expect(await slugsFor('anon', null)).toEqual(['active']);
    expect(await slugsFor('anon', null, 'public_promotions')).toEqual(['active']);
  });
  it('signed-in non-staff: same as anonymous', async () => {
    expect(await slugsFor('authenticated', OUTSIDER)).toEqual(['active']);
  });
  it('active staff: everything in the table, only active in the public view', async () => {
    expect(await slugsFor('authenticated', STAFF)).toEqual(['active', 'archived', 'draft', 'expired', 'future']);
    expect(await slugsFor('authenticated', STAFF, 'public_promotions')).toEqual(['active']);
  });
  it('anonymous cannot read staff_members at all', async () => {
    await expectError(as('anon', null, 'select * from staff_members'), /permission denied/);
  });
  it('authenticated users see only their own staff row', async () => {
    expect((await as('authenticated', OUTSIDER, 'select user_id from staff_members')).rows).toEqual([]);
    expect((await as('authenticated', STAFF, 'select user_id from staff_members')).rows).toEqual([{ user_id: STAFF }]);
  });
});

describe('writing', () => {
  const ins = `insert into promotions (slug, title, category, description, status) values ($1, 'Test offer', 'umrah', 'd', 'draft')`;

  it('anonymous cannot insert, update or delete', async () => {
    await expectError(as('anon', null, ins, ['x-anon']), /permission denied/);
    await expectError(as('anon', null, `update promotions set title = 'hacked'`), /permission denied/);
    await expectError(as('anon', null, `delete from promotions`), /permission denied/);
  });

  it('signed-in non-staff cannot insert; updates/deletes affect nothing', async () => {
    await expectError(as('authenticated', OUTSIDER, ins, ['x-out']), /row-level security/);
    expect((await as('authenticated', OUTSIDER, `update promotions set title = 'hacked'`)).affectedRows).toBe(0);
    expect((await as('authenticated', OUTSIDER, `delete from promotions`)).affectedRows).toBe(0);
  });

  it('staff can insert/update/delete; audit ids come from the session', async () => {
    const r = await as<{ created_by: string; updated_by: string }>(
      'authenticated',
      STAFF,
      `insert into promotions (slug, title, category, description, created_by, updated_by)
       values ('mine', 'Mine', 'hotel', 'd', '${OUTSIDER}', '${OUTSIDER}') returning created_by, updated_by`,
    );
    expect(r.rows[0]).toEqual({ created_by: STAFF, updated_by: STAFF });
    expect((await as('authenticated', STAFF, `update promotions set status = 'published' where slug = 'mine'`)).affectedRows).toBe(1);
    expect(await slugsFor('anon', null)).toContain('mine');
    expect((await as('authenticated', STAFF, `delete from promotions where slug = 'mine'`)).affectedRows).toBe(1);
  });

  it('nobody can modify the staff allowlist through the API roles', async () => {
    await expectError(
      as('authenticated', OUTSIDER, `insert into staff_members (user_id, role) values ('${OUTSIDER}', 'owner')`),
      /permission denied/,
    );
    await expectError(as('authenticated', STAFF, `update staff_members set role = 'owner' where user_id = '${STAFF}'`), /permission denied/);
    await expectError(as('authenticated', STAFF, `delete from staff_members`), /permission denied/);
  });

  it('revocation applies immediately to the same user id', async () => {
    expect((await as('authenticated', REVOKED, ins, ['rev-ok'])).affectedRows).toBe(1);
    await db.exec(`update public.staff_members set active = false where user_id = '${REVOKED}'`);
    await expectError(as('authenticated', REVOKED, ins, ['rev-denied']), /row-level security/);
    expect(await slugsFor('authenticated', REVOKED)).toEqual(['active']);
    expect((await as('authenticated', REVOKED, `update promotions set title = 'x'`)).affectedRows).toBe(0);
  });
});

describe('constraints', () => {
  const insert = (cols: string, vals: string) =>
    as('authenticated', STAFF, `insert into promotions (slug, title, category, ${cols}) values (${vals})`);

  it('rejects duplicate slugs and malformed slugs', async () => {
    await expectError(insert('description', `'active', 'Dup', 'umrah', 'd'`), /duplicate key/);
    await expectError(insert('description', `'Bad Slug', 'Bad', 'umrah', 'd'`), /check constraint/);
  });

  it('pricing: quote hides amounts, from/fixed need one, range needs max >= min, never zero', async () => {
    const bad = [
      `pricing_mode, price_min) values ('price-1', 'Price test', 'umrah', 'from', null`,
      `pricing_mode, price_min) values ('price-2', 'Price test', 'umrah', 'fixed', 0`,
      `pricing_mode, price_min) values ('price-3', 'Price test', 'umrah', 'quote', 100`,
      `pricing_mode, price_min, price_max) values ('price-4', 'Price test', 'umrah', 'range', 100, 50`,
      `pricing_mode, price_min, price_max) values ('price-5', 'Price test', 'umrah', 'fixed', 100, 200`,
    ];
    for (const b of bad) {
      await expectError(as('authenticated', STAFF, `insert into promotions (slug, title, category, ${b})`), /check constraint/);
    }
    const ok = await insert('pricing_mode, price_min, price_max', `'price-ok', 'Price test', 'umrah', 'range', 100, 100`);
    expect(ok.affectedRows).toBe(1);
  });

  it('published offers need a poster (with alt text) or a description', async () => {
    await expectError(insert('status', `'pub-1', 'Publish test', 'umrah', 'published'`), /promotions_published_has_content/);
    await expectError(
      insert('status, image_path', `'pub-2', 'Publish test', 'umrah', 'published', 'posters/${uuid()}.webp'`),
      /check constraint/,
    );
    expect((await insert('status, image_path, image_alt', `'pub-3', 'Publish test', 'umrah', 'published', 'posters/${uuid()}.webp', 'Poster'`)).affectedRows).toBe(1);
  });

  it('rejects bad poster paths, reversed windows and reversed travel dates', async () => {
    await expectError(insert('image_path, image_alt', `'bad-1', 'Bad data test', 'umrah', '../etc/x.png', 'x'`), /check constraint/);
    await expectError(insert('starts_at, expires_at', `'bad-2', 'Bad data test', 'umrah', now() + interval '2 day', now() + interval '1 day'`), /promotions_window_valid/);
    await expectError(insert('travel_start, travel_end', `'bad-3', 'Bad data test', 'umrah', '2026-12-10', '2026-12-01'`), /promotions_travel_dates_valid/);
  });

  it('the expiry boundary is exclusive: an offer disappears at exactly expires_at', async () => {
    await db.exec(`insert into public.promotions (slug, title, category, description, status, expires_at)
      values ('edge', 'Edge', 'umrah', 'd', 'published', now() + interval '1500 milliseconds')`);
    expect(await slugsFor('anon', null)).toContain('edge');
    await new Promise((r) => setTimeout(r, 1700));
    expect(await slugsFor('anon', null)).not.toContain('edge');
  });
});

describe('storage policies', () => {
  const up = (role: 'anon' | 'authenticated', uid: string | null, name: string) =>
    as(role, uid, `insert into storage.objects (bucket_id, name) values ('promotion-posters', $1)`, [name]);

  it('bucket is public-read with size and type limits', async () => {
    const r = await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'promotion-posters'`,
    );
    expect(r.rows[0]).toEqual({ public: true, file_size_limit: 3145728, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] });
  });

  it('only active staff can upload, and only to posters/<uuid>.<ext>', async () => {
    await expectError(up('anon', null, `posters/${uuid()}.webp`), /row-level security/);
    await expectError(up('authenticated', OUTSIDER, `posters/${uuid()}.webp`), /row-level security/);
    expect((await up('authenticated', STAFF, `posters/${uuid()}.webp`)).affectedRows).toBe(1);
    await expectError(up('authenticated', STAFF, `other/${uuid()}.webp`), /row-level security/);
    await expectError(up('authenticated', STAFF, `posters/../${uuid()}.webp`), /row-level security/);
    await expectError(up('authenticated', STAFF, `posters/${uuid()}.svg`), /row-level security/);
    await db.exec(`update public.staff_members set active = false where user_id = '${REVOKED}'`);
    await expectError(up('authenticated', REVOKED, `posters/${uuid()}.webp`), /row-level security/);
  });

  it('no one can overwrite (update) an existing object; only staff can delete', async () => {
    const name = `posters/${uuid()}.webp`;
    await up('authenticated', STAFF, name);
    expect((await as('authenticated', STAFF, `update storage.objects set owner = null where name = $1`, [name])).affectedRows).toBe(0);
    expect((await as('anon', null, `delete from storage.objects where name = $1`, [name])).affectedRows).toBe(0);
    expect((await as('authenticated', OUTSIDER, `delete from storage.objects where name = $1`, [name])).affectedRows).toBe(0);
    expect((await as('authenticated', STAFF, `delete from storage.objects where name = $1`, [name])).affectedRows).toBe(1);
  });
});
