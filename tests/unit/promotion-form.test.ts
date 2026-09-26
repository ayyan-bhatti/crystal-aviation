import { describe, expect, it } from 'vitest';
import { emptyForm, formFromRow, rowFromForm, validateForm, type FormState } from '../../src/lib/admin/promotion-form';
import type { Promotion } from '../../src/lib/types';

const f = (x: Partial<FormState>): FormState => ({ ...emptyForm(), title: 'Umrah offer', slug: 'umrah-offer', ...x });

describe('validateForm', () => {
  it('accepts a minimal draft (title + category)', () => {
    expect(validateForm(f({}), { hasPoster: false, publishing: false })).toEqual({});
  });

  it('requires a poster or description to publish', () => {
    expect(validateForm(f({}), { hasPoster: false, publishing: true }).content).toBeTruthy();
    expect(validateForm(f({ description: 'Details' }), { hasPoster: false, publishing: true })).toEqual({});
    expect(validateForm(f({ image_alt: 'Poster' }), { hasPoster: true, publishing: true })).toEqual({});
  });

  it('requires poster alt text when a poster is present', () => {
    expect(validateForm(f({}), { hasPoster: true, publishing: false }).image_alt).toBeTruthy();
  });

  it('validates title, slug and lengths', () => {
    expect(validateForm(f({ title: 'ab' }), { hasPoster: false, publishing: false }).title).toBeTruthy();
    expect(validateForm(f({ slug: 'Bad Slug' }), { hasPoster: false, publishing: false }).slug).toBeTruthy();
    expect(validateForm(f({ summary: 'x'.repeat(301) }), { hasPoster: false, publishing: false }).summary).toBeTruthy();
  });

  it('validates prices by mode', () => {
    expect(validateForm(f({ pricing_mode: 'from', price_min: '' }), { hasPoster: false, publishing: false }).price_min).toBeTruthy();
    expect(validateForm(f({ pricing_mode: 'range', price_min: '5', price_max: '4' }), { hasPoster: false, publishing: false }).price_max).toBeTruthy();
    expect(validateForm(f({ pricing_mode: 'fixed', price_min: '1,50,000' }), { hasPoster: false, publishing: false })).toEqual({});
  });

  it('refuses to publish with a "valid through" date that has already passed (Karachi today)', () => {
    const today = '2026-09-27';
    expect(validateForm(f({ description: 'd', valid_through: '2026-09-20' }), { hasPoster: false, publishing: true, today }).valid_through).toBeTruthy();
    expect(validateForm(f({ description: 'd', valid_through: '2026-09-27' }), { hasPoster: false, publishing: true, today })).toEqual({});
    expect(validateForm(f({ description: 'd', valid_through: '2026-10-01' }), { hasPoster: false, publishing: true, today })).toEqual({});
    // saving a draft with a past date is allowed
    expect(validateForm(f({ valid_through: '2026-09-20' }), { hasPoster: false, publishing: false, today })).toEqual({});
  });

  it('checks date ordering', () => {
    expect(validateForm(f({ travel_start: '2026-12-10', travel_end: '2026-12-01' }), { hasPoster: false, publishing: false }).travel_end).toBeTruthy();
    expect(validateForm(f({ show_from: '2026-12-10', valid_through: '2026-12-01' }), { hasPoster: false, publishing: false }).valid_through).toBeTruthy();
    expect(validateForm(f({ show_from: '2026-12-10', valid_through: '2026-12-10' }), { hasPoster: false, publishing: false })).toEqual({});
  });
});

describe('rowFromForm', () => {
  it('stores quote mode without amounts and never zero', () => {
    const r = rowFromForm(f({ pricing_mode: 'quote', price_min: '0', price_max: '5' }), 'draft', null);
    expect(r.price_min).toBeNull();
    expect(r.price_max).toBeNull();
    expect(r.price_basis).toBeNull();
  });

  it('parses South Asian digit grouping and trims text', () => {
    const r = rowFromForm(f({ pricing_mode: 'fixed', price_min: '4,50,000', title: '  Umrah offer  ', inclusions: ' Visa \n\n Hotel ' }), 'published', null);
    expect(r.price_min).toBe(450000);
    expect(r.title).toBe('Umrah offer');
    expect(r.inclusions).toEqual(['Visa', 'Hotel']);
    expect(r.status).toBe('published');
  });

  it('converts Karachi dates to UTC timestamps', () => {
    const r = rowFromForm(f({ show_from: '2026-11-01', valid_through: '2026-11-30' }), 'published', null);
    expect(r.starts_at).toBe('2026-10-31T19:00:00.000Z');
    expect(r.expires_at).toBe('2026-11-30T19:00:00.000Z');
  });

  it('drops alt text when there is no poster', () => {
    expect(rowFromForm(f({ image_alt: 'x' }), 'draft', null).image_alt).toBeNull();
  });

  it('round-trips through formFromRow', () => {
    const form = f({ pricing_mode: 'range', price_min: '100000', price_max: '150000', valid_through: '2026-12-31', featured: true });
    const row = rowFromForm(form, 'published', null);
    const back = formFromRow({ ...row, id: 'x', created_at: '', updated_at: '', created_by: null, updated_by: null } as Promotion);
    expect(back.valid_through).toBe('2026-12-31');
    expect(back.price_min).toBe('100000');
    expect(back.featured).toBe(true);
  });
});
