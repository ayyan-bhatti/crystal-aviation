// Local preview content. Loaded only when isDemoMode is true (astro dev without
// Supabase credentials, or an explicit PUBLIC_DEMO_MODE=true preview build).
// Production builds exclude this file entirely (verified in the build checks).
// These are general service entries only: no prices, dates, hotels or
// inclusions are invented. Every entry is "Contact for price".
import type { PublicPromotion } from './types';

const base = {
  destination: null,
  image_path: null, // offer cards fall back to a matching destination/category photo
  image_alt: null,
  pricing_mode: 'quote' as const,
  price_min: null,
  price_max: null,
  currency: 'PKR',
  price_basis: null,
  duration: null,
  travel_start: null,
  travel_end: null,
  inclusions: [],
  exclusions: [],
  terms: 'Availability and prices are confirmed with you directly by our team before anything is booked.',
  starts_at: null,
  expires_at: null,
  featured: false,
  sort_order: 0,
  updated_at: '2026-09-27T00:00:00.000Z',
};

const entry = (n: number, e: Partial<PublicPromotion> & Pick<PublicPromotion, 'slug' | 'title' | 'category'>): PublicPromotion => ({
  ...base,
  summary: null,
  description: null,
  ...e,
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
});

export const demoPromotions: PublicPromotion[] = [
  entry(1, {
    slug: 'umrah-packages',
    title: 'Umrah packages',
    category: 'umrah',
    summary: 'Umrah travel planned around your dates and your family.',
    description: 'Tell us your preferred month, how many people are travelling and where you would like to stay. Our team will share the options available for your dates.',
    featured: true,
  }),
  entry(2, {
    slug: 'baku-holidays',
    title: 'Baku holidays',
    category: 'tour',
    destination: 'Baku',
    summary: 'Old city lanes, the Flame Towers and the Caspian waterfront.',
    description: 'Ask us about holidays to Baku, Azerbaijan, for your dates and group size.',
    featured: true,
  }),
  entry(3, {
    slug: 'thailand-holidays',
    title: 'Thailand holidays',
    category: 'tour',
    destination: 'Thailand',
    summary: 'Bangkok, the islands and the beaches.',
    description: 'Ask us about holidays to Thailand, for your dates and group size.',
    featured: true,
  }),
  entry(4, {
    slug: 'airline-tickets',
    title: 'Airline tickets',
    category: 'flight',
    summary: 'Ask us for ticket options on your route and dates.',
    description: 'Send us your route, travel dates and number of passengers, and our team will share the available options with you.',
  }),
  entry(5, {
    slug: 'hotel-bookings',
    title: 'Hotel bookings',
    category: 'hotel',
    summary: 'Hotel options for your trip, shared with you on WhatsApp.',
    description: 'Tell us the city, your dates and the kind of stay you prefer.',
  }),
  entry(6, {
    slug: 'visa-file-assistance',
    title: 'Visa file assistance',
    category: 'visa',
    summary: 'Help preparing application files for the UK, USA and Europe.',
    description: 'We discuss your plans privately and help you prepare and organise your application file. Decisions are made only by the embassy or consulate.',
  }),
  entry(7, {
    slug: 'singapore-holidays',
    title: 'Singapore holidays',
    category: 'tour',
    destination: 'Singapore',
    summary: 'An easy, green city break for families.',
    description: 'Ask us about holidays to Singapore, for your dates and group size.',
  }),
  entry(8, {
    slug: 'malaysia-holidays',
    title: 'Malaysia holidays',
    category: 'tour',
    destination: 'Malaysia',
    summary: 'Kuala Lumpur, and island time in Langkawi.',
    description: 'Ask us about holidays to Malaysia, for your dates and group size.',
  }),
];
