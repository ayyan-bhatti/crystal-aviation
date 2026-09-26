import { formatValidThrough } from '../../lib/dates';
import { formatPrice } from '../../lib/pricing';
import { posterUrl } from '../../lib/promotions-api';
import { CATEGORY_LABELS, type PublicPromotion } from '../../lib/types';

export default function OfferCard({
  offer,
  headingLevel = 3,
  imageSrc,
  fallbackSrc,
}: {
  offer: PublicPromotion;
  headingLevel?: 2 | 3;
  /** Override the poster source (editor preview of an unsaved image). */
  imageSrc?: string | null;
  /** Category photo shown when the offer has no poster. */
  fallbackSrc?: string | null;
}) {
  const price = formatPrice(offer);
  const img = imageSrc !== undefined ? imageSrc : posterUrl(offer.image_path);
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const href = `/promotions/${offer.slug}`;

  return (
    <article className="offer-card">
      {img ? (
        <div className="offer-card__poster">
          <img src={img} alt={offer.image_alt ?? ''} loading="lazy" decoding="async" width={800} height={1000} />
        </div>
      ) : fallbackSrc ? (
        <div className="offer-card__poster offer-card__poster--photo">
          <img src={fallbackSrc} alt="" loading="lazy" decoding="async" width={800} height={1000} />
        </div>
      ) : (
        <div className="offer-card__poster offer-card__poster--empty" aria-hidden="true">
          {CATEGORY_LABELS[offer.category]}
        </div>
      )}
      <div className="offer-card__body">
        <div className="btn-row" style={{ gap: '0.35rem' }}>
          <span className="tag">{CATEGORY_LABELS[offer.category]}</span>
          {offer.destination ? <span className="tag tag--gold">{offer.destination}</span> : null}
        </div>
        <H>
          <a href={href}>{offer.title}</a>
        </H>
        {offer.summary ? <p className="offer-card__summary">{offer.summary}</p> : null}
        <div className="offer-card__meta">
          <span className={price.hasAmount ? 'price' : 'price price--quote'}>
            {price.label}
            {price.basis ? <small> {price.basis}</small> : null}
          </span>
          {offer.expires_at ? <span className="expiry">Valid until {formatValidThrough(offer.expires_at)}</span> : null}
        </div>
      </div>
    </article>
  );
}
