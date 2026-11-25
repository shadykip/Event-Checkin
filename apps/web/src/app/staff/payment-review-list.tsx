"use client";

import { useEffect, useState } from "react";

type ReviewItem = {
    kind: "purchase" | "individual";
    reference: string;
    name: string;
    email: string;
    amountMinor: number;
    currency: string;
    reason: string | null;
    createdAt: string;
};
type ResolvedReviewItem = {
    kind: "purchase" | "individual";
    reference: string;
    name: string;
    amountMinor: number;
    currency: string;
    reason: string | null;
    resolution: string | null;
    note: string | null;
    resolvedAt: string | null;
    resolvedBy: string | null;
};
type ProviderCheck = {
    reference: string;
    reviewReason: string | null;
    expectedAmountMinor: number;
    expectedCurrency: string;
    provider: {
        status: string;
        reference: string;
        amountMinor: number;
        currency: string;
        domain: string;
        paidAt: string | null;
        refunds: {
            id: number;
            status: string;
            amountMinor: number;
            currency: string;
            refundedAt: string | null;
        }[];
    };
    matches: {
        reference: boolean;
        amount: boolean;
        currency: boolean;
    };
};

function money(amountMinor: number, currency: string) {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}

export default function PaymentReviewList({ slug }: { slug: string }) {
    const [items, setItems] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [checking, setChecking] = useState<string | null>(null);
    const [resolving, setResolving] = useState<string | null>(null);
    const [checks, setChecks] = useState<Record<string, ProviderCheck>>({});
    const [checkErrors, setCheckErrors] = useState<Record<string, string>>({});
    const [resolved, setResolved] = useState<ResolvedReviewItem[]>([]);
    const [resolvedLoading, setResolvedLoading] = useState(true);
    const [resolvedError, setResolvedError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError("");
            setChecks({});
            setCheckErrors({});

            try {
                const response = await fetch(
                    `/api/staff/events/${encodeURIComponent(slug)}/payment-reviews`,
                    { cache: "no-store", signal: controller.signal },
                );

                if (!response.ok) {
                    throw new Error("Could not load payments needing review.");
                }

                const data: { items: ReviewItem[] } = await response.json();
                if (!controller.signal.aborted) {
                    setItems(data.items);
                }
            } catch {
                if (!controller.signal.aborted) {
                    setError("Could not load payments needing review.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void load();
        return () => controller.abort();
    }, [slug, refresh]);

    useEffect(() => {
        const controller = new AbortController();

        async function loadResolved() {
            setResolvedLoading(true);
            setResolvedError("");

            try {
                const response = await fetch(
                    `/api/staff/events/${encodeURIComponent(slug)}/payment-reviews/resolved`,
                    { cache: "no-store", signal: controller.signal },
                );

                if (!response.ok) {
                    throw new Error("Could not load resolved payment reviews.");
                }

                const data: { items: ResolvedReviewItem[] } = await response.json();
                if (!controller.signal.aborted) {
                    setResolved(data.items);
                }
            } catch {
                if (!controller.signal.aborted) {
                    setResolvedError("Could not load resolved payment reviews.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setResolvedLoading(false);
                }
            }
        }

        void loadResolved();
        return () => controller.abort();
    }, [slug, refresh]);

    async function checkProvider(item: ReviewItem) {
        const key = `${item.kind}-${item.reference}`;
        const id = item.reference.replace(/^ticket-/, "");

        setChecking(key);
        setChecks((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        setCheckErrors((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });

        try {
            const response = await fetch(
                `/api/staff/events/${encodeURIComponent(slug)}/payment-reviews/${item.kind}/${encodeURIComponent(id)}/provider`,
                { cache: "no-store" },
            );

            if (!response.ok) {
                throw new Error("Could not confirm this transaction with Paystack.");
            }

            const result: ProviderCheck = await response.json();
            setChecks((current) => ({ ...current, [key]: result }));
        } catch {
            setCheckErrors((current) => ({
                ...current,
                [key]: "Could not confirm this transaction with Paystack. Try again.",
            }));
        } finally {
            setChecking(null);
        }
    }

    async function resolveReversed(item: ReviewItem) {
        const key = `${item.kind}-${item.reference}`;
        const id = item.reference.replace(/^ticket-/, "");

        setResolving(key);
        setCheckErrors((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });

        try {
            const response = await fetch(
                `/api/staff/events/${encodeURIComponent(slug)}/payment-reviews/${item.kind}/${encodeURIComponent(id)}/resolve-reversed`,
                { method: "POST", cache: "no-store" },
            );

            if (!response.ok) {
                throw new Error("Could not record the reversal.");
            }

            setRefresh((value) => value + 1);
        } catch {
            setCheckErrors((current) => ({
                ...current,
                [key]: "Could not record the reversal. Check Paystack again.",
            }));
        } finally {
            setResolving(null);
        }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-950">
                        Payments needing review
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Recent orders that require organizer follow-up. Check the provider
                        transaction before deciding what to do.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setRefresh((value) => value + 1)}
                    disabled={loading || checking !== null}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                    Refresh
                </button>
            </div>

            {loading && (
                <p role="status" className="mt-5 text-sm text-slate-600">
                    Loading payment reviews…
                </p>
            )}

            {error && (
                <p role="alert" className="mt-5 text-sm text-red-700">
                    {error}
                </p>
            )}

            {!loading && !error && items.length === 0 && (
                <p className="mt-5 text-sm text-slate-600">
                    No payments currently need review.
                </p>
            )}

            {!loading && !error && items.length > 0 && (
                <ul className="mt-5 space-y-3">
                    {items.map((item) => {
                        const key = `${item.kind}-${item.reference}`;
                        const check = checks[key];
                        const processedRefundTotal =
                            check?.provider.refunds
                                .filter(
                                    (refund) =>
                                        refund.status === "processed" &&
                                        refund.currency === item.currency,
                                )
                                .reduce((total, refund) => total + refund.amountMinor, 0) ?? 0;

                        const fullRefundProcessed =
                            processedRefundTotal === item.amountMinor &&
                            processedRefundTotal > 0;

                        return (
                            <li
                                key={key}
                                className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                            >
                                <div className="flex flex-wrap justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-slate-950">{item.name}</p>
                                        <p className="text-sm text-slate-700">{item.email}</p>
                                    </div>
                                    <p className="font-semibold text-slate-950">
                                        {money(item.amountMinor, item.currency)}
                                    </p>
                                </div>

                                <p className="mt-3 break-all font-mono text-xs text-slate-700">
                                    {item.reference}
                                </p>
                                <p className="mt-2 text-sm font-medium text-amber-950">
                                    {item.reason ?? "Payment requires review."}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => void checkProvider(item)}
                                    disabled={checking !== null}
                                    className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {checking === key ? "Checking Paystack…" : "Check Paystack"}
                                </button>

                                {checkErrors[key] && (
                                    <p role="alert" className="mt-3 text-sm text-red-700">
                                        {checkErrors[key]}
                                    </p>
                                )}

                                {check && (
                                    <div
                                        role="status"
                                        className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800"
                                    >
                                        <p className="font-semibold text-slate-950">
                                            Provider status: {check.provider.status}
                                        </p>
                                        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                                            <div>
                                                <dt className="text-slate-500">Reference</dt>
                                                <dd className="break-all font-mono text-xs">
                                                    {check.provider.reference}
                                                    {" · "}
                                                    {check.matches.reference ? "Matches" : "Mismatch"}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-slate-500">Amount</dt>
                                                <dd>
                                                    {money(
                                                        check.provider.amountMinor,
                                                        check.provider.currency,
                                                    )}
                                                    {" · "}
                                                    {check.matches.amount ? "Matches" : "Mismatch"}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-slate-500">Currency</dt>
                                                <dd>
                                                    {check.provider.currency}
                                                    {" · "}
                                                    {check.matches.currency ? "Matches" : "Mismatch"}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-slate-500">Payment time</dt>
                                                <dd>
                                                    {check.provider.paidAt
                                                        ? new Date(check.provider.paidAt).toLocaleString(
                                                            "en-KE",
                                                            { timeZone: "Africa/Nairobi" },
                                                        )
                                                        : "Not provided"}
                                                </dd>
                                            </div>
                                        </dl>
                                        <p className="mt-3 text-xs text-slate-600">
                                            Provider domain: {check.provider.domain}. This check does
                                            not approve payment or issue passes.
                                        </p>

                                        <div className="mt-4 border-t border-slate-200 pt-4">
                                            <h3 className="font-semibold text-slate-950">Refund status</h3>

                                            {check.provider.refunds.length === 0 ? (
                                                <p className="mt-1 text-slate-600">
                                                    No refund found for this Paystack transaction.
                                                </p>
                                            ) : (
                                                <ul className="mt-2 space-y-2">
                                                    {check.provider.refunds.map((refund) => (
                                                        <li
                                                            key={refund.id}
                                                            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                                                        >
                                                            <p className="font-medium text-slate-950">
                                                                {money(refund.amountMinor, refund.currency)}
                                                                {" · "}
                                                                <span className="capitalize">
                                                                    {refund.status.replaceAll("-", " ")}
                                                                </span>
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-600">
                                                                Refund #{refund.id}
                                                                {refund.refundedAt
                                                                    ? ` · Provider date: ${new Date(
                                                                        refund.refundedAt,
                                                                    ).toLocaleString("en-KE", {
                                                                        timeZone: "Africa/Nairobi",
                                                                    })}`
                                                                    : ""}
                                                            </p>
                                                            {refund.status === "processed" && (
                                                                <p className="mt-1 text-xs text-teal-800">
                                                                    Paystack reports this refund as processed.
                                                                </p>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => void resolveReversed(item)}
                                            disabled={
                                                resolving !== null ||
                                                checking !== null ||
                                                check.provider.status !== "reversed" ||
                                                !check.matches.reference ||
                                                !check.matches.amount ||
                                                !check.matches.currency
                                            }
                                            className="mt-4 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {resolving === key
                                                ? "Recording resolution…"
                                                : fullRefundProcessed
                                                    ? "Record processed refund"
                                                    : "Record provider reversal"}
                                        </button>

                                        {check.provider.status !== "reversed" && (
                                            <p className="mt-2 text-xs text-slate-600">
                                                Available when Paystack reports the transaction as reversed.
                                                Current status: {check.provider.status}.
                                            </p>
                                        )}

                                        {check.provider.status === "reversed" &&
                                            (!check.matches.reference ||
                                                !check.matches.amount ||
                                                !check.matches.currency) && (
                                                <p className="mt-2 text-xs text-red-700">
                                                    The provider transaction does not match this booking.
                                                </p>
                                            )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <details className="mt-6 border-t border-slate-200 pt-5">
                <summary className="cursor-pointer font-semibold text-slate-950">
                    Recently resolved
                    {!resolvedLoading && ` (${resolved.length})`}
                </summary>

                {resolvedLoading && (
                    <p className="mt-3 text-sm text-slate-600">Loading history…</p>
                )}

                {resolvedError && (
                    <p role="alert" className="mt-3 text-sm text-red-700">
                        {resolvedError}
                    </p>
                )}

                {!resolvedLoading && !resolvedError && resolved.length === 0 && (
                    <p className="mt-3 text-sm text-slate-600">
                        No payment reviews have been resolved yet.
                    </p>
                )}

                {!resolvedLoading && !resolvedError && resolved.length > 0 && (
                    <ul className="mt-3 space-y-2">
                        {resolved.map((item) => (
                            <li
                                key={`${item.kind}-${item.reference}`}
                                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                            >
                                <div className="flex flex-wrap justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-slate-950">{item.name}</p>
                                        <p className="break-all font-mono text-xs text-slate-600">
                                            {item.reference}
                                        </p>
                                    </div>
                                    <p className="font-semibold text-slate-950">
                                        {money(item.amountMinor, item.currency)}
                                    </p>
                                </div>

                                <p className="mt-2 text-sm font-medium text-teal-800">
                                    {item.resolution === "PROVIDER_REFUND_PROCESSED"
                                        ? "Refund processed by Paystack"
                                        : "Provider reversal recorded"}
                                </p>

                                {item.note && (
                                    <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                                )}

                                {item.resolvedAt && (
                                    <p className="mt-2 text-xs text-slate-500">
                                        Recorded{" "}
                                        {new Date(item.resolvedAt).toLocaleString("en-KE", {
                                            timeZone: "Africa/Nairobi",
                                        })}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </details>
        </section>
    );
}