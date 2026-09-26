/**
 * Real API tests of RLS and Storage policies (no mocks).
 *
 * Needs a Supabase project with the migrations applied. Configure in .env.test:
 *   SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY, SUPABASE_TEST_SECRET_KEY
 * Safety: refuses to run against a non-local URL unless ALLOW_REMOTE_DB_TESTS=yes.
 * Everything created (users, rows, files) is tagged with a run id and deleted afterwards.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL_ = process.env.SUPABASE_TEST_URL ?? '';
const PUB = process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? '';
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY ?? '';
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URL_);
const enabled = !!(URL_ && PUB && SECRET) && (isLocal || process.env.ALLOW_REMOTE_DB_TESTS === 'yes');

const RUN = Math.random().toString(36).slice(2, 8);
const BUCKET = 'promotion-posters';
const PASSWORD = `Test-${RUN}-${Math.random().toString(36).slice(2)}9x`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

// 1x1 WebP
const WEBP = Uint8Array.from(atob('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'), (c) => c.charCodeAt(0));
const posterPath = () => `posters/${crypto.randomUUID()}.webp`;
const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const DAY = 86_400_000;

describe.skipIf(!enabled)('RLS and storage policies (live API)', () => {
  let admin: SupabaseClient; // secret key: test setup/cleanup only
  let anon: SupabaseClient;
  let staff: SupabaseClient;
  let outsider: SupabaseClient;
  let revoked: SupabaseClient;
  const users: Record<string, string> = {};
  const slugs = {
    active: `t-${RUN}-active`,
    draft: `t-${RUN}-draft`,
    future: `t-${RUN}-future`,
    expired: `t-${RUN}-expired`,
    archived: `t-${RUN}-archived`,
  };
  const uploaded: string[] = [];

  async function signedIn(name: string) {
    const email = `${name}-${RUN}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    users[name] = data.user.id;
    const c = createClient(URL_, PUB, opts);
    const { error: e2 } = await c.auth.signInWithPassword({ email, password: PASSWORD });
    if (e2) throw e2;
    return c;
  }

  const base = (slug: string, extra: Record<string, unknown> = {}) => ({
    slug,
    title: `Test ${slug}`,
    category: 'umrah',
    description: 'Automated test row',
    status: 'published',
    ...extra,
  });

  beforeAll(async () => {
    admin = createClient(URL_, SECRET, opts);
    anon = createClient(URL_, PUB, opts);
    staff = await signedIn('staff');
    outsider = await signedIn('outsider');
    revoked = await signedIn('revoked');

    const { error: se } = await admin.from('staff_members').insert([
      { user_id: users.staff, role: 'editor', active: true },
      { user_id: users.revoked, role: 'editor', active: true },
    ]);
    if (se) throw se;

    const { error: pe } = await admin.from('promotions').insert([
      base(slugs.active, { expires_at: iso(DAY) }),
      base(slugs.draft, { status: 'draft' }),
      base(slugs.future, { starts_at: iso(DAY) }),
      base(slugs.expired, { expires_at: iso(-60_000) }),
      base(slugs.archived, { status: 'archived' }),
    ]);
    if (pe) throw pe;
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    await admin.from('promotions').delete().like('slug', `t-${RUN}-%`);
    if (uploaded.length) await admin.storage.from(BUCKET).remove(uploaded);
    for (const id of Object.values(users)) await admin.auth.admin.deleteUser(id);
  }, 60_000);

  const testSlugs = async (c: SupabaseClient, table = 'promotions') => {
    const { data, error } = await c.from(table).select('slug').like('slug', `t-${RUN}-%`);
    expect(error).toBeNull();
    return (data ?? []).map((r: { slug: string }) => r.slug).sort();
  };

  describe('reading', () => {
    it('anonymous visitors see only currently active published offers', async () => {
      expect(await testSlugs(anon)).toEqual([slugs.active]);
      expect(await testSlugs(anon, 'public_promotions')).toEqual([slugs.active]);
    });

    it('signed-in non-staff users see the same as the public', async () => {
      expect(await testSlugs(outsider)).toEqual([slugs.active]);
    });

    it('active staff can see drafts, scheduled, expired and archived offers', async () => {
      expect(await testSlugs(staff)).toEqual(Object.values(slugs).sort());
    });

    it('the public view hides drafts even from staff', async () => {
      expect(await testSlugs(staff, 'public_promotions')).toEqual([slugs.active]);
    });

    it('a draft looked up by slug leaks nothing to anonymous visitors', async () => {
      const { data } = await anon.from('promotions').select('*').eq('slug', slugs.draft);
      expect(data).toEqual([]);
    });

    it('staff_members is not readable by the public, and users see only their own row', async () => {
      const a = await anon.from('staff_members').select('*');
      expect(a.data ?? []).toEqual([]);
      const o = await outsider.from('staff_members').select('*');
      expect(o.data ?? []).toEqual([]);
      const s = await staff.from('staff_members').select('user_id');
      expect(s.data).toEqual([{ user_id: users.staff }]);
    });
  });

  describe('writing', () => {
    it('anonymous visitors cannot insert, update or delete', async () => {
      const ins = await anon.from('promotions').insert(base(`t-${RUN}-anon`));
      expect(ins.error).not.toBeNull();
      const upd = await anon.from('promotions').update({ title: 'hacked' }).eq('slug', slugs.active).select();
      expect(upd.data ?? []).toEqual([]);
      const del = await anon.from('promotions').delete().eq('slug', slugs.active).select();
      expect(del.data ?? []).toEqual([]);
      expect(await testSlugs(anon)).toEqual([slugs.active]);
    });

    it('signed-in non-staff users cannot write', async () => {
      const ins = await outsider.from('promotions').insert(base(`t-${RUN}-outsider`));
      expect(ins.error?.code).toBe('42501');
      const upd = await outsider.from('promotions').update({ title: 'hacked' }).eq('slug', slugs.active).select();
      expect(upd.data ?? []).toEqual([]);
      const del = await outsider.from('promotions').delete().eq('slug', slugs.active).select();
      expect(del.data ?? []).toEqual([]);
    });

    it('nobody can add or elevate themselves in the staff allowlist', async () => {
      const self = await outsider.from('staff_members').insert({ user_id: users.outsider, role: 'owner', active: true });
      expect(self.error).not.toBeNull();
      const elevate = await staff.from('staff_members').update({ role: 'owner' }).eq('user_id', users.staff).select();
      expect(elevate.error !== null || (elevate.data ?? []).length === 0).toBe(true);
      const grant = await staff.from('staff_members').insert({ user_id: users.outsider, role: 'editor', active: true });
      expect(grant.error).not.toBeNull();
      const { data } = await admin.from('staff_members').select('role').eq('user_id', users.staff).single();
      expect(data?.role).toBe('editor');
    });

    it('staff can create, edit and delete; editor IDs come from the session, not the client', async () => {
      const slug = `t-${RUN}-staff`;
      const ins = await staff
        .from('promotions')
        .insert({ ...base(slug, { status: 'draft' }), created_by: users.outsider, updated_by: users.outsider })
        .select('*')
        .single();
      expect(ins.error).toBeNull();
      expect(ins.data.created_by).toBe(users.staff);
      expect(ins.data.updated_by).toBe(users.staff);

      const upd = await staff.from('promotions').update({ status: 'published' }).eq('id', ins.data.id).select('*').single();
      expect(upd.error).toBeNull();
      expect(upd.data.status).toBe('published');
      expect(await testSlugs(anon)).toContain(slug);

      const unpub = await staff.from('promotions').update({ status: 'draft' }).eq('id', ins.data.id).select('status').single();
      expect(unpub.data?.status).toBe('draft');
      expect(await testSlugs(anon)).not.toContain(slug);

      const del = await staff.from('promotions').delete().eq('id', ins.data.id).select('id');
      expect(del.data).toHaveLength(1);
    });
  });

  describe('constraints', () => {
    it('rejects duplicate slugs', async () => {
      const r = await staff.from('promotions').insert(base(slugs.active, { status: 'draft' }));
      expect(r.error?.code).toBe('23505');
    });

    it('enforces pricing rules and never allows zero/negative prices', async () => {
      const cases = [
        { pricing_mode: 'from' },
        { pricing_mode: 'fixed', price_min: 0 },
        { pricing_mode: 'fixed', price_min: -1 },
        { pricing_mode: 'range', price_min: 100 },
        { pricing_mode: 'range', price_min: 100, price_max: 50 },
        { pricing_mode: 'quote', price_min: 100 },
      ];
      for (const [i, c] of cases.entries()) {
        const r = await staff.from('promotions').insert(base(`t-${RUN}-price-${i}`, { status: 'draft', ...c }));
        expect(r.error?.code, JSON.stringify(c)).toBe('23514');
      }
      const ok = await staff
        .from('promotions')
        .insert(base(`t-${RUN}-price-ok`, { status: 'draft', pricing_mode: 'range', price_min: 100, price_max: 100 }));
      expect(ok.error).toBeNull();
    });

    it('requires a poster or description to publish, and end after start', async () => {
      const empty = await staff.from('promotions').insert(base(`t-${RUN}-empty`, { description: null }));
      expect(empty.error?.code).toBe('23514');
      const window = await staff
        .from('promotions')
        .insert(base(`t-${RUN}-window`, { status: 'draft', starts_at: iso(DAY), expires_at: iso(DAY / 2) }));
      expect(window.error?.code).toBe('23514');
      const badPath = await staff.from('promotions').insert(base(`t-${RUN}-path`, { status: 'draft', image_path: '../x.png', image_alt: 'x' }));
      expect(badPath.error?.code).toBe('23514');
    });

    it('expires at the exact exclusive boundary using database time', async () => {
      const slug = `t-${RUN}-boundary`;
      const r = await staff.from('promotions').insert(base(slug, { expires_at: iso(2500) }));
      expect(r.error).toBeNull();
      expect(await testSlugs(anon)).toContain(slug);
      await new Promise((res) => setTimeout(res, 3500));
      expect(await testSlugs(anon)).not.toContain(slug);
    });
  });

  describe('storage', () => {
    it('anonymous and non-staff users cannot upload', async () => {
      const a = await anon.storage.from(BUCKET).upload(posterPath(), WEBP, { contentType: 'image/webp' });
      expect(a.error).not.toBeNull();
      const o = await outsider.storage.from(BUCKET).upload(posterPath(), WEBP, { contentType: 'image/webp' });
      expect(o.error).not.toBeNull();
    });

    it('staff can upload to a valid path; the file is publicly readable', async () => {
      const path = posterPath();
      const up = await staff.storage.from(BUCKET).upload(path, WEBP, { contentType: 'image/webp' });
      expect(up.error).toBeNull();
      uploaded.push(path);
      const url = anon.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const res = await fetch(url);
      expect(res.status).toBe(200);
    });

    it('staff cannot upload outside the poster path pattern or with a disallowed type', async () => {
      const bad = await staff.storage.from(BUCKET).upload(`other/${crypto.randomUUID()}.webp`, WEBP, { contentType: 'image/webp' });
      expect(bad.error).not.toBeNull();
      const traversal = await staff.storage.from(BUCKET).upload(`posters/../${crypto.randomUUID()}.webp`, WEBP, { contentType: 'image/webp' });
      expect(traversal.error).not.toBeNull();
      const svg = await staff.storage
        .from(BUCKET)
        .upload(posterPath().replace('.webp', '.png'), new TextEncoder().encode('<svg/>'), { contentType: 'image/svg+xml' });
      expect(svg.error).not.toBeNull();
    });

    it('existing posters cannot be overwritten (no upsert)', async () => {
      const path = posterPath();
      await staff.storage.from(BUCKET).upload(path, WEBP, { contentType: 'image/webp' });
      uploaded.push(path);
      const again = await staff.storage.from(BUCKET).upload(path, WEBP, { contentType: 'image/webp', upsert: true });
      expect(again.error).not.toBeNull();
    });

    it('non-staff cannot delete posters; staff can', async () => {
      const path = posterPath();
      await staff.storage.from(BUCKET).upload(path, WEBP, { contentType: 'image/webp' });
      uploaded.push(path);
      await anon.storage.from(BUCKET).remove([path]);
      await outsider.storage.from(BUCKET).remove([path]);
      const url = anon.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      expect((await fetch(url)).status).toBe(200);
      const del = await staff.storage.from(BUCKET).remove([path]);
      expect(del.error).toBeNull();
      expect(del.data).toHaveLength(1);
    });
  });

  describe('revocation', () => {
    it('takes effect immediately for an existing session', async () => {
      // Works before revocation…
      const before = await revoked.from('promotions').insert(base(`t-${RUN}-rev1`, { status: 'draft' }));
      expect(before.error).toBeNull();

      await admin.from('staff_members').update({ active: false }).eq('user_id', users.revoked);

      // …same JWT, now denied.
      expect(await testSlugs(revoked)).toEqual([slugs.active]);
      const ins = await revoked.from('promotions').insert(base(`t-${RUN}-rev2`, { status: 'draft' }));
      expect(ins.error?.code).toBe('42501');
      const upd = await revoked.from('promotions').update({ title: 'x' }).eq('slug', `t-${RUN}-rev1`).select();
      expect(upd.data ?? []).toEqual([]);
      const up = await revoked.storage.from(BUCKET).upload(posterPath(), WEBP, { contentType: 'image/webp' });
      expect(up.error).not.toBeNull();
    });
  });
});

describe.skipIf(enabled)('RLS tests skipped', () => {
  it('needs SUPABASE_TEST_* in .env.test (local project, or ALLOW_REMOTE_DB_TESTS=yes)', () => {
    expect(enabled).toBe(false);
  });
});
