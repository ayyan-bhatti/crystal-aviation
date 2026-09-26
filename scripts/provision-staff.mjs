#!/usr/bin/env node
// Trusted local tool for the owner/developer. Uses the SECRET key from .env.local.
// Never run this on a shared computer, and never deploy it.
//
//   npm run staff:add -- add umar@example.com --name "Umar Farooq" [--role owner]
//   npm run staff:add -- reset-password umar@example.com
//   npm run staff:add -- revoke umar@example.com
//   npm run staff:add -- restore umar@example.com
//   npm run staff:add -- list
//
// Passwords are typed in at a hidden prompt. They are never stored in files.
import { createClient } from '@supabase/supabase-js';
import readline from 'node:readline';

const url = process.env.PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}
const sb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const [cmd, email, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (s) => (s.includes(question) ? write?.(s) : write?.('*'));
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function askPassword() {
  const pw = await askHidden('Password (min 10 chars, letters + numbers): ');
  if (pw.length < 10 || !/[a-z]/i.test(pw) || !/\d/.test(pw)) throw new Error('Password too weak.');
  const again = await askHidden('Repeat password: ');
  if (pw !== again) throw new Error('Passwords do not match.');
  return pw;
}

async function findUser(e) {
  const target = e.toLowerCase();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === target);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  if (cmd === 'list') {
    const { data, error } = await sb.from('staff_members').select('user_id, role, active, display_name, updated_at');
    if (error) throw error;
    for (const m of data) {
      const { data: u } = await sb.auth.admin.getUserById(m.user_id);
      console.log(`${m.active ? 'ACTIVE ' : 'REVOKED'}  ${m.role.padEnd(6)}  ${u?.user?.email ?? m.user_id}  ${m.display_name ?? ''}`);
    }
    return;
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Give a valid email address.');

  if (cmd === 'add') {
    const role = flag('role') ?? 'editor';
    if (!['editor', 'owner'].includes(role)) throw new Error('Role must be editor or owner.');
    let user = await findUser(email);
    if (!user) {
      const password = await askPassword();
      const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      user = data.user;
      console.log(`Created confirmed account ${email}.`);
    } else {
      console.log(`Account ${email} already exists; granting access.`);
    }
    const { error } = await sb
      .from('staff_members')
      .upsert({ user_id: user.id, role, active: true, display_name: flag('name') ?? null }, { onConflict: 'user_id' });
    if (error) throw error;
    console.log(`${email} can now manage offers (${role}). Share the password with them in person, not by email.`);
  } else if (cmd === 'reset-password') {
    const user = await findUser(email);
    if (!user) throw new Error('No such account.');
    const password = await askPassword();
    const { error } = await sb.auth.admin.updateUserById(user.id, { password });
    if (error) throw error;
    console.log(`Password reset for ${email}. Ask them to change it under Account after signing in.`);
  } else if (cmd === 'revoke' || cmd === 'restore') {
    const user = await findUser(email);
    if (!user) throw new Error('No such account.');
    const { data, error } = await sb.from('staff_members').update({ active: cmd === 'restore' }).eq('user_id', user.id).select();
    if (error) throw error;
    if (!data.length) throw new Error(`${email} is not in the staff list.`);
    // RLS checks staff_members on every request, so this applies immediately,
    // even to a session that is already signed in.
    if (cmd === 'revoke') console.log(`Access revoked for ${email}. Their dashboard can no longer read drafts or change anything.`);
    else console.log(`Access restored for ${email}.`);
  } else {
    throw new Error('Unknown command. Use: add | reset-password | revoke | restore | list');
  }
}

main().catch((e) => {
  console.error('Error:', e.message ?? e);
  process.exit(1);
});
