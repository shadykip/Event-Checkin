"use client";

import { publicStyles } from "../../public-styles";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  admissions,
  eventDate,
  eventTime,
  money,
  type PublicTier,
} from "../../public-events";
import { reserveTicket } from "./reserve-ticket";
import {
  AdditionalAttendees,
  readAdditionalAttendees,
  TicketQuantity,
} from "../../ticket-quantity";

export type { PublicTier } from "../../public-events";

type Props = {
  slug: string;
  freeStatus: "available" | "closed" | "sold_out";
  tiers: PublicTier[];
};

type Option = {
  id: string;
  name: string;
  price: string;
  people: number;
  available: boolean;
  detail: string;
  status: string;
};

function tierStatus(tier: PublicTier) {
  if (tier.status === "sold_out") return "Sold out";
  if (tier.status === "closed") return "Sales closed";
  if (tier.status === "upcoming" && tier.salesStartAt) {
    const startsAt = new Date(tier.salesStartAt);
    return `Sales open ${eventDate.format(startsAt)} at ${eventTime.format(startsAt)} EAT`;
  }
  return `${tier.remaining} ${tier.remaining === 1 ? "ticket" : "tickets"} available`;
}

export default function TicketChoiceForm({ slug, freeStatus, tiers }: Props) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [count, setCount] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{
    kind: "free";
    passPath: string;
  } | null>(null);
  const running = useRef(false);
  const retryKeys = useRef(new Map<string, string>());

  const options: Option[] = tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    price: money(tier.priceMinor, tier.currency),
    people: tier.peoplePerTicket,
    available: tier.status === "available",
    detail: `${admissions(tier.peoplePerTicket)}. ${tier.peoplePerTicket > 1 ? "One price for the group. Your group can arrive separately." : "Price for one ticket."}`,
    status: tierStatus(tier),
  }));

  if (freeStatus !== "closed") {
    options.unshift({
      id: "free",
      name: "Free admission",
      price: "Free",
      people: 1,
      available: freeStatus === "available",
      detail: "Admits 1 person. Receive your QR pass when you claim.",
      status: freeStatus === "sold_out" ? "Sold out" : "Available",
    });
  }

  const available = options.filter((option) => option.available);
  const selected =
    available.find((option) => option.id === choice) ??
    (!choice && available.length === 1 ? available[0] : undefined);
  const tier = tiers.find((item) => item.id === selected?.id);
  const individual = tier?.peoplePerTicket === 1;
  const maximum =
    tier && individual
      ? Math.max(
          1,
          Math.min(
            10,
            tier.remaining,
            Math.floor(2_147_483_647 / tier.priceMinor),
          ),
        )
      : 1;
  const quantity = Math.min(count, maximum);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || running.current || success) return;

    const form = new FormData(event.currentTarget);
    const guestName = String(form.get("guestName") ?? "").trim();
    const guestEmail = String(form.get("guestEmail") ?? "")
      .trim()
      .toLowerCase();

    running.current = true;
    setBusy(true);
    setError("");

    try {
      if (selected.id === "free") {
        const response = await fetch(
          `/api/events/${encodeURIComponent(slug)}/tickets`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guestName, guestEmail }),
            cache: "no-store",
          },
        );

        const body = await response.json();
        if (!response.ok) {
          setError(
            typeof body?.message === "string"
              ? body.message
              : "Could not issue a ticket.",
          );
          if (response.status === 409) router.refresh();
          return;
        }

        if (
          typeof body?.passPath !== "string" ||
          !/^\/pass#[A-Za-z0-9_-]{43}$/.test(body.passPath)
        ) {
          throw new Error("Unexpected pass link");
        }

        setSuccess({ kind: "free", passPath: body.passPath });
        return;
      }

      const attendees =
        quantity > 1
          ? [
              { guestName, guestEmail },
              ...readAdditionalAttendees(form, 2, quantity),
            ]
          : undefined;
      if (
        attendees &&
        new Set(attendees.map((guest) => guest.guestEmail)).size !== quantity
      ) {
        setError("Use a different attendee email for each ticket.");
        return;
      }
      const signature = JSON.stringify([
        slug,
        selected.id,
        guestName,
        guestEmail,
        attendees,
      ]);
      const key = retryKeys.current.get(signature) ?? crypto.randomUUID();
      retryKeys.current.set(signature, key);

      const result = await reserveTicket(
        slug,
        selected.id,
        key,
        guestName,
        guestEmail,
        attendees,
      );
      if ("error" in result) {
        setError(result.error);
        if (result.error.startsWith("Reservation expired.")) {
          retryKeys.current.delete(signature);
        }
        router.refresh();
        return;
      }

      const receipt = result.receipt;
      sessionStorage.setItem(`ticket-checkout:${receipt.id}`, key);
      router.push(`/checkout/${receipt.id}`);
    } catch {
      setError(
        selected.id === "free"
          ? "Could not confirm your ticket. If a retry reports an existing pass, contact the organizer."
          : "Could not confirm your reservation. Retry with the same ticket and guest details.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  if (success) {
    return (
      <aside
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight"
        aria-label="Your ticket"
      >
        <div
          role="status"
          className="grid gap-4 [&_p]:text-sm [&_p]:leading-6 [&_p]:text-slate-600"
        >
          <span
            className="mb-2 grid size-12 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-800"
            aria-hidden="true"
          >
            ✓
          </span>
          <h2>Your ticket is ready</h2>
          <p>
            Open your private QR pass and bookmark it before closing this page.
          </p>
          <a
            href={success.passPath}
            className={`${publicStyles.primary} w-full`}
          >
            Open my QR pass
          </a>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight"
      aria-label="Event tickets"
    >
      {options.length === 0 ? (
        <div role="status">
          <h2>Registration closed</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Already have a ticket? Open your private pass link for entry.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset
            disabled={busy}
            className="m-0 grid min-w-0 gap-3 border-0 p-0 [&_legend]:mb-4 [&_legend]:p-0 [&_legend]:text-xl [&_legend]:font-semibold [&_legend]:tracking-tight"
          >
            <legend>Choose your ticket</legend>
            {options.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 p-4 has-checked:border-teal-700 has-checked:bg-teal-50 has-checked:ring-1 has-checked:ring-teal-700 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal-700 motion-safe:transition-colors [&_input]:mt-1 [&_input]:size-4 [&_input]:shrink-0 [&_input]:accent-teal-700 ${option.available ? "" : "!cursor-default bg-slate-50 text-slate-500"}`}
              >
                <input
                  type="radio"
                  name="ticket"
                  value={option.id}
                  disabled={!option.available}
                  checked={selected?.id === option.id}
                  onChange={() => {
                    setChoice(option.id);
                    setCount(1);
                    setError("");
                  }}
                  required
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm font-semibold">
                    <span className="break-words">{option.name}</span>
                    <span className="whitespace-nowrap text-teal-800">
                      {option.price}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-sm leading-6 text-slate-600">
                    {option.detail}
                  </span>
                  <span className="mt-2 inline-block text-sm font-medium text-slate-600">
                    {option.status}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {available.length > 0 ? (
            <>
              {individual && (
                <div className="mt-6">
                  <TicketQuantity
                    value={quantity}
                    maximum={maximum}
                    disabled={busy}
                    onChange={(n) => {
                      setCount(n);
                      setError("");
                    }}
                  />
                  {maximum === 1 && (
                    <p className="mt-2 text-sm text-slate-600">
                      One ticket is available for this booking.
                    </p>
                  )}
                </div>
              )}
              <fieldset
                disabled={busy}
                className="mt-6 grid min-w-0 gap-4 border-0 border-t border-slate-200 px-0 py-5 [&_legend]:sr-only"
              >
                <legend>Ticket holder details</legend>
                {quantity > 1 && (
                  <p className="text-sm font-semibold text-slate-800">
                    Ticket 1 · Your details
                  </p>
                )}
                <label className="grid gap-2 text-sm font-semibold">
                  Full name
                  <input
                    className={publicStyles.input}
                    name="guestName"
                    autoComplete="name"
                    maxLength={200}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Email address
                  <input
                    className={publicStyles.input}
                    name="guestEmail"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                  />
                </label>
              </fieldset>
              {quantity > 1 && (
                <div className="mb-5">
                  <p className="text-sm leading-6 text-slate-600">
                    Each attendee receives a separate QR pass by email.
                  </p>
                  <fieldset
                    disabled={busy}
                    className="m-0 min-w-0 border-0 p-0"
                  >
                    <legend className="sr-only">Additional attendees</legend>
                    <AdditionalAttendees first={2} last={quantity} />
                  </fieldset>
                </div>
              )}

              {selected && (
                <dl
                  className="my-5 rounded-xl bg-slate-50 p-4 [&_dt]:text-sm [&_dt]:text-slate-600 [&_dd]:mt-1 [&_dd]:font-bold"
                  aria-live="polite"
                >
                  <div>
                    <dt>
                      {quantity} {quantity === 1 ? "ticket" : "tickets"} ·{" "}
                      {selected.name}
                    </dt>
                    <dd>
                      {quantity > 1
                        ? `${selected.price} per ticket`
                        : admissions(selected.people)}
                    </dd>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-slate-200 pt-3 [&_dd]:text-xl">
                    <dt>Total</dt>
                    <dd>
                      {tier
                        ? money(tier.priceMinor * quantity, tier.currency)
                        : selected.price}
                    </dd>
                  </div>
                </dl>
              )}

              {error && (
                <p
                  role="alert"
                  className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !selected}
                className={`${publicStyles.primary} w-full`}
              >
                {busy
                  ? selected?.id === "free"
                    ? "Issuing ticket…"
                    : "Reserving…"
                  : selected?.id === "free"
                    ? "Claim free ticket"
                    : selected
                      ? "Continue to payment"
                      : "Select a ticket to continue"}
              </button>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {selected?.id === "free"
                  ? "Your private QR pass will be ready after you claim."
                  : "Paid tickets are held for up to 15 minutes while you complete payment."}
              </p>
            </>
          ) : (
            <p role="status" className="mt-4 text-sm leading-6 text-slate-600">
              Tickets are currently unavailable. Already have a ticket? Open
              your private pass link for entry.
            </p>
          )}
        </form>
      )}
    </aside>
  );
}
