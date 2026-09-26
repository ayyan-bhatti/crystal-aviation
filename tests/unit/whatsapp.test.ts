import { describe, expect, it } from 'vitest';
import { site } from '../../src/config/site';
import { slugify, isValidSlug } from '../../src/lib/slug';
import { composeEnquiry, normaliseWhatsAppNumber, promotionEnquiryMessage, whatsappLink } from '../../src/lib/whatsapp';

describe('WhatsApp links', () => {
  it('normalises numbers to digits only', () => {
    expect(normaliseWhatsAppNumber('+92 321 7643345')).toBe('923217643345');
    expect(normaliseWhatsAppNumber('+92-331-4748499')).toBe('923314748499');
  });

  it('uses the provisional primary number by default', () => {
    expect(site.whatsappPrimary).toBe('923217643345');
    expect(whatsappLink()).toBe('https://wa.me/923217643345');
  });

  it('URL-encodes the message, including quotes, ampersands, newlines and Urdu', () => {
    const msg = promotionEnquiryMessage('Umrah & Ziyarat "Special"', 'https://thecrystalaviation.com/promotions/umrah-special?x=1&y=2');
    const url = whatsappLink(msg);
    expect(url.startsWith('https://wa.me/923217643345?text=')).toBe(true);
    const decoded = decodeURIComponent(new URL(url).searchParams.get('text')!);
    expect(new URL(url).searchParams.get('text')).toBe(msg);
    expect(decoded).toContain('Umrah & Ziyarat "Special"');
    expect(url).not.toContain(' ');
    expect(url).not.toMatch(/&y=2/); // the inner & is encoded
    expect(whatsappLink('عمرہ')).toBe('https://wa.me/923217643345?text=' + encodeURIComponent('عمرہ'));
  });

  it('omits the text parameter for empty messages', () => {
    expect(whatsappLink('   ')).toBe('https://wa.me/923217643345');
  });

  it('never uses the ambiguous second card number', () => {
    expect(JSON.stringify(site)).not.toContain('6591018642');
  });
});

describe('composeEnquiry', () => {
  it('omits blank optional fields', () => {
    const text = composeEnquiry({ service: 'Umrah', destination: '  ', dates: '', travellers: undefined, message: '' });
    expect(text).toBe('Assalam-o-Alaikum, I have a travel enquiry.\nService: Umrah');
  });
  it('includes filled fields and the page URL', () => {
    const text = composeEnquiry({ service: 'International tour', destination: 'Baku', dates: 'December', travellers: '2 adults', message: 'Hello', pageUrl: 'https://x.test/tours' });
    expect(text).toContain('Destination: Baku');
    expect(text).toContain('Preferred dates: December');
    expect(text).toContain('Travellers: 2 adults');
    expect(text).toContain('Hello');
    expect(text).toContain('Sent from: https://x.test/tours');
  });
});

describe('slugs', () => {
  it('slugifies titles', () => {
    expect(slugify('Umrah December Offer — 15 Days!')).toBe('umrah-december-offer-15-days');
    expect(slugify('Baku & Gabala')).toBe('baku-and-gabala');
    expect(isValidSlug('umrah-offer')).toBe(true);
    expect(isValidSlug('Umrah Offer')).toBe(false);
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('a--b')).toBe(false);
  });
});
