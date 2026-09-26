import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { deletePosterIfUnused } from '../../lib/admin/posters';
import { friendlyError } from '../../lib/admin/supabase-browser';
import { formatValidThrough, isActive } from '../../lib/dates';
import { formatPrice } from '../../lib/pricing';
import { posterUrl } from '../../lib/promotions-api';
import { CATEGORY_LABELS, type Promotion, type Status } from '../../lib/types';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  sb: SupabaseClient;
  onEdit: (p: Promotion) => void;
  onNew: () => void;
  onSessionProblem: () => void;
}

type Filter = 'all' | 'live' | 'draft' | 'archived';

export function liveState(p: Promotion, now = new Date()): { label: string; tone: 'live' | 'draft' | 'muted' | 'warn' } {
  if (p.status === 'draft') return { label: 'Draft', tone: 'draft' };
  if (p.status === 'archived') return { label: 'Hidden', tone: 'muted' };
  if (p.starts_at && new Date(p.starts_at) > now) return { label: 'Scheduled', tone: 'warn' };
  if (p.expires_at && new Date(p.expires_at) <= now) return { label: 'Expired', tone: 'muted' };
  return { label: 'Live on website', tone: 'live' };
}

export default function PromotionsList({ sb, onEdit, onNew, onSessionProblem }: Props) {
  const [items, setItems] = useState<Promotion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<Promotion | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await sb.from('promotions').select('*').order('updated_at', { ascending: false }).limit(200);
    if (error) {
      const f = friendlyError(error);
      if (f.kind === 'auth') onSessionProblem();
      setLoadError(f.message);
      return;
    }
    setItems(data as Promotion[]);
  }, [sb, onSessionProblem]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    if (!items) return [];
    if (filter === 'live') return items.filter((p) => isActive(p));
    if (filter === 'draft') return items.filter((p) => p.status === 'draft');
    if (filter === 'archived') return items.filter((p) => p.status === 'archived');
    return items;
  }, [items, filter]);

  function report(err: unknown) {
    const f = friendlyError(err);
    if (f.kind === 'auth') onSessionProblem();
    setMessage({ ok: false, text: f.message });
  }

  async function setStatus(p: Promotion, status: Status) {
    setBusyId(p.id);
    setMessage(null);
    const { data, error } = await sb.from('promotions').update({ status }).eq('id', p.id).select('*').single();
    setBusyId(null);
    if (error) {
      // A published offer missing a poster/description is rejected by the database.
      if (error.code === '23514' && status === 'published') {
        setMessage({ ok: false, text: `“${p.title}” needs a poster (with a description of it) or a written description before it can be published. Open it to add one.` });
      } else report(error);
      return;
    }
    const row = data as Promotion;
    setItems((prev) => prev?.map((x) => (x.id === row.id ? row : x)) ?? null);
    const verb = status === 'published' ? 'Published' : status === 'draft' ? 'Unpublished (now a draft)' : 'Hidden from the website';
    const st = liveState(row);
    if (status === 'published' && st.tone !== 'live') {
      const why = st.label === 'Expired' ? 'its “Valid through” date has passed. Open it with Edit and change or clear the date.' : 'its “Show from” date is still in the future.';
      setMessage({ ok: false, text: `Published “${row.title}”, but it is not showing on the website because ${why}` });
      return;
    }
    setMessage({ ok: true, text: `${verb}: “${row.title}”.` });
  }

  async function duplicate(p: Promotion) {
    setBusyId(p.id);
    setMessage(null);
    const { id: _id, created_at: _c, updated_at: _u, created_by: _cb, updated_by: _ub, ...rest } = p;
    let lastError: unknown = null;
    for (let n = 1; n <= 5; n++) {
      const suffix = n === 1 ? '-copy' : `-copy-${n}`;
      const slug = (p.slug.slice(0, 80 - suffix.length) + suffix).replace(/-+$/, '');
      const { data, error } = await sb
        .from('promotions')
        .insert({ ...rest, slug, title: `Copy of ${p.title}`.slice(0, 120), status: 'draft', featured: false })
        .select('*')
        .single();
      if (!error) {
        setBusyId(null);
        const row = data as Promotion;
        setItems((prev) => (prev ? [row, ...prev] : [row]));
        setMessage({ ok: true, text: `Duplicated as a draft: “${row.title}”. It shares the same poster until you replace it.` });
        return;
      }
      lastError = error;
      if (error.code !== '23505') break;
    }
    setBusyId(null);
    report(lastError);
  }

  async function confirmDelete() {
    const p = toDelete;
    if (!p) return;
    setBusyId(p.id);
    setMessage(null);
    const { data, error } = await sb.from('promotions').delete().eq('id', p.id).select('id');
    setBusyId(null);
    setToDelete(null);
    if (error) return report(error);
    if (!data || data.length === 0) {
      setMessage({ ok: false, text: 'The offer wasn’t deleted. It may already be gone, or your access may have changed. Refresh the list.' });
      return;
    }
    setItems((prev) => prev?.filter((x) => x.id !== p.id) ?? null);
    await deletePosterIfUnused(sb, p.image_path);
    setMessage({ ok: true, text: `Deleted “${p.title}”.` });
  }

  return (
    <section aria-labelledby="list-title">
      <div className="admin-head">
        <div>
          <h1 id="list-title">Offers</h1>
          <p className="muted small">Published offers appear on the website immediately. No rebuild is needed.</p>
        </div>
        <button type="button" className="btn" onClick={onNew}>
          + Add offer
        </button>
      </div>

      <div className="admin-toolbar">
        <label htmlFor="offer-filter" className="small">
          Show
        </label>
        <select id="offer-filter" className="select" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={{ width: 'auto' }}>
          <option value="all">All offers</option>
          <option value="live">Live on website</option>
          <option value="draft">Drafts</option>
          <option value="archived">Hidden</option>
        </select>
        <button type="button" className="btn btn--small btn--ghost" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <div aria-live="polite">
        {message ? <p className={message.ok ? 'admin-ok' : 'admin-error'}>{message.text}</p> : null}
      </div>

      {loadError ? (
        <div className="admin-error" role="alert">
          {loadError}{' '}
          <button type="button" className="linklike" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : items === null ? (
        <p role="status">Loading offers…</p>
      ) : shown.length === 0 ? (
        <div className="admin-card">
          <p style={{ margin: 0 }}>{items.length === 0 ? 'No offers yet. Select “Add offer” to create the first one.' : 'No offers match this filter.'}</p>
        </div>
      ) : (
        <ul className="admin-list">
          {shown.map((p) => {
            const st = liveState(p);
            const img = posterUrl(p.image_path);
            const busy = busyId === p.id;
            return (
              <li key={p.id} className="admin-row" aria-busy={busy || undefined}>
                <div className="admin-row__thumb">{img ? <img src={img} alt="" loading="lazy" /> : <span aria-hidden="true">No poster</span>}</div>
                <div className="admin-row__main">
                  <h2 className="admin-row__title">{p.title}</h2>
                  <p className="small muted" style={{ margin: 0 }}>
                    <span className={`status status--${st.tone}`}>{st.label}</span> · {CATEGORY_LABELS[p.category]} · {formatPrice(p).label}
                    {p.featured ? ' · On homepage' : ''}
                    {p.expires_at ? ` · Valid until ${formatValidThrough(p.expires_at)}` : ''}
                  </p>
                </div>
                <div className="admin-row__actions">
                  <button type="button" className="btn btn--small" onClick={() => onEdit(p)} disabled={busy}>
                    Edit
                  </button>
                  {p.status === 'published' ? (
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => void setStatus(p, 'draft')} disabled={busy}>
                      Unpublish
                    </button>
                  ) : (
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => void setStatus(p, 'published')} disabled={busy}>
                      Publish
                    </button>
                  )}
                  <details className="admin-more">
                    <summary className="btn btn--small btn--ghost">More</summary>
                    <div className="admin-more__menu">
                      {p.status === 'published' ? (
                        <a href={`/promotions/${p.slug}`} target="_blank" rel="noopener">
                          View on website
                        </a>
                      ) : null}
                      <button type="button" onClick={() => void duplicate(p)} disabled={busy}>
                        Duplicate
                      </button>
                      {p.status !== 'archived' ? (
                        <button type="button" onClick={() => void setStatus(p, 'archived')} disabled={busy}>
                          Hide (archive)
                        </button>
                      ) : null}
                      <button type="button" className="danger" onClick={() => setToDelete(p)} disabled={busy}>
                        Delete…
                      </button>
                    </div>
                  </details>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this offer?"
        confirmLabel="Delete permanently"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      >
        <p>
          “{toDelete?.title}” will be removed from the website and the dashboard. This can’t be undone. To take it off the
          website but keep it, choose <strong>Unpublish</strong> or <strong>Hide</strong> instead.
        </p>
      </ConfirmDialog>
    </section>
  );
}
