"use client";

import { useRef, useState, type FormEvent } from "react";
import { reserveTicket } from "./reserve-ticket";

export type PublicTier = {
    id: string;
    name: string;
    priceMinor: number;
    currency: string;
};

function money(amount: number, currency: string) {
    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency,
    }).format(amount / 100);
}

const field =
    "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 focus:border-teal-700";

export default function PaidTicketForm({
    slug, tiers,
}: { slug: string; tiers: PublicTier[] }) {
    const attempt = useRef<{ signature: string; key: string } | null>(null);
    const running = useRef(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [confirmation, setConfirmation] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (running.current) return;

        const data = new FormData(event.currentTarget);
        const tierId = String(data.get("tierId"));
        const name = String(data.get("guestName")).trim();
        const email = String(data.get("guestEmail")).trim().toLowerCase();
        const signature = JSON.stringify([slug, tierId, name, email]);

        if (attempt.current?.signature !== signature) {
            attempt.current = { signature, key: crypto.randomUUID() };
        }

        running.current = true;
        setBusy(true);
        setError("");

        try {
            const result = await reserveTicket(slug, tierId, attempt.current.key, name, email);
            if ("error" in result) {
                setError(result.error);
                if (result.error.startsWith("Reservation expired.")) attempt.current = null;
                return;
            }

            const { tierName, amountMinor, currency, expiresAt } = result.receipt;
            const expiry = new Intl.DateTimeFormat("en-KE", {
                timeZone: "Africa/Nairobi",
                dateStyle: "medium",
                timeStyle: "medium",
            }).format(new Date(expiresAt));

            setConfirmation(
                `${tierName} · ${money(amountMinor, currency)}. Reservation expires ${expiry} Nairobi time. Payment is pending.`,
            );
        } catch {
            setError("Connection interrupted. Retry with the same details.");
        } finally {
            running.current = false;
            setBusy(false);
        }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Reserve a paid ticket</h2>
            {confirmation ? <p role="status" className="mt-4">{confirmation}</p> : (
                <form onSubmit={submit} className="mt-4 grid gap-4">
                    <label className="text-sm font-semibold">
                        Ticket type
                        <select name="tierId" className={field} required>
                            {tiers.map((tier) => (
                                <option key={tier.id} value={tier.id}>
                                    {tier.name} · {money(tier.priceMinor, tier.currency)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm font-semibold">
                        Full name
                        <input className={field} name="guestName" autoComplete="name" maxLength={200} required />
                    </label>
                    <label className="text-sm font-semibold">
                        Email address
                        <input className={field} name="guestEmail" type="email" autoComplete="email" maxLength={254} required />
                    </label>
                    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    <button disabled={busy} className="min-h-11 rounded-xl bg-teal-700 px-4 font-semibold text-white disabled:opacity-60">
                        {busy ? "Reserving…" : "Reserve one ticket"}
                    </button>
                </form>
            )}
        </section>
    );
}