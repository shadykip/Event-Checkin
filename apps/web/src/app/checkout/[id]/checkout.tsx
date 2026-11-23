"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { readPayment, startPayment } from "./actions";

type Result = Awaited<ReturnType<typeof readPayment>>;
type Status = Extract<Result, { data: unknown }>["data"];

const button =
    "inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-50";

export default function Checkout() {
    const { id } = useParams<{ id: string }>();
    const returned = useSearchParams().has("reference");
    const [order, setOrder] = useState<Status | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        let active = true;
        const key = sessionStorage.getItem(`ticket-checkout:${id}`);

        async function load() {
            if (!key) {
                if (active) setError("Open checkout in the browser tab where you reserved. If you paid, check your email for the pass.");
                return;
            }

            const result = await readPayment(id, key, returned || refresh > 0);
            if (!active) return;
            if ("error" in result) setError(result.error);
            else {
                setOrder(result.data);
                setError("");
            }
        }

        void load().catch(() => {
            if (active) setError("Could not load your order. Try again.");
        });
        return () => { active = false; };
    }, [id, returned, refresh]);

    async function pay() {
        const key = sessionStorage.getItem(`ticket-checkout:${id}`);
        if (!key || busy) return;
        setBusy(true);
        setError("");

        try {
            const result = await startPayment(id, key);
            if ("error" in result) setError(result.error);
            else window.location.assign(result.data.url);
        } catch {
            setError("Could not open checkout. Check the order status.");
        } finally {
            setBusy(false);
        }
    }

    const price = order && new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: order.currency,
    }).format(order.amountMinor / 100);

    return (
        <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-950">
                {order?.state === "paid" ? "Payment received" : "Ticket checkout"}
            </h1>

            {order && <p className="font-medium text-slate-800">{order.tierName} · {price}</p>}
            {!order && !error && <p role="status">Checking order status…</p>}

            {order?.state === "reserved" && (
                <>
                    <p className="text-sm text-slate-600">
                        Reserved until {new Intl.DateTimeFormat("en-KE", {
                            timeStyle: "short", timeZone: "Africa/Nairobi",
                        }).format(new Date(order.expiresAt))} Nairobi time.
                    </p>
                    {returned ? (
                        <p role="status">Awaiting payment confirmation. Check status before trying another payment.</p>
                    ) : (
                        <button className={button} disabled={busy} onClick={pay}>
                            {busy ? "Opening checkout…" : `Pay ${price}`}
                        </button>
                    )}
                </>
            )}

            {order?.state === "paid" && order.passPath && (
                <a className={button} href={order.passPath}>Open my QR pass</a>
            )}
            {order?.state === "expired" && (
                <p>Your reservation has expired. If you submitted payment, check its status. Otherwise, return to the event to reserve again.</p>
            )}
            {order?.state === "review" && (
                <p>Your transaction needs organizer review. Keep the order reference below and contact the organizer before paying again.</p>
            )}
            {order?.state === "pass_changed" && (
                <p>Your payment was received. Contact the organizer for your current gate pass.</p>
            )}

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

            {order?.state !== "paid" && (
                <button className="block text-sm font-semibold text-teal-800 underline"
                    onClick={() => setRefresh((n) => n + 1)}>
                    Check payment status
                </button>
            )}
            <p className="break-all text-xs text-slate-500">Order reference · ticket-{id}</p>
        </section>
    );
}