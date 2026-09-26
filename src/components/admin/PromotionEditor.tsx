import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { site } from '../../config/site';
import { deletePosterIfUnused, preparePoster, uploadPoster, type PreparedPoster } from '../../lib/admin/posters';
import {
  emptyForm,
  formFromRow,
  LIMITS,
  previewFromForm,
  publishWarnings,
  rowFromForm,
  validateForm,
  type FieldErrors,
  type FormState,
} from '../../lib/admin/promotion-form';
import { friendlyError } from '../../lib/admin/supabase-browser';
import { POSTER_BUCKET } from '../../lib/config';
import { posterUrl } from '../../lib/promotions-api';
import { slugify } from '../../lib/slug';
import { CATEGORIES, CATEGORY_LABELS, PRICE_BASES, PRICE_BASIS_LABELS, type Promotion, type Status } from '../../lib/types';
import OfferCard from '../offers/OfferCard';
import OfferDetailView from '../offers/OfferDetailView';
import { liveState } from './PromotionsList';

interface Props {
  sb: SupabaseClient;
  initial: Promotion | null;
  onDone: (message?: string) => void;
  onSessionProblem: () => void;
}

interface Pending {
  poster: PreparedPoster;
  objectUrl: string;
  originalName: string;
}

const FIELD_LABELS: Partial<Record<keyof FieldErrors, string>> = {
  title: 'Title',
  slug: 'Web address',
  image_alt: 'Poster description',
  content: 'Poster or description',
  price_min: 'Price',
  price_max: 'Highest price',
  currency: 'Currency',
  summary: 'Short summary',
  description: 'Description',
  destination: 'Destination',
  duration: 'Duration',
  travel_end: 'Travel end date',
  inclusions: 'Included',
  exclusions: 'Not included',
  terms: 'Terms',
  valid_through: 'Valid through',
  sort_order: 'Order',
};

