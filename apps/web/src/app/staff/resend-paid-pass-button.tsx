"use client";

import { useRef, useState } from 'react';
import styles from './staff-styles';

export default function ResendPaidPassButton({
  slug,
  guest,
}: {
  slug: string;
  guest: { id: string; guestName: string; guestEmail: string };
}) {
  const inFlight = useRef(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [message, setMessage] = useState('');

  async function send() {
    if (inFlight.current || state === 'sent') return;
    inFlight.current = true;
    setState('sending');
    setMessage('');

    try {
      const response = await fetch(
        `/api/staff/events/${encodeURIComponent(slug)}/invitations/${encodeURIComponent(guest.id)}/resend-paid-pass`,
        { method: 'POST', cache: 'no-store' },
      );

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(
          typeof details?.message === 'string'
            ? details.message
            : 'Pass email could not be confirmed.',
        );
      }

      setState('sent');
      setMessage(`Current pass emailed to ${guest.guestEmail}.`);
    } catch (error) {
      setState('idle');
      setMessage(
        error instanceof TypeError
          ? 'Connection interrupted. Check the inbox before retrying.'
          : error instanceof Error
            ? error.message
            : 'Pass email could not be confirmed.',
      );
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={styles.textButton}
        onClick={() => void send()}
        disabled={state !== 'idle'}
        aria-label={`Resend current paid pass to ${guest.guestName}`}
      >
        {state === 'sending'
          ? 'Sending…'
          : state === 'sent'
            ? 'Pass emailed'
            : 'Resend paid pass'}
      </button>
      {message && <p role="status" className="text-xs text-slate-700">{message}</p>}
    </div>
  );
}
