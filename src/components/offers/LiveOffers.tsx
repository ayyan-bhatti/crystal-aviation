import { useCallback, useEffect, useRef, useState } from 'react';
import { isActive } from '../../lib/dates';
import { fetchActivePromotions, type ListOptions, type LoadResult } from '../../lib/promotions-api';
import type { Category, PublicPromotion } from '../../lib/types';
import { whatsappLink } from '../../lib/whatsapp';
import Icon from '../Icon';
import OfferCard from './OfferCard';
import { pickPhoto } from '../../lib/photo-pick';

interface Props {
  category?: Category | Category[];
  featuredOnly?: boolean;
  limit?: number;
  /** Server-rendered result (on-demand pages). Omit on prerendered pages to load in the browser. */
  initial?: LoadResult<PublicPromotion[]>;
  emptyText?: string;
  whatsappMessage: string;
  headingLevel?: 2 | 3;
  /** Link to the full offers list, shown under a non-empty list. */
  moreHref?: string;
  /** Category photos for offers without a poster. */
  fallbacks?: Partial<Record<string, string>>;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; items: PublicPromotion[]; demo: boolean; refreshFailed: boolean }
  | { kind: 'error' };

const REVALIDATE_AFTER_MS = 20_000;
const MAX_TIMER_MS = 2 ** 31 - 1;

function fromResult(r: LoadResult<PublicPromotion[]>): State {
  return r.status === 'ok'
    ? { kind: 'ready', items: r.data.filter((p) => isActive(p)), demo: !!r.demo, refreshFailed: false }
    : { kind: 'error' };
}

export default function LiveOffers({
  category,
  featuredOnly,
  limit = 6,
  initial,
  emptyText = 'There are no special offers published at the moment.',
  whatsappMessage,
  headingLevel = 3,
  moreHref,
  fallbacks,
}: Props) {
  const [state, setState] = useState<State>(() => (initial ? fromResult(initial) : { kind: 'loading' }));
  const lastLoad = useRef<number>(initial ? Date.now() : 0);
  const inFlight = useRef(false);
  const optsKey = JSON.stringify({ category, featuredOnly, limit });

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const opts: ListOptions = { category, featuredOnly, limit };
    const res = await fetchActivePromotions(opts);
    inFlight.current = false;
    lastLoad.current = Date.now();
    setState((prev) => {
      if (res.status === 'ok') return fromResult(res);
      // Keep already-shown offers on a failed background refresh, but still drop expired ones.
      if (prev.kind === 'ready') {
        return { ...prev, items: prev.items.filter((p) => isActive(p)), refreshFailed: true };
      }
      return { kind: 'error' };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optsKey]);

  // Initial load for prerendered pages.
  useEffect(() => {
    if (!initial) void load();
  }, [initial, load]);

  // Revalidate when the tab becomes visible / regains focus.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > REVALIDATE_AFTER_MS) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [load]);

  // Remove an offer from an open page the moment it expires.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const now = Date.now();
    const next = state.items
      .map((p) => (p.expires_at ? new Date(p.expires_at).getTime() : Infinity))
      .filter((t) => t > now)
      .sort((a, b) => a - b)[0];
    if (next === undefined || next === Infinity) return;
    const t = setTimeout(
      () => setState((s) => (s.kind === 'ready' ? { ...s, items: s.items.filter((p) => isActive(p)) } : s)),
      Math.min(next - now + 250, MAX_TIMER_MS),
    );
    return () => clearTimeout(t);
  }, [state]);

  const wa = whatsappLink(whatsappMessage);
  const firstCategory = Array.isArray(category) ? category[0] : category;
  const noticePhoto = pickPhoto(fallbacks, firstCategory ?? 'other');
  const photo = noticePhoto ? <img className="notice__photo" src={noticePhoto} alt="" loading="lazy" /> : null;

  if (state.kind === 'loading') {
    return (
      <div aria-busy="true" aria-live="polite">
        <p className="visually-hidden">Loading current offers…</p>
        <div className="offers-grid">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="notice notice--warn notice--with-photo" role="status">
        {photo}
        <div className="notice__body">
        <h3>We couldn’t load the latest offers just now</h3>
        <p>Please try again shortly, or ask us directly on WhatsApp for current Umrah, tour, ticket and hotel offers.</p>
        <div className="btn-row">
          <a className="btn btn--whatsapp btn--small" href={wa} target="_blank" rel="noopener">
            <Icon name="whatsapp" /> Ask on WhatsApp
          </a>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => void load()}>
            Try again
          </button>
        </div>
        </div>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className="notice notice--with-photo" role="status">
        {photo}
        <div className="notice__body">
        <p>{emptyText}</p>
        <p className="muted">Message us and we’ll share what’s currently available.</p>
        <div className="btn-row">
          <a className="btn btn--whatsapp btn--small" href={wa} target="_blank" rel="noopener">
            <Icon name="whatsapp" /> Continue on WhatsApp
          </a>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="offers-grid">
        {state.items.map((o) => (
          <OfferCard key={o.id} offer={o} headingLevel={headingLevel} fallbackSrc={pickPhoto(fallbacks, o.category, o.destination)} />
        ))}
      </div>
      {state.refreshFailed ? (
        <p className="small muted" role="status" style={{ marginTop: 'var(--space-s)' }}>
          Couldn’t check for newer offers. Showing the offers loaded earlier.
        </p>
      ) : null}
      {moreHref ? (
        <p style={{ marginTop: 'var(--space-l)' }}>
          <a className="text-link" href={moreHref}>
            See all current offers
          </a>
        </p>
      ) : null}
    </div>
  );
}
