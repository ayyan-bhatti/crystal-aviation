import {
  expiryUtcToValidThrough,
  karachiDate,
  karachiToday,
  startOfKarachiDayUtc,
  validThroughToExpiryUtc,
} from '../dates';
import { normalisePricing, validatePricing } from '../pricing';
import { isValidSlug } from '../slug';
import type { Category, PriceBasis, PricingMode, Promotion, PublicPromotion, Status } from '../types';

/** Editor state: everything as strings/booleans the form controls use. */
export interface FormState {
  title: string;
  slug: string;
  slugTouched: boolean;
  category: Category;
  destination: string;
  summary: string;
  description: string;
  image_alt: string;
  pricing_mode: PricingMode;
  price_min: string;
  price_max: string;
  currency: string;
  price_basis: PriceBasis | '';
  duration: string;
  travel_start: string;
  travel_end: string;
  inclusions: string;
  exclusions: string;
  terms: string;
  show_from: string; // Karachi date
  valid_through: string; // Karachi date (inclusive)
  featured: boolean;
  sort_order: string;
}

export type FieldErrors = Partial<Record<keyof FormState | 'poster' | 'content', string>>;

export const LIMITS = {
  title: 120,
  summary: 300,
  description: 5000,
  destination: 80,
  image_alt: 250,
  duration: 80,
  terms: 3000,
  listItems: 30,
  listItem: 200,
} as const;

export function emptyForm(): FormState {
  return {
    title: '',
    slug: '',
    slugTouched: false,
    category: 'umrah',
    destination: '',
    summary: '',
    description: '',
    image_alt: '',
    pricing_mode: 'quote',
    price_min: '',
    price_max: '',
    currency: 'PKR',
    price_basis: '',
    duration: '',
    travel_start: '',
    travel_end: '',
    inclusions: '',
    exclusions: '',
    terms: '',
    show_from: '',
    valid_through: '',
    featured: false,
    sort_order: '0',
  };
}

export function formFromRow(p: Promotion): FormState {
  return {
    title: p.title,
    slug: p.slug,
    slugTouched: true,
    category: p.category,
    destination: p.destination ?? '',
    summary: p.summary ?? '',
    description: p.description ?? '',
    image_alt: p.image_alt ?? '',
    pricing_mode: p.pricing_mode,
    price_min: p.price_min !== null ? String(p.price_min) : '',
    price_max: p.price_max !== null ? String(p.price_max) : '',
    currency: p.currency,
    price_basis: p.price_basis ?? '',
    duration: p.duration ?? '',
    travel_start: p.travel_start ?? '',
    travel_end: p.travel_end ?? '',
    inclusions: p.inclusions.join('\n'),
    exclusions: p.exclusions.join('\n'),
    terms: p.terms ?? '',
    show_from: p.starts_at ? karachiDate(p.starts_at) : '',
    valid_through: p.expires_at ? expiryUtcToValidThrough(p.expires_at) : '',
    featured: p.featured,
    sort_order: String(p.sort_order),
  };
}

