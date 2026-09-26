import { formatCalendarDate, formatValidThrough } from '../../lib/dates';
import { formatPrice } from '../../lib/pricing';
import { CATEGORY_LABELS, type PublicPromotion } from '../../lib/types';
import { promotionEnquiryMessage, whatsappLink } from '../../lib/whatsapp';
import Icon from '../Icon';

interface Props {
  offer: PublicPromotion;
  /** Absolute public URL of this offer (used in the WhatsApp message). */
  pageUrl: string;
  /** Resolved poster URL (public URL, or a local object URL in the editor preview). */
  imageSrc: string | null;
  callTel: string;
  preview?: boolean;
}

/**
 * The offer detail body. Used for the public page (server-rendered) and the
 * dashboard preview, so staff see exactly what customers will see.
 * All text is rendered as React text nodes — never as HTML.
 */
export default function OfferDetailView({ offer, pageUrl, imageSrc, callTel, preview }: Props) {
  const price = formatPrice(offer);
  const wa = whatsappLink(promotionEnquiryMessage(offer.title, pageUrl));
  const travel =
    offer.travel_start && offer.travel_end
      ? `${formatCalendarDate(offer.travel_start)} – ${formatCalendarDate(offer.travel_end)}`
      : offer.travel_start
        ? `From ${formatCalendarDate(offer.travel_start)}`
        : offer.travel_end
          ? `Until ${formatCalendarDate(offer.travel_end)}`
          : null;

  return (
    <div className="offer-detail">
      <div>
        {imageSrc ? (
          <figure className="poster-frame" style={{ margin: 0 }}>
            <a href={imageSrc} target="_blank" rel="noopener" aria-label="Open the full-size poster in a new tab">
              <img src={imageSrc} alt={offer.image_alt ?? ''} decoding="async" />
            </a>
            <figcaption>
              <a href={imageSrc} target="_blank" rel="noopener" className="text-link" style={{ display: 'inline-flex' }}>
                View full-size poster
              </a>
            </figcaption>
          </figure>
        ) : (
          <div className="offer-card__poster offer-card__poster--empty" style={{ borderRadius: 'var(--radius-m)' }} aria-hidden="true">
            {CATEGORY_LABELS[offer.category]}
          </div>
        )}
      </div>

      <div>
        <div className="btn-row" style={{ gap: '0.35rem', marginBottom: 'var(--space-s)' }}>
          <span className="tag">{CATEGORY_LABELS[offer.category]}</span>
          {offer.destination ? <span className="tag tag--gold">{offer.destination}</span> : null}
        </div>
        <h1 style={{ fontSize: 'var(--step-4)' }}>{offer.title}</h1>
        {offer.summary ? <p className="lead">{offer.summary}</p> : null}

        <p className="detail-price">
          {price.label}
          {price.basis ? <small> {price.basis}</small> : null}
        </p>
        {price.hasAmount ? (
          <p className="small muted">Prices are subject to availability and confirmation by the agency.</p>
        ) : (
          <p className="small muted">Message us for current pricing and availability.</p>
        )}

        <dl className="fact-list">
          {offer.duration ? (
            <>
              <dt>Duration</dt>
              <dd>{offer.duration}</dd>
            </>
          ) : null}
          {travel ? (
            <>
              <dt>Travel dates</dt>
              <dd>{travel}</dd>
            </>
          ) : null}
          {offer.expires_at ? (
            <>
              <dt>Offer valid until</dt>
              <dd>{formatValidThrough(offer.expires_at)} (Pakistan time)</dd>
            </>
          ) : null}
        </dl>

        <div className="btn-row">
          <a className="btn btn--whatsapp" href={wa} target="_blank" rel="noopener" aria-disabled={preview || undefined}>
            <Icon name="whatsapp" /> Ask about this offer
          </a>
          <a className="btn btn--ghost" href={`tel:${callTel}`}>
            <Icon name="phone" /> Call
          </a>
        </div>
        <p className="small muted" style={{ marginTop: 'var(--space-s)' }}>
          WhatsApp opens with a message about this offer. You send it yourself, and an enquiry is not a booking.
        </p>

        {offer.description ? (
          <section className="detail-block">
            <h2>About this offer</h2>
            <p className="prose">{offer.description}</p>
          </section>
        ) : null}

        {offer.inclusions.length > 0 ? (
          <section className="detail-block">
            <h2>Included</h2>
            <ul className="checklist">
              {offer.inclusions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {offer.exclusions.length > 0 ? (
          <section className="detail-block">
            <h2>Not included</h2>
            <ul>
              {offer.exclusions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {offer.terms ? (
          <section className="detail-block">
            <h2>Terms</h2>
            <p className="prose small">{offer.terms}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
