"use client";

import { useEffect, useState } from "react";

type SalesSummary = {
    currency: string;
    paidOrders: number;
    ticketsSold: number;
    grossMinor: number;
    providerFeesMinor: number;
    feeRecordedOrders: number;
    feeAdjustedMinor: number | null;
};

const count = new Intl.NumberFormat("en-KE");

function formatMoney(amountMinor: number, currency: string) {
    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
    }).format(amountMinor / 100);
}

export default function TicketSalesCards() {
    const [summary, setSummary] = useState<SalesSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError("");

            try {
                const response = await fetch("/api/staff/overview/ticket-sales", {
                    cache: "no-store",
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error("Could not load ticket sales.");
                }

                const result: SalesSummary = await response.json();
                if (!controller.signal.aborted) setSummary(result);
            } catch {
                if (!controller.signal.aborted) {
                    setSummary(null);
                    setError("Could not load ticket sales. Please try again.");
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void load();
        return () => controller.abort();
    }, [refresh]);

    const feesComplete =
        summary !== null &&
        summary.feeRecordedOrders === summary.paidOrders;

    return (
        <section aria-labelledby="ticket-sales-heading" className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
                        Event performance
                    </p>
                    <h2
                        id="ticket-sales-heading"
                        className="mt-1 text-2xl font-bold tracking-tight text-slate-950"
                    >
                        Ticket sales
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Confirmed ticket sales across events you organize.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setRefresh((value) => value + 1)}
                    disabled={loading}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-teal-600 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50"
                >
                    {loading ? "Updating…" : "Refresh sales"}
                </button>
            </div>

            {error && (
                <p
                    role="alert"
                    className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                    {error}
                </p>
            )}

            <div
                aria-busy={loading}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
                <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 p-6 text-white shadow-lg shadow-slate-900/10">
                    <div
                        aria-hidden="true"
                        className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-teal-400/15 blur-2xl"
                    />
                    <div className="relative">
                        <p className="text-sm font-medium text-teal-100">Gross sales</p>
                        <p className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
                            {summary
                                ? formatMoney(summary.grossMinor, summary.currency)
                                : "—"}
                        </p>
                        <p className="mt-3 text-xs text-slate-300">
                            Before provider fees and refunds
                        </p>
                    </div>
                </article>

                <article className="rounded-2xl border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-6 shadow-sm">
                    <p className="text-sm font-medium text-teal-900">Tickets sold</p>
                    <p className="mt-5 text-4xl font-bold tracking-tight text-slate-950">
                        {summary ? count.format(summary.ticketsSold) : "—"}
                    </p>
                    <p className="mt-3 text-xs text-slate-600">
                        Individual passes issued through paid orders
                    </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
                    <p className="text-sm font-medium text-slate-700">Paid orders</p>
                    <p className="mt-5 text-4xl font-bold tracking-tight text-slate-950">
                        {summary ? count.format(summary.paidOrders) : "—"}
                    </p>
                    <p className="mt-3 text-xs text-slate-600">
                        One purchase may contain several tickets
                    </p>
                </article>

                <article className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 p-6 shadow-sm">
                    <p className="text-sm font-medium text-sky-950">
                        Recorded Paystack fees
                    </p>
                    <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">
                        {summary
                            ? formatMoney(summary.providerFeesMinor, summary.currency)
                            : "—"}
                    </p>
                    <p className="mt-3 text-xs text-slate-600">
                        {summary
                            ? `Fee captured for ${count.format(summary.feeRecordedOrders)} of ${count.format(summary.paidOrders)} paid orders`
                            : "Fees captured during payment confirmation"}
                    </p>
                </article>

                <article className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-6 shadow-sm sm:col-span-2 xl:col-span-2">
                    <p className="text-sm font-medium text-violet-950">
                        Gross minus Paystack fees
                    </p>
                    <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                        {feesComplete && summary?.feeAdjustedMinor !== null
                            ? formatMoney(summary.feeAdjustedMinor, summary.currency)
                            : "—"}
                    </p>
                    <p className="mt-3 text-xs text-slate-600">
                        {summary && !feesComplete
                            ? "Unavailable until fees are captured for every paid order."
                            : "Before refunds and other settlement adjustments; not a bank payout."}
                    </p>
                </article>
            </div>
        </section>
    );
}