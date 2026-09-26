import { describe, expect, it } from 'vitest';
import {
  expiryUtcToValidThrough,
  formatValidThrough,
  isActive,
  karachiDate,
  karachiToday,
  startOfKarachiDayUtc,
  validThroughToExpiryUtc,
} from '../../src/lib/dates';

describe('Asia/Karachi date boundaries', () => {
  it('converts "valid through" to the following Karachi midnight (exclusive, UTC)', () => {
    expect(validThroughToExpiryUtc('2026-10-31')).toBe('2026-10-31T19:00:00.000Z');
  });

  it('handles month, year and leap-day rollovers', () => {
    expect(validThroughToExpiryUtc('2026-12-31')).toBe('2026-12-31T19:00:00.000Z'); // = 2027-01-01 00:00 PKT
    expect(validThroughToExpiryUtc('2028-02-28')).toBe('2028-02-28T19:00:00.000Z');
    expect(validThroughToExpiryUtc('2028-02-29')).toBe('2028-02-29T19:00:00.000Z');
  });

  it('rejects invalid dates', () => {
    expect(validThroughToExpiryUtc('2026-02-30')).toBeNull();
    expect(validThroughToExpiryUtc('31/10/2026')).toBeNull();
    expect(startOfKarachiDayUtc('')).toBeNull();
  });

  it('"show from" starts at Karachi midnight', () => {
    expect(startOfKarachiDayUtc('2026-11-01')).toBe('2026-10-31T19:00:00.000Z');
  });

  it('round-trips the expiry back to the valid-through date', () => {
    for (const d of ['2026-01-01', '2026-10-31', '2026-12-31', '2028-02-29']) {
      expect(expiryUtcToValidThrough(validThroughToExpiryUtc(d)!)).toBe(d);
    }
    expect(formatValidThrough(validThroughToExpiryUtc('2026-10-31')!)).toBe('31 October 2026');
  });

  it('computes the Karachi calendar date near midnight', () => {
    expect(karachiDate('2026-10-31T18:59:59.999Z')).toBe('2026-10-31'); // 23:59:59 PKT
    expect(karachiDate('2026-10-31T19:00:00.000Z')).toBe('2026-11-01'); // 00:00 PKT
    expect(karachiToday(new Date('2026-10-31T20:30:00Z'))).toBe('2026-11-01');
  });

  describe('active rule', () => {
    const expires = validThroughToExpiryUtc('2026-10-31')!;
    const base = { status: 'published', starts_at: null, expires_at: expires };

    it('is active through the last second of the valid-through day in Pakistan', () => {
      expect(isActive(base, new Date('2026-10-31T18:59:59.999Z'))).toBe(true);
    });
    it('expires exactly at the following Karachi midnight', () => {
      expect(isActive(base, new Date('2026-10-31T19:00:00.000Z'))).toBe(false);
    });
    it('respects a future start', () => {
      const s = { ...base, starts_at: startOfKarachiDayUtc('2026-10-20') };
      expect(isActive(s, new Date('2026-10-19T18:59:59Z'))).toBe(false);
      expect(isActive(s, new Date('2026-10-19T19:00:00Z'))).toBe(true);
    });
    it('never treats drafts or archived offers as active', () => {
      expect(isActive({ ...base, status: 'draft' }, new Date('2026-10-01T00:00:00Z'))).toBe(false);
      expect(isActive({ ...base, status: 'archived' }, new Date('2026-10-01T00:00:00Z'))).toBe(false);
    });
    it('treats missing start/expiry as open-ended', () => {
      expect(isActive({ status: 'published', starts_at: null, expires_at: null })).toBe(true);
    });
  });
});
