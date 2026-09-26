import { site } from '../config/site';

/** Digits only, e.g. "+92 321 7643345" → "923217643345". */
export function normaliseWhatsAppNumber(input: string): string {
  return input.replace(/\D/g, '');
}

/** Build a wa.me link with a URL-encoded prefilled message. */
export function whatsappLink(message?: string, number: string = site.whatsappPrimary): string {
  const digits = normaliseWhatsAppNumber(number);
  const base = `https://wa.me/${digits}`;
  const text = message?.trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function serviceEnquiryMessage(service: string, pageUrl?: string): string {
  return [`Assalam-o-Alaikum, I would like to ask about ${service}.`, pageUrl ? `Page: ${pageUrl}` : '']
    .filter(Boolean)
    .join('\n');
}

export function promotionEnquiryMessage(title: string, pageUrl: string): string {
  return `Assalam-o-Alaikum, I am interested in the offer "${title}".\nOffer page: ${pageUrl}`;
}

export interface EnquiryDetails {
  service?: string;
  destination?: string;
  dates?: string;
  travellers?: string;
  message?: string;
  pageUrl?: string;
}

/** Compose a WhatsApp message from the optional enquiry fields; blank fields are omitted. */
export function composeEnquiry(d: EnquiryDetails): string {
  const clean = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const lines = ['Assalam-o-Alaikum, I have a travel enquiry.'];
  if (clean(d.service)) lines.push(`Service: ${clean(d.service)}`);
  if (clean(d.destination)) lines.push(`Destination: ${clean(d.destination)}`);
  if (clean(d.dates)) lines.push(`Preferred dates: ${clean(d.dates)}`);
  if (clean(d.travellers)) lines.push(`Travellers: ${clean(d.travellers)}`);
  const msg = (d.message ?? '').trim().slice(0, 1000);
  if (msg) lines.push('', msg);
  if (d.pageUrl) lines.push('', `Sent from: ${d.pageUrl}`);
  return lines.join('\n');
}
