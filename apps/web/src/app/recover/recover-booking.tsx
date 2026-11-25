"use client";

import { useRef, useState, type FormEvent } from 'react';
import { requestCheckoutRecovery } from './actions';

export default function RecoverBooking({ initialReference = '' }: { initialReference?: string }) {
  const [reference, setReference] = useState(initialReference);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy(true);
    setMessage('');
    setError('');

    try {
      const result = await requestCheckoutRecovery(reference, email);
      if (result.error) setError(result.error);
      else if (result.message) setMessage(result.message);
    } catch {
      setError('Could not request a checkout link. Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <label className="block text-sm font-semibold text-slate-900">
        Order reference
        <input
          type="text"
          name="reference"
          autoComplete="off"
          required
          spellCheck={false}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="ticket-…"
          className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm font-normal text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-900">
        Purchase email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Email my checkout link'}
      </button>
      {message && <p role="status" className="text-sm leading-6 text-teal-800">{message}</p>}
      {error && <p role="alert" className="text-sm leading-6 text-red-700">{error}</p>}
      <p className="text-sm leading-6 text-slate-600">
        We send the link only to the email used for the purchase. For a booking
        with several tickets, the checkout displays each attendee&apos;s pass.
      </p>
    </form>
  );
}
