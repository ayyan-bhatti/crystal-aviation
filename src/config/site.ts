// Approved business facts, taken from the supplied business card.
// Do not add facts here without evidence from the agency.

const envWhatsApp = (import.meta.env.PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

export const site = {
  name: 'The Crystal Aviation',
  tagline: 'Luxury Travel Solutions',
  url: (import.meta.env.PUBLIC_SITE_URL || 'https://thecrystalaviation.com').replace(/\/$/, ''),
  email: 'thecrystalaviation@gmail.com',
  address: {
    lines: ['Basement Chughtai Lab, Rafih Plaza', 'Main Gulberg Road', 'Faisalabad, Pakistan'],
    street: 'Basement Chughtai Lab, Rafih Plaza, Main Gulberg Road',
    city: 'Faisalabad',
    country: 'PK',
    // Address search until an exact map pin is verified with the owner.
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent('Rafih Plaza, Main Gulberg Road, Faisalabad, Pakistan'),
  },
  landline: { display: '041 547 47 99', tel: '+92415474799' },
  team: [
    { name: 'Umar Farooq', role: 'CEO', display: '+92 321 7643345', tel: '+923217643345', whatsapp: '923217643345' },
    { name: 'Zeeshan Saleem', role: 'MD', display: '+92 331 4748499', tel: '+923314748499', whatsapp: '923314748499' },
  ],
  // PROVISIONAL routing: Umar Farooq's first number. Owner must confirm (see docs/LAUNCH-CHECKLIST.md).
  whatsappPrimary: envWhatsApp.length >= 10 ? envWhatsApp : '923217643345',
} as const;

export const nav = [
  { href: '/umrah', label: 'Umrah' },
  { href: '/tours', label: 'Tours' },
  { href: '/visa', label: 'Visa assistance' },
  { href: '/promotions', label: 'Offers' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;
