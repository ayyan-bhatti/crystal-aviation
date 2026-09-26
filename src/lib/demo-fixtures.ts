// DEMO ONLY. Loaded only when isDemoMode is true (astro dev without credentials,
// or an explicit PUBLIC_DEMO_MODE=true preview). Never seeded into a database.
// No prices, dates, hotels or inclusions are invented: every sample is quote-only.
import type { PublicPromotion } from './types';

const base = {
  destination: null,
  description: null,
  image_path: null,
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
  terms: 'Sample offer for the website preview only. Not a real package.',
  starts_at: null,
  expires_at: null,
  sort_order: 0,
  updated_at: '2026-09-27T00:00:00.000Z',
};

export const demoPromotions: PublicPromotion[] = [
  {
    ...base,
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'sample-umrah-offer',
    title: 'Sample Umrah offer (demo)',
    category: 'umrah',
    summary: 'Placeholder showing how an Umrah promotion will appear. Real details will come from the agency.',
    description: 'This is a demonstration entry. Staff will replace it with a real offer from the dashboard.',
    image_path: `data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20800%201000%22%3E%3Crect%20width%3D%22800%22%20height%3D%221000%22%20fill%3D%22%23f6f1e7%22%2F%3E%3Crect%20x%3D%2236%22%20y%3D%2236%22%20width%3D%22728%22%20height%3D%22928%22%20fill%3D%22none%22%20stroke%3D%22%23b08a45%22%20stroke-width%3D%222%22%2F%3E%3Crect%20x%3D%2236%22%20y%3D%22700%22%20width%3D%22728%22%20height%3D%22264%22%20fill%3D%22%230f2c5c%22%2F%3E%3Ctext%20x%3D%22400%22%20y%3D%22150%22%20text-anchor%3D%22middle%22%20font-family%3D%22Georgia%2Cserif%22%20font-size%3D%2230%22%20letter-spacing%3D%2212%22%20fill%3D%22%237a5a22%22%3ESAMPLE%20OFFER%3C%2Ftext%3E%3Ctext%20x%3D%22400%22%20y%3D%22400%22%20text-anchor%3D%22middle%22%20font-family%3D%22Didot%2CBodoni%2072%2CGeorgia%2Cserif%22%20font-size%3D%22120%22%20fill%3D%22%2315171d%22%3EUmrah%3C%2Ftext%3E%3Ctext%20x%3D%22400%22%20y%3D%22480%22%20text-anchor%3D%22middle%22%20font-family%3D%22Georgia%2Cserif%22%20font-style%3D%22italic%22%20font-size%3D%2240%22%20fill%3D%22%23474b55%22%3Eyour%20dates%2C%20your%20family%3C%2Ftext%3E%3Ctext%20x%3D%22400%22%20y%3D%22820%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2230%22%20fill%3D%22%23dcc08a%22%3EDemo%20poster%3A%20not%20a%20real%20package%3C%2Ftext%3E%3Ctext%20x%3D%22400%22%20y%3D%22880%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2224%22%20fill%3D%22%23ffffff%22%3EThe%20Crystal%20Aviation%3C%2Ftext%3E%3C%2Fsvg%3E`,
    image_alt: 'Sample poster placeholder reading "Umrah offer — sample"',
    featured: true,
  },
  {
    ...base,
    id: '00000000-0000-4000-8000-000000000002',
    slug: 'sample-tour-offer',
    title: 'Sample international tour (demo)',
    category: 'tour',
    destination: 'Baku',
    summary: 'Placeholder showing how a tour promotion will appear.',
    description: 'This is a demonstration entry. Staff will replace it with a real offer from the dashboard.',
    image_path: `data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20800%201000%22%3E%3Crect%20width%3D%22800%22%20height%3D%221000%22%20fill%3D%22%23f6f1e7%22%2F%3E%3Crect%20x%3D%2236%22%20y%3D%2236%22%20width%3D%22728%22%20height%3D%22928%22%20fill%3D%22none%22%20stroke%3D%22%23b08a45%22%20stroke-width%3D%222%22%2F%3E%3Crect%20x%3D%2236%22%20y%3D%22700%22%20width%3D%22728%22%20height%3D%22264%22%20fill%3D%22%230f2c5c%22%2F%3E%3Ctext%20x%3D%22400%22%20y%3D%22150%22%20text-anchor%3D%22middle%22%20font-family%3D%22Georgia%2Cserif%22%20font-size%3D%2230%22%20letter-spacing%3D%2212%22%20fill%3D%22%237a5a22%22%3ESAMPLE%20OFFER%3C%2Ftext%3E%3Ctext%20x%3D%22400%22%20y%3D%22400%22%20text-anchor%3D%22middle%22%20font-family%3D%22Didot%2CBodoni%2072%2CGeorgia%2Cserif%22%20font-size%3D%22120%22%20fill%3D%22%2315171d%22%3EBaku%3C%2Ftext%3E%3Ctext%20x%3D%22400%22%20y%3D%22480%22%20text-anchor%3D%22middle%22%20font-family%3D%22Georgia%2Cserif%22%20font-style%3D%22italic%22%20font-size%3D%2240%22%20fill%3D%22%23474b55%22%3Ea%20sample%20tour%3C%2Ftext%3E%3Ctext%20x%3D%22400%22%20y%3D%22820%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2230%22%20fill%3D%22%23dcc08a%22%3EDemo%20poster%3A%20not%20a%20real%20package%3C%2Ftext%3E%3Ctext%20x%3D%22400%22%20y%3D%22880%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2224%22%20fill%3D%22%23ffffff%22%3EThe%20Crystal%20Aviation%3C%2Ftext%3E%3C%2Fsvg%3E`,
    image_alt: 'Sample poster placeholder reading "Tour offer — sample"',
    featured: true,
  },
  {
    ...base,
    id: '00000000-0000-4000-8000-000000000003',
    slug: 'sample-airline-ticket-offer',
    title: 'Sample airline-ticket promotion (demo)',
    category: 'flight',
    summary: 'Placeholder for a special ticket offer. Fares are always confirmed on WhatsApp.',
    description: 'This is a demonstration entry. Staff will replace it with a real offer from the dashboard.',
    featured: false,
  },
];
