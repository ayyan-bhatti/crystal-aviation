#!/usr/bin/env node
// Manual backup of offers data AND poster files (Supabase Free has no automatic backups,
// and a database dump does not include Storage files).
//
//   npm run backup:posters                   -> backups/<timestamp>/{promotions.json, staff_members.json, posters/...}
//   npm run backup:posters -- restore backups/<timestamp>   -> re-uploads missing posters and upserts promotions
//
// Uses the SECRET key from .env.local. Keep backups private: they include drafts.
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}
const sb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = 'promotion-posters';

async function backup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join('backups', stamp);
  mkdirSync(join(dir, 'posters'), { recursive: true });

  const { data: promos, error } = await sb.from('promotions').select('*').order('created_at');
  if (error) throw error;
  writeFileSync(join(dir, 'promotions.json'), JSON.stringify(promos, null, 2));
  const { data: staff } = await sb.from('staff_members').select('*');
  writeFileSync(join(dir, 'staff_members.json'), JSON.stringify(staff ?? [], null, 2));

  let count = 0;
  for (let offset = 0; ; offset += 100) {
    const { data: files, error: le } = await sb.storage.from(BUCKET).list('posters', { limit: 100, offset });
    if (le) throw le;
    for (const f of files) {
      if (!f.id) continue; // folder placeholder
      const { data: blob, error: de } = await sb.storage.from(BUCKET).download(`posters/${f.name}`);
      if (de) throw de;
      writeFileSync(join(dir, 'posters', f.name), Buffer.from(await blob.arrayBuffer()));
      count++;
    }
    if (files.length < 100) break;
  }
  console.log(`Backed up ${promos.length} offers and ${count} poster files to ${dir}`);
}

async function restore(dir) {
  if (!dir || !existsSync(join(dir, 'promotions.json'))) throw new Error('Give a backup folder containing promotions.json');
  const types = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };
  let up = 0;
  for (const name of readdirSync(join(dir, 'posters'))) {
    const ext = name.split('.').pop();
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(`posters/${name}`, readFileSync(join(dir, 'posters', name)), { contentType: types[ext], upsert: false });
    if (!error) up++;
    else if (!/exists|duplicate/i.test(error.message)) console.warn(`Poster ${name}: ${error.message}`);
  }
  const promos = JSON.parse(readFileSync(join(dir, 'promotions.json'), 'utf8'));
  // created_by/updated_by may reference users that no longer exist; clear them.
  const rows = promos.map((p) => ({ ...p, created_by: null, updated_by: null }));
  const { error } = await sb.from('promotions').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  console.log(`Restored ${rows.length} offers and uploaded ${up} missing posters. Staff accounts are NOT restored automatically; re-add them with npm run staff:add.`);
}

const [cmd, arg] = process.argv.slice(2);
(cmd === 'restore' ? restore(arg) : backup()).catch((e) => {
  console.error('Error:', e.message ?? e);
  process.exit(1);
});