export default function PromotionEditor({ sb, initial, onDone, onSessionProblem }: Props) {
  const uid = useId();
  const [row, setRow] = useState<Promotion | null>(initial);
  const [form, setForm] = useState<FormState>(() => (initial ? formFromRow(initial) : emptyForm()));
  const [savedForm, setSavedForm] = useState<string>(() => JSON.stringify(initial ? formFromRow(initial) : emptyForm()));
  const [imagePath, setImagePath] = useState<string | null>(initial?.image_path ?? null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [removePoster, setRemovePoster] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState<Status | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: ReactNode } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasPoster = !!pending || (!!imagePath && !removePoster);
  const dirty = JSON.stringify(form) !== savedForm || !!pending || removePoster;
  const status: Status = row?.status ?? 'draft';

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  useEffect(() => () => {
    if (pending) URL.revokeObjectURL(pending.objectUrl);
  }, [pending]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'title' && !f.slugTouched) next.slug = slugify(String(value));
      return next;
    });
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function onPosterChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPosterError(null);
    setPosterBusy(true);
    try {
      const poster = await preparePoster(file);
      if (pending) URL.revokeObjectURL(pending.objectUrl);
      setPending({ poster, objectUrl: URL.createObjectURL(poster.blob), originalName: file.name });
      setRemovePoster(false);
      if (!form.image_alt.trim() && form.title.trim()) set('image_alt', `Poster for ${form.title.trim()}`);
      setErrors((x) => ({ ...x, content: undefined }));
    } catch (err) {
      setPosterError((err as Error).message);
    } finally {
      setPosterBusy(false);
    }
  }

  function clearPoster() {
    if (pending) {
      URL.revokeObjectURL(pending.objectUrl);
      setPending(null);
    }
    if (imagePath) setRemovePoster(true);
  }

  async function save(target: Status) {
    setResult(null);
    const errs = validateForm(form, { hasPoster, publishing: target === 'published' });
    const active = Object.fromEntries(Object.entries(errs).filter(([, v]) => v)) as FieldErrors;
    setErrors(active);
    if (Object.keys(active).length) {
      setResult({ ok: false, text: 'Please fix the items listed below.' });
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setSaving(target);
    let uploaded: string | null = null;
    try {
      if (pending) uploaded = await uploadPoster(sb, pending.poster);
    } catch (err) {
      setSaving(null);
      const f = friendlyError(err);
      if (f.kind === 'auth') onSessionProblem();
      setResult({ ok: false, text: `The poster couldn’t be uploaded, so nothing was saved. ${f.message}` });
      return;
    }

    const nextPath = uploaded ?? (removePoster ? null : imagePath);
    const payload = rowFromForm(form, target, nextPath);

    const query = row
      ? sb.from('promotions').update(payload).eq('id', row.id).eq('updated_at', row.updated_at).select('*').maybeSingle()
      : sb.from('promotions').insert(payload).select('*').single();
    const { data, error } = await query;

    if (error || !data) {
      // Never leave a newly uploaded file behind when the save failed.
      if (uploaded) await sb.storage.from(POSTER_BUCKET).remove([uploaded]).catch(() => undefined);
      setSaving(null);
      if (!error) {
        setResult({
          ok: false,
          text: 'Not saved. This offer was changed in another window, deleted, or your access changed. Go back to the list, refresh, and try again. (Your text is still here, so you can copy it.)',
        });
        return;
      }
      const f = friendlyError(error);
      if (f.kind === 'auth') onSessionProblem();
      if (f.kind === 'conflict') setErrors((x) => ({ ...x, slug: f.message }));
      setResult({ ok: false, text: `Not saved. ${f.message}` });
      return;
    }

    const saved = data as Promotion;
    const oldPath = imagePath;
    // Only after the new poster is safely saved do we remove the old one.
    if (oldPath && oldPath !== saved.image_path) await deletePosterIfUnused(sb, oldPath);

    if (pending) URL.revokeObjectURL(pending.objectUrl);
    setPending(null);
    setRemovePoster(false);
    setImagePath(saved.image_path);
    setRow(saved);
    const nextForm = formFromRow(saved);
    setForm(nextForm);
    setSavedForm(JSON.stringify(nextForm));
    setSaving(null);

    const st = liveState(saved);
    const liveLink =
      saved.status === 'published' && st.tone === 'live' ? (
        <>
          {' '}
          <a href={`/promotions/${saved.slug}`} target="_blank" rel="noopener">
            View it on the website
          </a>
          .
        </>
      ) : null;
    const notShowing =
      st.label === 'Expired'
        ? ' It is not on the website because its “Valid through” date has passed.'
        : st.label === 'Scheduled'
          ? ' It will appear on the website on its “Show from” date.'
          : '';
    const text =
      target === 'published'
        ? (status === 'published' ? 'Changes saved.' : 'Published.') + (notShowing || ' It is live on the website now.')
        : target === 'draft' && status === 'published'
          ? 'Unpublished. It is now a draft and hidden from the website.'
          : 'Saved as a draft. It is not on the website yet.';
    setResult({ ok: true, text: <>{text}{liveLink}</> });
  }

  function goBack() {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    onDone();
  }

  const warnings = useMemo(() => publishWarnings(form), [form]);
  const previewImage = pending?.objectUrl ?? (removePoster ? null : posterUrl(imagePath));
  const preview = previewFromForm(form, previewImage ? 'preview' : null);
  const errorEntries = Object.entries(errors).filter(([, v]) => v) as [keyof FieldErrors, string][];
  const st = row ? liveState(row) : null;

  const field = (key: keyof FormState) => ({
    id: `${uid}-${key}`,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${uid}-${key}-err` : undefined,
  });
  const err = (key: keyof FieldErrors) =>
    errors[key] ? (
      <span id={`${uid}-${key}-err`} className="field-error">
        {errors[key]}
      </span>
    ) : null;

  return (
    <section aria-labelledby={`${uid}-h`}>
      <div className="admin-head">
        <div>
          <button type="button" className="linklike small" onClick={goBack}>
            ← All offers
          </button>
          <h1 id={`${uid}-h`}>{row ? 'Edit offer' : 'Add offer'}</h1>
          {st ? (
            <p className="small">
              Status: <span className={`status status--${st.tone}`}>{st.label}</span>
              {dirty ? <span className="muted"> · Unsaved changes</span> : null}
            </p>
          ) : (
            <p className="small muted">New offers are saved as drafts until you publish.</p>
          )}
        </div>
      </div>

      <div aria-live="polite" ref={summaryRef} tabIndex={-1}>
        {result ? <div className={result.ok ? 'admin-ok' : 'admin-error'}>{result.text}</div> : null}
        {errorEntries.length ? (
          <ul className="admin-error-list">
            {errorEntries.map(([k, v]) => (
              <li key={k}>
                <a href={`#${uid}-${k === 'content' ? 'poster' : k}`}>{FIELD_LABELS[k] ?? k}</a>: {v}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="editor-grid">
        <form className="admin-card editor-form" onSubmit={(e) => e.preventDefault()} noValidate>
          <p className="small muted">
            Fields marked <span className="req">*</span> are required. Everything else is optional.
          </p>

          <div className="field">
            <label htmlFor={`${uid}-title`}>
              Title <span className="req">*</span>
            </label>
            <input {...field('title')} className="input" maxLength={LIMITS.title} value={form.title} onChange={(e) => set('title', e.target.value)} />
            {err('title')}
          </div>

          <div className="field">
            <label htmlFor={`${uid}-category`}>
              Type of offer <span className="req">*</span>
            </label>
            <select {...field('category')} className="select" value={form.category} onChange={(e) => set('category', e.target.value as FormState['category'])}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="field editor-poster" id={`${uid}-poster`}>
            <legend>
              Poster <span className="opt">(needed unless you write a description)</span>
            </legend>
            {previewImage ? (
              <div className="editor-poster__preview">
                <img src={previewImage} alt="" />
                <div className="small">
                  {pending ? (
                    <p>
                      New poster ready: {pending.poster.width}×{pending.poster.height}px, {(pending.poster.blob.size / 1024 / 1024).toFixed(2)} MB. It’s uploaded when you save.
                    </p>
                  ) : (
                    <p>Current poster.</p>
                  )}
                  <div className="btn-row">
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => fileRef.current?.click()} disabled={posterBusy}>
                      Replace poster
                    </button>
                    <button type="button" className="btn btn--small btn--ghost" onClick={clearPoster} disabled={posterBusy}>
                      Remove poster
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()} disabled={posterBusy}>
                {posterBusy ? 'Preparing image…' : 'Choose poster image'}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" tabIndex={-1} onChange={(e) => void onPosterChange(e)} aria-label="Poster image file" />
            {removePoster && !pending ? <p className="small">The poster will be removed when you save.</p> : null}
            {posterBusy && previewImage ? <p className="small" role="status">Preparing image…</p> : null}
            {posterError ? <p className="field-error" role="alert">{posterError}</p> : null}
            {err('content')}
            <p className="hint">
              JPEG, PNG or WebP, up to 15 MB. It’s resized automatically, and the full poster is always shown without cropping.{' '}
              <strong>Poster images are public files:</strong> anyone with the image link can see it, even while the offer is a draft. Don’t
              upload anything confidential.
            </p>
            {hasPoster ? (
              <div className="field" style={{ marginTop: 'var(--space-s)' }}>
                <label htmlFor={`${uid}-image_alt`}>
                  Describe the poster <span className="req">*</span>
                </label>
                <input {...field('image_alt')} className="input" maxLength={LIMITS.image_alt} value={form.image_alt} onChange={(e) => set('image_alt', e.target.value)} />
                <span className="hint">Read aloud to people who can’t see the image. Also put the key details (price, dates) in the fields below, not only in the poster.</span>
                {err('image_alt')}
              </div>
            ) : null}
          </fieldset>

          <div className="field">
            <label htmlFor={`${uid}-summary`}>
              Short summary <span className="opt">(optional, shown on offer cards)</span>
            </label>
            <input {...field('summary')} className="input" maxLength={LIMITS.summary} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
            {err('summary')}
          </div>

          <div className="field">
            <label htmlFor={`${uid}-description`}>
              Description <span className="opt">(optional if you add a poster)</span>
            </label>
            <textarea {...field('description')} className="textarea" maxLength={LIMITS.description} value={form.description} onChange={(e) => set('description', e.target.value)} />
            <span className="hint">Plain text. Line breaks are kept.</span>
            {err('description')}
          </div>

          <fieldset className="field">
            <legend>Price</legend>
            <div className="radio-row">
              {(
                [
                  ['quote', 'Contact for price'],
                  ['from', 'Starting from'],
                  ['fixed', 'Fixed price'],
                  ['range', 'Price range'],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="radio">
                  <input type="radio" name={`${uid}-pm`} value={v} checked={form.pricing_mode === v} onChange={() => set('pricing_mode', v)} /> {label}
                </label>
              ))}
            </div>
            {form.pricing_mode === 'quote' ? (
              <p className="hint">The website shows “Contact for price”. No amount is displayed.</p>
            ) : (
              <div className="form-grid form-grid--2">
                <div className="field">
                  <label htmlFor={`${uid}-price_min`}>
                    {form.pricing_mode === 'range' ? 'Lowest price' : 'Price'} ({form.currency || 'PKR'}) <span className="req">*</span>
                  </label>
                  <input {...field('price_min')} className="input" inputMode="decimal" value={form.price_min} onChange={(e) => set('price_min', e.target.value)} />
                  {err('price_min')}
                </div>
                {form.pricing_mode === 'range' ? (
                  <div className="field">
                    <label htmlFor={`${uid}-price_max`}>
                      Highest price ({form.currency || 'PKR'}) <span className="req">*</span>
                    </label>
                    <input {...field('price_max')} className="input" inputMode="decimal" value={form.price_max} onChange={(e) => set('price_max', e.target.value)} />
                    {err('price_max')}
                  </div>
                ) : null}
                <div className="field">
                  <label htmlFor={`${uid}-price_basis`}>
                    Price is <span className="opt">(optional)</span>
                  </label>
                  <select {...field('price_basis')} className="select" value={form.price_basis} onChange={(e) => set('price_basis', e.target.value as FormState['price_basis'])}>
                    <option value="">Not specified</option>
                    {PRICE_BASES.map((b) => (
                      <option key={b} value={b}>
                        {PRICE_BASIS_LABELS[b]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </fieldset>

          <div className="field">
            <label htmlFor={`${uid}-valid_through`}>
              Valid through <span className="opt">(optional, Pakistan time)</span>
            </label>
            <input {...field('valid_through')} type="date" className="input" value={form.valid_through} onChange={(e) => set('valid_through', e.target.value)} />
            <span className="hint">The last day the offer shows. It disappears automatically at midnight (Pakistan time) at the end of this day.</span>
            {err('valid_through')}
          </div>

          <label className="checkbox">
            <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} /> Feature on the homepage
          </label>

          <details className="editor-advanced">
            <summary>More details (optional)</summary>
            <div className="form-grid">
              <div className="form-grid form-grid--2">
                <div className="field">
                  <label htmlFor={`${uid}-destination`}>Destination</label>
                  <input {...field('destination')} className="input" maxLength={LIMITS.destination} value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="e.g. Makkah & Madinah, Baku" />
                  {err('destination')}
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-duration`}>Duration</label>
                  <input {...field('duration')} className="input" maxLength={LIMITS.duration} value={form.duration} onChange={(e) => set('duration', e.target.value)} placeholder="e.g. 7 nights" />
                  {err('duration')}
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-travel_start`}>Travel from</label>
                  <input {...field('travel_start')} type="date" className="input" value={form.travel_start} onChange={(e) => set('travel_start', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-travel_end`}>Travel until</label>
                  <input {...field('travel_end')} type="date" className="input" value={form.travel_end} onChange={(e) => set('travel_end', e.target.value)} />
                  {err('travel_end')}
                </div>
              </div>
              <div className="field">
                <label htmlFor={`${uid}-inclusions`}>Included (one per line)</label>
                <textarea {...field('inclusions')} className="textarea" value={form.inclusions} onChange={(e) => set('inclusions', e.target.value)} />
                {err('inclusions')}
              </div>
              <div className="field">
                <label htmlFor={`${uid}-exclusions`}>Not included (one per line)</label>
                <textarea {...field('exclusions')} className="textarea" value={form.exclusions} onChange={(e) => set('exclusions', e.target.value)} />
                {err('exclusions')}
              </div>
              <div className="field">
                <label htmlFor={`${uid}-terms`}>Terms and conditions</label>
                <textarea {...field('terms')} className="textarea" maxLength={LIMITS.terms} value={form.terms} onChange={(e) => set('terms', e.target.value)} />
                {err('terms')}
              </div>
              <div className="form-grid form-grid--2">
                <div className="field">
                  <label htmlFor={`${uid}-show_from`}>Show from (Pakistan time)</label>
                  <input {...field('show_from')} type="date" className="input" value={form.show_from} onChange={(e) => set('show_from', e.target.value)} />
                  <span className="hint">Leave empty to show as soon as it’s published.</span>
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-sort_order`}>Order</label>
                  <input {...field('sort_order')} className="input" inputMode="numeric" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
                  <span className="hint">Lower numbers appear first. Featured offers always come first.</span>
                  {err('sort_order')}
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-currency`}>Currency</label>
                  <input {...field('currency')} className="input" maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} />
                  {err('currency')}
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-slug`}>Web address</label>
                  <input
                    {...field('slug')}
                    className="input"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase(), slugTouched: true }))}
                  />
                  <span className="hint">
                    {site.url.replace(/^https?:\/\//, '')}/promotions/{form.slug || '…'}
                    {row?.status === 'published' ? ' · Changing this breaks links already shared.' : ''}
                  </span>
                  {err('slug')}
                </div>
              </div>
            </div>
          </details>

          {warnings.length ? (
            <ul className="admin-warn">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div className="editor-actions">
            {status === 'published' ? (
              <>
                <button type="button" className="btn" disabled={!!saving || posterBusy} onClick={() => void save('published')}>
                  {saving === 'published' ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className="btn btn--ghost" disabled={!!saving || posterBusy} onClick={() => setShowPreview((v) => !v)} aria-expanded={showPreview}>
                  {showPreview ? 'Hide preview' : 'Preview'}
                </button>
                <button type="button" className="btn btn--ghost" disabled={!!saving || posterBusy} onClick={() => void save('draft')}>
                  {saving === 'draft' ? 'Unpublishing…' : 'Unpublish'}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn--ghost" disabled={!!saving || posterBusy} onClick={() => void save('draft')}>
                  {saving === 'draft' ? 'Saving…' : 'Save draft'}
                </button>
                <button type="button" className="btn btn--ghost" disabled={!!saving || posterBusy} onClick={() => setShowPreview((v) => !v)} aria-expanded={showPreview}>
                  {showPreview ? 'Hide preview' : 'Preview'}
                </button>
                <button type="button" className="btn" disabled={!!saving || posterBusy} onClick={() => void save('published')}>
                  {saving === 'published' ? 'Publishing…' : 'Publish'}
                </button>
              </>
            )}
          </div>
        </form>

        {showPreview ? (
          <aside className="editor-preview" aria-label="Preview">
            <p className="eyebrow">Preview: how customers will see it</p>
            <div style={{ maxWidth: '20rem', marginBottom: 'var(--space-xl)' }}>
              <OfferCard offer={preview} imageSrc={previewImage} />
            </div>
            <div className="admin-card">
              <OfferDetailView offer={preview} pageUrl={`${site.url}/promotions/${form.slug}`} imageSrc={previewImage} callTel={site.landline.tel} preview />
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
