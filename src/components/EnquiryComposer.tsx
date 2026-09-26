import { useId, useState, type SubmitEvent } from 'react';
import { composeEnquiry, whatsappLink } from '../lib/whatsapp';
import Icon from './Icon';

interface Props {
  services: string[];
  defaultService?: string;
  destinationLabel?: string;
  destinationPlaceholder?: string;
  callTel: string;
  callDisplay: string;
  email: string;
}

/**
 * Builds a WhatsApp message from optional fields. Nothing is sent or stored
 * by the website: the visitor sends the message from WhatsApp themselves.
 */
export default function EnquiryComposer({
  services,
  defaultService,
  destinationLabel = 'Destination',
  destinationPlaceholder = 'e.g. Baku, Thailand',
  callTel,
  callDisplay,
  email,
}: Props) {
  const id = useId();
  const [service, setService] = useState(defaultService ?? services[0] ?? '');
  const [destination, setDestination] = useState('');
  const [dates, setDates] = useState('');
  const [travellers, setTravellers] = useState('');
  const [message, setMessage] = useState('');
  const [opened, setOpened] = useState(false);

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = composeEnquiry({ service, destination, dates, travellers, message, pageUrl: window.location.href });
    window.open(whatsappLink(text), '_blank', 'noopener');
    setOpened(true);
  }

  return (
    <form className="composer" onSubmit={onSubmit} aria-describedby={`${id}-note`}>
      <div className="form-grid form-grid--2">
        <div className="field">
          <label htmlFor={`${id}-service`}>Service</label>
          <select id={`${id}-service`} className="select" value={service} onChange={(e) => setService(e.target.value)}>
            {services.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-dest`}>
            {destinationLabel} <span className="opt">(optional)</span>
          </label>
          <input id={`${id}-dest`} className="input" maxLength={120} value={destination} placeholder={destinationPlaceholder} onChange={(e) => setDestination(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-dates`}>
            Preferred dates <span className="opt">(optional)</span>
          </label>
          <input id={`${id}-dates`} className="input" maxLength={120} value={dates} placeholder="e.g. mid-December, 10 days" onChange={(e) => setDates(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-trav`}>
            Number of travellers <span className="opt">(optional)</span>
          </label>
          <input id={`${id}-trav`} className="input" maxLength={60} inputMode="text" value={travellers} placeholder="e.g. 2 adults, 1 child" onChange={(e) => setTravellers(e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginTop: 'var(--space-m)' }}>
        <label htmlFor={`${id}-msg`}>
          Message <span className="opt">(optional)</span>
        </label>
        <textarea id={`${id}-msg`} className="textarea" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
        <span className="hint">Please don’t include passport numbers, card details or other sensitive information.</span>
      </div>
      <div className="btn-row" style={{ marginTop: 'var(--space-l)' }}>
        <button type="submit" className="btn btn--whatsapp">
          <Icon name="whatsapp" /> Continue on WhatsApp
        </button>
      </div>
      <p id={`${id}-note`} className="small muted" style={{ marginTop: 'var(--space-s)', marginBottom: 0 }}>
        This opens WhatsApp with your message filled in. Nothing is sent until you press send in WhatsApp. Prefer to talk?
        Call <a href={`tel:${callTel}`}>{callDisplay}</a> or email <a href={`mailto:${email}`}>{email}</a>.
      </p>
      {opened ? (
        <p className="small" role="status" style={{ marginTop: 'var(--space-s)', marginBottom: 0 }}>
          WhatsApp should have opened in a new tab or app. If it didn’t, please call or email us instead.
        </p>
      ) : null}
    </form>
  );
}
