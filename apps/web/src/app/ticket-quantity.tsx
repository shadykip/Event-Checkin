"use client";

import { useId } from "react";
import { publicStyles } from "./public-styles";

export type Attendee = { guestName: string; guestEmail: string };

export function TicketQuantity({
  value,
  maximum,
  onChange,
  disabled,
}: {
  value: number;
  maximum: number;
  onChange: (quantity: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const button =
    "grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-xl font-semibold text-teal-800 hover:enabled:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:cursor-default disabled:text-slate-300";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-semibold text-slate-950">
        Ticket quantity
      </label>
      <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white p-0.5">
        <button
          type="button"
          aria-label="Decrease ticket quantity"
          className={button}
          disabled={disabled || value <= 1}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="min-h-11 min-w-12 rounded-md bg-white px-1 text-center text-base font-bold tabular-nums text-slate-950 focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          {Array.from({ length: maximum }, (_, index) => (
            <option key={index + 1}>{index + 1}</option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Increase ticket quantity"
          className={button}
          disabled={disabled || value >= maximum}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function AdditionalAttendees({
  first,
  last,
}: {
  first: number;
  last: number;
}) {
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => {
    const n = first + i;
    return (
      <fieldset
        key={n}
        className="mt-4 grid min-w-0 gap-3 border-0 border-t border-slate-200 p-0 pt-3"
      >
        <legend className="px-0 text-sm font-bold text-slate-950">
          Ticket {n} attendee
        </legend>
        <label className="grid gap-2 text-sm font-semibold">
          Full name
          <input
            name={`name-${n}`}
            className={publicStyles.input}
            autoComplete={`section-ticket${n} name`}
            maxLength={200}
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Email address
          <input
            name={`email-${n}`}
            className={publicStyles.input}
            type="email"
            autoComplete={`section-ticket${n} email`}
            maxLength={254}
            required
          />
        </label>
      </fieldset>
    );
  });
}

export function readAdditionalAttendees(
  form: FormData,
  first: number,
  last: number,
): Attendee[] {
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => ({
    guestName: String(form.get(`name-${first + i}`) ?? "").trim(),
    guestEmail: String(form.get(`email-${first + i}`) ?? "")
      .trim()
      .toLowerCase(),
  }));
}
