import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSupabase } from '../../lib/admin/supabase-browser';
import type { Promotion } from '../../lib/types';
import AccountPanel from './AccountPanel';
import LoginForm from './LoginForm';
import PromotionEditor from './PromotionEditor';
import PromotionsList from './PromotionsList';

type Access = { state: 'checking' } | { state: 'staff'; role: string; name: string | null } | { state: 'denied' } | { state: 'error' };
type View = { name: 'list' } | { name: 'edit'; promotion: Promotion | null } | { name: 'account' };

export default function AdminApp() {
  const sb = getSupabase();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [access, setAccess] = useState<Access>({ state: 'checking' });
  const [view, setView] = useState<View>({ name: 'list' });
  const [expired, setExpired] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const manualSignOut = useRef(false);
  const everSignedIn = useRef(false);

  useEffect(() => {
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT' && everSignedIn.current && !manualSignOut.current) setExpired(true);
      if (s) {
        everSignedIn.current = true;
        setExpired(false);
      }
      manualSignOut.current = false;
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  const checkAccess = useCallback(async () => {
    if (!sb || !session) return;
    setAccess({ state: 'checking' });
    const { data, error } = await sb
      .from('staff_members')
      .select('role, active, display_name')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) setAccess({ state: 'error' });
    else if (!data || !data.active) setAccess({ state: 'denied' });
    else setAccess({ state: 'staff', role: data.role, name: data.display_name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, session?.user.id]);

  useEffect(() => {
    if (session) void checkAccess();
  }, [session?.user.id, checkAccess]);

  const signOut = async () => {
    if (!sb) return;
    manualSignOut.current = true;
    everSignedIn.current = false;
    await sb.auth.signOut();
    setView({ name: 'list' });
    setAccess({ state: 'checking' });
  };

  /** Called by child views when the server says the session is no longer valid. */
  const onSessionProblem = useCallback(() => setExpired(true), []);

  if (!sb) {
    return (
      <Shell>
        <div className="admin-card">
          <h1>Dashboard not configured</h1>
          <p>
            This copy of the website has no Supabase connection, so offers can’t be managed here. Set{' '}
            <code>PUBLIC_SUPABASE_URL</code> and <code>PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> and rebuild (see <code>docs/SETUP.md</code>).
          </p>
        </div>
      </Shell>
    );
  }

  if (session === undefined) {
    return (
      <Shell>
        <p role="status">Loading…</p>
      </Shell>
    );
  }

  // Signed out (and not mid-edit): show the login screen.
  if (!session && !(expired && access.state === 'staff')) {
    return (
      <Shell>
        <LoginForm sb={sb} notice={expired ? 'Your session ended. Please sign in again.' : null} />
      </Shell>
    );
  }

  if (session && access.state === 'checking') {
    return (
      <Shell>
        <p role="status">Checking your access…</p>
      </Shell>
    );
  }

  if (session && (access.state === 'denied' || access.state === 'error')) {
    return (
      <Shell>
        <div className="admin-card">
          <h1>{access.state === 'denied' ? 'No dashboard access' : 'Couldn’t check your access'}</h1>
          <p>
            {access.state === 'denied'
              ? `You’re signed in as ${session.user.email}, but this account isn’t allowed to manage offers. Ask the owner to give you access.`
              : 'The server couldn’t be reached. Check your connection and try again.'}
          </p>
          <div className="btn-row">
            {access.state === 'error' ? (
              <button className="btn" type="button" onClick={() => void checkAccess()}>
                Try again
              </button>
            ) : null}
            <button className="btn btn--ghost" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const email = session?.user.email ?? '';
  return (
    <Shell>
      <header className="admin-bar">
        <div>
          <strong>Offers dashboard</strong>
          <span className="muted small"> · {access.state === 'staff' && access.name ? access.name : email}</span>
        </div>
        <nav className="btn-row" aria-label="Dashboard">
          <button type="button" className="btn btn--small btn--ghost" aria-current={view.name === 'list' ? 'page' : undefined} onClick={() => setView({ name: 'list' })}>
            All offers
          </button>
          <button type="button" className="btn btn--small btn--ghost" aria-current={view.name === 'account' ? 'page' : undefined} onClick={() => setView({ name: 'account' })}>
            Account
          </button>
          <a className="btn btn--small btn--ghost" href="/" target="_blank" rel="noopener">
            View website
          </a>
          <button type="button" className="btn btn--small" onClick={() => void signOut()}>
            Sign out
          </button>
        </nav>
      </header>

      {flash ? (
        <div className="admin-flash" role="status">
          {flash}
          <button type="button" className="linklike" onClick={() => setFlash(null)} aria-label="Dismiss message">
            ×
          </button>
        </div>
      ) : null}

      {view.name === 'list' ? (
        <PromotionsList
          sb={sb}
          onEdit={(p) => {
            setFlash(null);
            setView({ name: 'edit', promotion: p });
          }}
          onNew={() => {
            setFlash(null);
            setView({ name: 'edit', promotion: null });
          }}
          onSessionProblem={onSessionProblem}
        />
      ) : view.name === 'edit' ? (
        <PromotionEditor
          sb={sb}
          initial={view.promotion}
          onDone={(message) => {
            if (message) setFlash(message);
            setView({ name: 'list' });
          }}
          onSessionProblem={onSessionProblem}
        />
      ) : (
        <AccountPanel sb={sb} email={email} />
      )}

      {expired ? (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
          <div className="admin-card">
            <h2 id="reauth-title">Session expired</h2>
            <p>Sign in again to continue. Anything you were editing is still here.</p>
            <LoginForm sb={sb} compact defaultEmail={email} />
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="admin-shell">{children}</div>;
}
