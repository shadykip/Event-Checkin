"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { admissions, eventDate, eventTime, money } from "../../public-events";
import { publicStyles } from "../../public-styles";
import { readPayment, startPayment } from "./actions";
import useReservationCountdown from "./use-reservation-countdown";
import PaymentConfirmation from "./payment-confirmation";

type Result = Awaited<ReturnType<typeof readPayment>>;
type Order = Extract<Result, { data: unknown }>["data"];
type Screen = {
  id: string;
  order?: Order;
  error?: string;
  missingKey?: boolean;
};

const states = {
  reserved: {
    title: "Complete your booking",
    label: "Payment pending",
    description:
      "Your ticket is reserved. Complete payment before the reservation expires to receive your QR pass.",
    symbol: "…",
    badge: "bg-teal-50 text-teal-800 ring-teal-200",
  },
  paid: {
    title: "Payment received",
    label: "Payment confirmed",
    description:
      "Your payment is confirmed. Keep your private QR pass link for entry to the event.",
    symbol: "✓",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  expired: {
    title: "Reservation expired",
    label: "Reservation expired",
    description:
      "If you submitted payment, check its status before reserving again. You can browse events to make a new reservation.",
    symbol: "!",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  review: {
    title: "Your payment needs a review",
    label: "Organizer review",
    description:
      "Your transaction needs organizer review. Contact the organizer before paying again.",
    symbol: "!",
    badge: "bg-amber-50 text-amber-900 ring-amber-200",
  },
  pass_changed: {
    title: "Get your current gate pass",
    label: "Payment received",
    description:
      "Your payment was received. Contact the organizer for your current gate pass and quote the order reference below.",
    symbol: "!",
    badge: "bg-amber-50 text-amber-900 ring-amber-200",
  },
} as const;

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const returned = useSearchParams().has("reference");
  const [screen, setScreen] = useState<Screen | null>(null);
  const [paymentError, setPaymentError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const running = useRef(false);
  const refreshing = useRef(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const key = sessionStorage.getItem(`ticket-checkout:${id}`);
        if (!key) {
          if (active)
            setScreen({
              id,
              missingKey: true,
              error:
                "Open checkout in the browser tab where you reserved. If you paid, check your email for the pass.",
            });
          return;
        }

        const result = await readPayment(id, key, returned || refresh > 0);
        if (!active) return;
        if ("error" in result) {
          setScreen((previous) => ({
            ...(previous?.id === id ? previous : {}),
            id,
            error: result.error,
          }));
        } else {
          setScreen({ id, order: result.data });
        }
      } catch {
        if (active)
          setScreen((previous) => ({
            ...(previous?.id === id ? previous : {}),
            id,
            error: "Could not load your reservation. Please try again.",
          }));
      } finally {
        if (active) {
          refreshing.current = false;
          setChecking(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [id, returned, refresh]);

  async function pay() {
    if (running.current || refreshing.current) return;
    running.current = true;
    setBusy(true);
    setPaymentError(null);

    try {
      const key = sessionStorage.getItem(`ticket-checkout:${id}`);
      if (!key) {
        setPaymentError({
          id,
          message:
            "Open checkout in the browser tab where you reserved your ticket.",
        });
        return;
      }
      const result = await startPayment(id, key);
      if ("error" in result) setPaymentError({ id, message: result.error });
      else window.location.assign(result.data.url);
    } catch {
      setPaymentError({
        id,
        message:
          "Could not open payment. Check the payment status before trying again.",
      });
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function checkStatus() {
    if (running.current || refreshing.current) return;
    refreshing.current = true;
    setChecking(true);
    setPaymentError(null);
    setRefresh((value) => value + 1);
  }

  const current = screen?.id === id ? screen : null;
  const order = current?.order;
  const error = paymentError?.id === id ? paymentError.message : current?.error;
  const state = order
    ? order.state === "reserved" && returned
      ? {
        ...states.reserved,
        title: "Awaiting payment confirmation",
        label: "Confirmation pending",
        description:
          "Your payment has not been confirmed yet. Check its status before attempting another payment.",
      }
      : states[order.state]
    : null;
  const price = order ? money(order.amountMinor, order.currency) : null;
  const canOpenPass = order?.state === "paid" && order.passPath;
  const showStatusCheck = !canOpenPass;
  const expiry = order ? new Date(order.expiresAt) : null;
  const countdown = useReservationCountdown(
    order?.state === "reserved" ? order.expiresAt : undefined,
  );

  return (
    <>
      <Link
        href="/"
        className="mb-7 inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
      >
        Back to events
      </Link>

      <header className="mb-8 max-w-3xl">
        <p className="mb-3 text-sm font-semibold text-teal-800">
          Ticket checkout
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {state?.title ??
            (current?.missingKey
              ? "Reopen your reservation"
              : "Your ticket reservation")}
        </h1>
        {state && (
          <p className="mt-4 text-base leading-7 text-slate-600">
            {state.description}
          </p>
        )}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:gap-8">
        <section
          aria-label="Payment status"
          aria-busy={!current || busy || checking}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          {!current && (
            <div
              role="status"
              className="flex items-center gap-3 py-6 text-slate-600"
            >
              <span
                aria-hidden="true"
                className="size-5 rounded-full border-2 border-slate-200 border-t-teal-700 motion-safe:animate-spin"
              />
              Checking your reservation…
            </div>
          )}

          {state && (
            <div
              role="status"
              className="mb-7 flex flex-wrap items-center gap-3"
            >
              <span
                aria-hidden="true"
                className={`grid size-11 place-items-center rounded-full text-xl font-bold ring-1 ring-inset ${state.badge}`}
              >
                {state.symbol}
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${state.badge}`}
              >
                {state.label}
              </span>
            </div>
          )}
          {order?.state === "reserved" && expiry && (
            <>
              {!returned && (
                <div
                  className={`mb-6 rounded-2xl border p-5 ${countdown.secondsLeft !== null && countdown.secondsLeft <= 60
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-teal-200 bg-teal-50 text-teal-950"
                    }`}
                >
                  <h2 className="text-sm font-semibold">
                    {countdown.expired ? "Hold time ended" : "Time left to pay"}
                  </h2>

                  <p
                    role="timer"
                    aria-live="off"
                    aria-label="Reservation time remaining"
                    className="mt-2 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl"
                  >
                    {countdown.label}
                  </p>

                  <p className="mt-3 text-sm leading-6">
                    Reserved until {eventTime.format(expiry)} EAT on{" "}
                    {eventDate.format(expiry)}.
                  </p>

                  {countdown.expired && (
                    <p role="status" className="mt-3 text-sm font-semibold leading-6">
                      Check payment status for the latest booking result. If you
                      submitted payment, check before reserving again.
                    </p>
                  )}
                </div>
              )}

              {returned ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-xl font-bold text-amber-800"
                    >
                      {checking ? (
                        <span className="size-5 rounded-full border-2 border-amber-200 border-t-amber-800 motion-safe:animate-spin" />
                      ) : (
                        "…"
                      )}
                    </span>

                    <div className="min-w-0">
                      <h2 className="text-lg font-bold tracking-tight text-amber-950">
                        Waiting for confirmation
                      </h2>

                      <p
                        role="status"
                        className="mt-1 text-sm leading-6 text-amber-900"
                      >
                        {checking
                          ? "Checking the latest payment result…"
                          : "Your QR pass will be available after payment is confirmed."}
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-amber-950">
                    If you completed payment, use “Check payment status” below
                    before trying to pay again. Keep this tab open while you
                    check the result.
                  </p>
                </div>
              ) : (
                <>
                  <p className="mb-6 text-base leading-7 text-slate-600">
                    You’ll complete payment on Paystack, then return here to
                    open your QR pass once payment is confirmed.
                  </p>

                  <button
                    type="button"
                    className={`${publicStyles.primary} w-full`}
                    disabled={
                      busy ||
                      checking ||
                      countdown.secondsLeft === null ||
                      countdown.expired
                    }
                    onClick={pay}
                  >
                    {busy
                      ? "Opening payment…"
                      : countdown.expired
                        ? "Hold time ended — check status below"
                        : `Pay ${price}`}
                  </button>
                </>
              )}
            </>
          )}
          {order?.state === "paid" && (
            <PaymentConfirmation
              tierName={order.tierName}
              peoplePerTicket={order.peoplePerTicket}
              passPath={order.passPath}
            />
          )}
          {order?.state === "expired" && (
            <Link href="/" className={`${publicStyles.secondary} w-full`}>
              Browse events
            </Link>
          )}
          {(order?.state === "review" || order?.state === "pass_changed") && (
            <p className="text-base leading-7 text-slate-600">
              Share the order reference with the organizer so they can find your
              booking.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            >
              {error}
            </p>
          )}

          {showStatusCheck && current && (
            <button
              type="button"
              onClick={checkStatus}
              disabled={busy || checking}
              className={`${publicStyles.secondary} mt-5 w-full`}
            >
              {checking
                ? "Checking payment status…"
                : current.missingKey
                  ? "Try again"
                  : "Check payment status"}
            </button>
          )}
        </section>

        <aside
          aria-labelledby="order-summary-title"
          className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="bg-linear-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white sm:p-8">
            <h2 id="order-summary-title" className="text-lg font-semibold">
              Order summary
            </h2>
            {order ? (
              <>
                <p className="mt-6 break-words text-2xl font-bold leading-tight tracking-tight">
                  {order.tierName}
                </p>
                <p className="mt-3 text-sm font-medium text-teal-200">
                  {admissions(order.peoplePerTicket)}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Your ticket details will appear once your reservation is loaded.
              </p>
            )}
          </div>
          <div className="p-6 sm:p-8">
            {order && (
              <dl className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-600">Ticket quantity</dt>
                  <dd className="font-semibold text-slate-950">1 ticket</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-600">Admission allowance</dt>
                  <dd className="font-semibold text-slate-950">
                    Up to {order.peoplePerTicket}{" "}
                    {order.peoplePerTicket === 1 ? "person" : "people"}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-dashed border-slate-300 pt-5">
                  <dt className="text-base font-semibold text-slate-950">
                    Total
                  </dt>
                  <dd className="text-3xl font-bold tracking-tight text-slate-950">
                    {price}
                  </dd>
                </div>
              </dl>
            )}
            <div
              className={`${order ? "mt-6 border-t border-slate-200 pt-5" : ""}`}
            >
              <h3 className="text-sm font-semibold text-slate-950">
                Order reference
              </h3>
              <p className="mt-2 break-all font-mono text-sm leading-6 text-slate-600">
                ticket-{id}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Keep this reference if you need help with your booking.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
