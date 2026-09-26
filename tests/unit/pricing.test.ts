import { describe, expect, it } from 'vitest';
import { formatPrice, normalisePricing, validatePricing, type PriceFields } from '../../src/lib/pricing';

const p = (x: Partial<PriceFields>): PriceFields => ({
  pricing_mode: 'quote',
  price_min: null,
  price_max: null,
  currency: 'PKR',
  price_basis: null,
  ...x,
});

describe('formatPrice', () => {
  it('shows "Contact for price" for quote-only, never zero', () => {
    expect(formatPrice(p({})).label).toBe('Contact for price');
    expect(formatPrice(p({ pricing_mode: 'quote', price_min: 100 })).label).toBe('Contact for price');
  });
  it('falls back to "Contact for price" when an amount is missing or zero', () => {
    expect(formatPrice(p({ pricing_mode: 'from', price_min: null })).label).toBe('Contact for price');
    expect(formatPrice(p({ pricing_mode: 'fixed', price_min: 0 })).label).toBe('Contact for price');
    expect(formatPrice(p({ pricing_mode: 'range', price_min: 100, price_max: null })).label).toBe('Contact for price');
    expect(formatPrice(p({ pricing_mode: 'range', price_min: 200, price_max: 100 })).label).toBe('Contact for price');
  });
  it('formats from, fixed and range with basis', () => {
    expect(formatPrice(p({ pricing_mode: 'from', price_min: 250000, price_basis: 'per_person' }))).toEqual({
      label: 'From PKR 250,000',
      basis: 'per person',
      hasAmount: true,
    });
    expect(formatPrice(p({ pricing_mode: 'fixed', price_min: 99999 })).label).toBe('PKR 99,999');
    expect(formatPrice(p({ pricing_mode: 'range', price_min: 100000, price_max: 150000 })).label).toBe('PKR 100,000 – PKR 150,000');
  });
});

describe('validatePricing', () => {
  it('accepts quote with no amounts', () => {
    expect(validatePricing(p({}))).toEqual({});
  });
  it('requires one positive amount for from/fixed', () => {
    expect(validatePricing(p({ pricing_mode: 'from' })).price_min).toBeTruthy();
    expect(validatePricing(p({ pricing_mode: 'fixed', price_min: -5 })).price_min).toBeTruthy();
    expect(validatePricing(p({ pricing_mode: 'fixed', price_min: 0 })).price_min).toBeTruthy();
    expect(validatePricing(p({ pricing_mode: 'fixed', price_min: 10 }))).toEqual({});
  });
  it('requires both amounts for range with max >= min', () => {
    expect(validatePricing(p({ pricing_mode: 'range', price_min: 10 })).price_max).toBeTruthy();
    expect(validatePricing(p({ pricing_mode: 'range', price_min: 10, price_max: 5 })).price_max).toBeTruthy();
    expect(validatePricing(p({ pricing_mode: 'range', price_min: 10, price_max: 10 }))).toEqual({});
  });
  it('rejects NaN and bad currency', () => {
    expect(validatePricing(p({ pricing_mode: 'fixed', price_min: Number.NaN })).price_min).toBeTruthy();
    expect(validatePricing(p({ currency: 'rs' })).currency).toBeTruthy();
  });
});

describe('normalisePricing', () => {
  it('clears amounts that the mode does not use', () => {
    expect(normalisePricing(p({ pricing_mode: 'quote', price_min: 1, price_max: 2 }))).toMatchObject({ price_min: null, price_max: null });
    expect(normalisePricing(p({ pricing_mode: 'from', price_min: 1, price_max: 2 }))).toMatchObject({ price_min: 1, price_max: null });
  });
});
