import { PRICE_BASIS_LABELS, type PriceBasis, type PricingMode } from './types';

export interface PriceFields {
  pricing_mode: PricingMode;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  price_basis: PriceBasis | null;
}

export function formatAmount(amount: number, currency: string): string {
  const n = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(amount);
  return `${currency} ${n}`;
}

/**
 * Human-readable price. A missing or quote-only price is always
 * "Contact for price" — never zero.
 */
export function formatPrice(p: PriceFields): { label: string; basis: string | null; hasAmount: boolean } {
  const basis = p.price_basis ? PRICE_BASIS_LABELS[p.price_basis] : null;
  const min = isPositive(p.price_min) ? p.price_min : null;
  const max = isPositive(p.price_max) ? p.price_max : null;

  if (p.pricing_mode === 'from' && min !== null) {
    return { label: `From ${formatAmount(min, p.currency)}`, basis, hasAmount: true };
  }
  if (p.pricing_mode === 'fixed' && min !== null) {
    return { label: formatAmount(min, p.currency), basis, hasAmount: true };
  }
  if (p.pricing_mode === 'range' && min !== null && max !== null && max >= min) {
    return { label: `${formatAmount(min, p.currency)} – ${formatAmount(max, p.currency)}`, basis, hasAmount: true };
  }
  return { label: 'Contact for price', basis: null, hasAmount: false };
}

function isPositive(n: number | null): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** Validation errors keyed by field, mirroring the database constraint. */
export function validatePricing(p: PriceFields): Partial<Record<'price_min' | 'price_max' | 'currency', string>> {
  const errors: Partial<Record<'price_min' | 'price_max' | 'currency', string>> = {};
  if (!/^[A-Z]{3}$/.test(p.currency)) errors.currency = 'Use a 3-letter currency code, e.g. PKR.';
  if (p.pricing_mode === 'quote') return errors;

  if (p.price_min === null || Number.isNaN(p.price_min)) {
    errors.price_min = p.pricing_mode === 'range' ? 'Enter the lowest price.' : 'Enter the price.';
  } else if (p.price_min <= 0) {
    errors.price_min = 'Price must be more than zero.';
  } else if (p.price_min >= 1e10) {
    errors.price_min = 'Price is too large.';
  }

  if (p.pricing_mode === 'range') {
    if (p.price_max === null || Number.isNaN(p.price_max)) errors.price_max = 'Enter the highest price.';
    else if (p.price_max <= 0) errors.price_max = 'Price must be more than zero.';
    else if (p.price_max >= 1e10) errors.price_max = 'Price is too large.';
    else if (p.price_min !== null && p.price_max < p.price_min)
      errors.price_max = 'Highest price must be the same as or more than the lowest price.';
  }
  return errors;
}

/** Normalise amounts for saving: quote clears both, from/fixed clear max. */
export function normalisePricing<T extends PriceFields>(p: T): T {
  if (p.pricing_mode === 'quote') return { ...p, price_min: null, price_max: null };
  if (p.pricing_mode === 'from' || p.pricing_mode === 'fixed') return { ...p, price_max: null };
  return p;
}
