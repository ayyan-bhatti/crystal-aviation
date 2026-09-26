import type { SupabaseClient } from '@supabase/supabase-js';
import { useId, useState, type SubmitEvent } from 'react';
import { friendlyError } from '../../lib/admin/supabase-browser';

export default function AccountPanel({ sb, email }: { sb: SupabaseClient; email: string }) {
  const id = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const tooShort = next.length > 0 && next.length < 10;
  const mismatch = confirm.length > 0 && confirm !== next;

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    if (next.length < 10 || !/[a-z]/i.test(next) || !/\d/.test(next)) {
      setResult({ ok: false, text: 'Use at least 10 characters, including letters and numbers.' });
      return;
    }
    if (next !== confirm) {
      setResult({ ok: false, text: 'The new passwords don’t match.' });
      return;
    }
    setBusy(true);
    // Confirm the current password first, so an unattended open session can't change it.
    const { error: reauthErr } = await sb.auth.signInWithPassword({ email, password: current });
    if (reauthErr) {
      setBusy(false);
      setResult({ ok: false, text: 'Your current password is incorrect.' });
      return;
    }
    const { error } = await sb.auth.updateUser({ password: next });
    setBusy(false);
    if (error) {
      setResult({ ok: false, text: /same|different/i.test(error.message) ? 'Choose a password different from your current one.' : friendlyError(error).message });
      return;
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    setResult({ ok: true, text: 'Password changed. Use the new password next time you sign in.' });
  }

  return (
    <section className="admin-card" aria-labelledby={`${id}-title`} style={{ maxWidth: '34rem' }}>
      <h1 id={`${id}-title`}>Account</h1>
      <p className="muted">Signed in as {email}</p>
      <h2>Change password</h2>
      <form className="form-grid" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={`${id}-cur`}>Current password</label>
          <input id={`${id}-cur`} className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor={`${id}-new`}>New password</label>
          <input id={`${id}-new`} className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={tooShort || undefined} aria-describedby={`${id}-hint`} required />
          <span id={`${id}-hint`} className="hint">At least 10 characters, with letters and numbers.</span>
        </div>
        <div className="field">
          <label htmlFor={`${id}-conf`}>Confirm new password</label>
          <input id={`${id}-conf`} className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch || undefined} required />
          {mismatch ? <span className="field-error">Passwords don’t match.</span> : null}
        </div>
        {result ? (
          <p className={result.ok ? 'admin-ok' : 'field-error'} role={result.ok ? 'status' : 'alert'}>
            {result.text}
          </p>
        ) : null}
        <button className="btn" type="submit" disabled={busy || !current || !next || !confirm}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </form>
      <h2 style={{ marginTop: 'var(--space-xl)' }}>Lost access?</h2>
      <p className="small muted">
        If you forget your password, the owner can set a temporary one for you from the Supabase dashboard (see the owner
        guide). Change it here after signing in.
      </p>
    </section>
  );
}
