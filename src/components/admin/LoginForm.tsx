import type { SupabaseClient } from '@supabase/supabase-js';
import { useId, useState, type SubmitEvent } from 'react';
import { friendlyError } from '../../lib/admin/supabase-browser';

interface Props {
  sb: SupabaseClient;
  notice?: string | null;
  compact?: boolean;
  defaultEmail?: string;
}

export default function LoginForm({ sb, notice, compact, defaultEmail = '' }: Props) {
  const id = useId();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      const f = friendlyError(err);
      setError(
        /invalid login|invalid credentials/i.test(err.message)
          ? 'Email or password is incorrect.'
          : f.kind === 'network'
            ? f.message
            : 'Couldn’t sign in. Please try again.',
      );
      return;
    }
    setPassword('');
  }

  const form = (
    <form onSubmit={onSubmit} className="form-grid" noValidate>
      {notice ? <p className="notice notice--warn small" role="status">{notice}</p> : null}
      <div className="field">
        <label htmlFor={`${id}-email`}>Email</label>
        <input id={`${id}-email`} className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-pw`}>Password</label>
        <input id={`${id}-pw`} className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn" type="submit" disabled={busy || !email || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="small muted" style={{ margin: 0 }}>
        Forgot your password? Ask the owner to reset it for you. There is no public sign-up.
      </p>
    </form>
  );

  if (compact) return form;
  return (
    <div className="admin-card admin-login">
      <p className="eyebrow">The Crystal Aviation</p>
      <h1>Staff sign in</h1>
      {form}
    </div>
  );
}
