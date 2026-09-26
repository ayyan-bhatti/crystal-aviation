import { site } from '../config/site';

/** TravelAgency structured data using only supplied facts (no ratings, hours or prices). */
export function travelAgencyJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: site.name,
    slogan: site.tagline,
    url: site.url + '/',
    email: site.email,
    telephone: site.landline.tel,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressCountry: site.address.country,
    },
    employee: site.team.map((m) => ({ '@type': 'Person', name: m.name, jobTitle: m.role })),
  };
}