const opt = (s: string) => {
  const t = s.trim();
  return t ? t : null;
};
const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
const num = (s: string) => {
  const t = s.replace(/[,\s]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export type RowInput = Omit<Promotion, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>;

/** Convert the form to a database row (without id/audit fields). */
export function rowFromForm(f: FormState, status: Status, imagePath: string | null): RowInput {
  const priced = normalisePricing({
    pricing_mode: f.pricing_mode,
    price_min: num(f.price_min),
    price_max: num(f.price_max),
    currency: f.currency.trim().toUpperCase() || 'PKR',
    price_basis: f.price_basis || null,
  });
  return {
    slug: f.slug.trim(),
    title: f.title.trim(),
    category: f.category,
    destination: opt(f.destination),
    summary: opt(f.summary),
    description: opt(f.description),
    image_path: imagePath,
    image_alt: imagePath ? opt(f.image_alt) : null,
    ...priced,
    price_basis: priced.pricing_mode === 'quote' ? null : priced.price_basis,
    duration: opt(f.duration),
    travel_start: opt(f.travel_start),
    travel_end: opt(f.travel_end),
    inclusions: lines(f.inclusions),
    exclusions: lines(f.exclusions),
    terms: opt(f.terms),
    status,
    starts_at: f.show_from ? startOfKarachiDayUtc(f.show_from) : null,
    expires_at: f.valid_through ? validThroughToExpiryUtc(f.valid_through) : null,
    featured: f.featured,
    sort_order: Number.parseInt(f.sort_order || '0', 10) || 0,
  };
}

/** Preview object in the same shape the public pages use. */
export function previewFromForm(f: FormState, imagePath: string | null): PublicPromotion {
  const r = rowFromForm(f, 'published', imagePath);
  return { ...r, id: 'preview', slug: r.slug || 'preview', title: r.title || 'Untitled offer', updated_at: new Date().toISOString() };
}

/** Validation mirroring the database constraints. `publishing` adds the content rule. */
export function validateForm(f: FormState, opts: { hasPoster: boolean; publishing: boolean; today?: string }): FieldErrors {
  const e: FieldErrors = {};
  const title = f.title.trim();
  if (title.length < 3) e.title = 'Enter a title of at least 3 characters.';
  else if (title.length > LIMITS.title) e.title = `Keep the title under ${LIMITS.title} characters.`;

  if (!isValidSlug(f.slug.trim()))
    e.slug = 'Use 3–80 lowercase letters, numbers and single hyphens (e.g. umrah-december-offer).';

  if (f.summary.length > LIMITS.summary) e.summary = `Keep the summary under ${LIMITS.summary} characters.`;
  if (f.description.length > LIMITS.description) e.description = `Keep the description under ${LIMITS.description} characters.`;
  if (f.destination.length > LIMITS.destination) e.destination = `Keep the destination under ${LIMITS.destination} characters.`;
  if (f.duration.length > LIMITS.duration) e.duration = `Keep the duration under ${LIMITS.duration} characters.`;
  if (f.terms.length > LIMITS.terms) e.terms = `Keep the terms under ${LIMITS.terms} characters.`;

  for (const key of ['inclusions', 'exclusions'] as const) {
    const items = lines(f[key]);
    if (items.length > LIMITS.listItems) e[key] = `Use at most ${LIMITS.listItems} lines.`;
    else if (items.some((x) => x.length > LIMITS.listItem)) e[key] = `Keep each line under ${LIMITS.listItem} characters.`;
  }

  if (opts.hasPoster) {
    const alt = f.image_alt.trim();
    if (!alt) e.image_alt = 'Describe the poster for people who can’t see it (e.g. “Umrah December offer poster”).';
    else if (alt.length > LIMITS.image_alt) e.image_alt = `Keep this under ${LIMITS.image_alt} characters.`;
  }

  if (opts.publishing && !opts.hasPoster && !f.description.trim()) {
    e.content = 'To publish, add a poster or write a description.';
  }

  const pe = validatePricing({
    pricing_mode: f.pricing_mode,
    price_min: num(f.price_min),
    price_max: num(f.price_max),
    currency: f.currency.trim().toUpperCase(),
    price_basis: null,
  });
  Object.assign(e, pe);

  if (f.travel_start && f.travel_end && f.travel_end < f.travel_start)
    e.travel_end = 'The return/end date must be on or after the start date.';

  if (f.show_from && f.valid_through && f.valid_through < f.show_from)
    e.valid_through = '“Valid through” must be on or after “Show from”.';
  else if (opts.publishing && f.valid_through && f.valid_through < (opts.today ?? karachiToday()))
    e.valid_through = 'This date has already passed, so the offer would be hidden straight away. Choose today or a later date, or leave it empty.';

  const so = Number(f.sort_order);
  if (!Number.isInteger(so) || so < -1000 || so > 1000) e.sort_order = 'Use a whole number between -1000 and 1000.';

  return e;
}

/** Non-blocking warnings shown before publishing. */
export function publishWarnings(f: FormState): string[] {
  const w: string[] = [];
  const today = karachiToday();
  if (f.valid_through && f.valid_through < today) w.push('“Valid through” is in the past, so this offer won’t appear on the website.');
  if (f.show_from && f.show_from > today) w.push(`This offer will appear on the website from ${f.show_from}.`);
  return w;
}
