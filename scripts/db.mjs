// Runs Supabase CLI database commands against the hosted project in SUPABASE_DB_URL (.env.local).
// Usage: npm run db:push | npm run db:types
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL is missing. Add it to .env.local (see .env.example).');
  process.exit(1);
}

const cmd = process.argv[2];
const run = (args, capture = false) =>
  spawnSync('npx', ['supabase', ...args], {
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    shell: process.platform === 'win32',
    encoding: 'utf8',
  });

if (cmd === 'push') {
  const r = run(['db', 'push', '--db-url', dbUrl]);
  process.exit(r.status ?? 1);
} else if (cmd === 'types') {
  const r = run(['gen', 'types', 'typescript', '--db-url', dbUrl, '--schema', 'public'], true);
  if (r.status !== 0) process.exit(r.status ?? 1);
  writeFileSync('src/lib/database.types.ts', r.stdout);
  console.log('Wrote src/lib/database.types.ts');
} else {
  console.error('Usage: node scripts/db.mjs push|types');
  process.exit(1);
}
