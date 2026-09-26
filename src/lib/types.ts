export const CATEGORIES = ['umrah', 'tour', 'flight', 'hotel', 'visa', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  umrah: 'Umrah',
  tour: 'International tour',
  flight: 'Airline tickets',
  hotel: 'Hotel booking',
  visa: 'Visa assistance',
  other: 'Other',
};

export const PRICING_MODES = ['quote', 'from', 'fixed', 'range'] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export const PRICE_BASES = ['per_person', 'per_couple', 'per_family', 'per_group', 'per_booking'] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];

export const PRICE_BASIS_LABELS: Record<PriceBasis, string> = {
  per_person: 'per person',
  per_couple: 'per couple',
  per_family: 'per family',
  per_group: 'per group',
  per_booking: 'per booking',
};

export const STATUSES = ['draft', 'published', 'archived'] as const;
export type Status = (typeof STATUSES)[number];

/** Fields visible to the public (the `public_promotions` view). */
export interface PublicPromotion {
  id: string;
  slug: string;
  title: string;
  category: Category;
  destination: string | null;
  summary: string | null;
  description: string | null;
  image_path: string | null;
  image_alt: string | null;
  pricing_mode: PricingMode;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  price_basis: PriceBasis | null;
  duration: string | null;
  travel_start: string | null; // YYYY-MM-DD
  travel_end: string | null;
  inclusions: string[];
  exclusions: string[];
  terms: string | null;
  starts_at: string | null; // ISO UTC
  expires_at: string | null; // ISO UTC, exclusive
  featured: boolean;
  sort_order: number;
  updated_at: string;
}

/** Full row, visible to staff only. */
export interface Promotion extends PublicPromotion {
  status: Status;
  created_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export const PUBLIC_COLUMNS =
  'id,slug,title,category,destination,summary,description,image_path,image_alt,pricing_mode,price_min,price_max,currency,price_basis,duration,travel_start,travel_end,inclusions,exclusions,terms,starts_at,expires_at,featured,sort_order,updated_at';
