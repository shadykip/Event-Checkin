"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { reserveTicket } from "./reserve-ticket";

export type PublicTier = {
    id: string;
    name: string;
    priceMinor: number;
    currency: string;
};

type Props = {
    slug: string;
    freeStatus: "available" | "closed" | "sold_out";
    tiers: PublicTier[];
};

type Success =
    | { kind: "free"; passPath: string }
    | { kind: "paid"; tierName: string; price: string; expiresAt: string };

const input =
    "mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base font-normal text-slate-950 focus:border-teal-700 focus:outline-2 focus:outline-teal-700";

const action =
    "inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-60";

function money(amountMinor: number, currency: string) {
    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency,
    }).format(amountMinor / 100);
}

const nairobiTime = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
});

export default function TicketChoiceForm({ slug, freeStatus, tiers }: Props) {
    const router = useRouter();
    const [choice, setChoice] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [success, setSuccess] = useState<Success | null>(null);
    const running = useRef(false);
    const retryKeys = useRef(new Map<string, string>());

    const options = tiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        price: money(tier.priceMinor, tier.currency),
        detail: "Reserve for up to 15 minutes. Payment is required for admission.",
    }));

    if (freeStatus === "available") {
        options.unshift({
            id: "free",
            name: "Free admission",
            price: "Free",
            detail: "Claim a ticket to receive your QR pass immediately.",
        });
    }

    // Multiple options require an explicit choice, including after availability changes.
    const selected = options.find((option) => option.id === choice)
        ?? (!choice && options.length === 1 ? options[0] : undefined);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selected || running.current || success) return;

        const form = new FormData(event.currentTarget);
        const guestName = String(form.get("guestName") ?? "").trim();
        const guestEmail = String(form.get("guestEmail") ?? "").trim().toLowerCase();

        running.current = true;
        setBusy(true);
        setError("");

        try {
            if (selected.id === "free") {
                const response = await fetch(`/api/events/${encodeURIComponent(slug)}/tickets`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ guestName, guestEmail }),
                    cache: "no-store",
                });

                const body = await response.json();
                if (!response.ok) {
                    setError(typeof body?.message === "string" ? body.message : "Could not issue a ticket.");
                    if (response.status === 409) router.refresh();
                    return;
                }

                if (typeof body?.passPath !== "string" || !/^\/pass#[A-Za-z0-9_-]{43}$/.test(body.passPath)) {
                    throw new Error("Unexpected pass link");
                }

                setSuccess({ kind: "free", passPath: body.passPath });
                return;
            }

            const signature = JSON.stringify([slug, selected.id, guestName, guestEmail]);
            const key = retryKeys.current.get(signature) ?? crypto.randomUUID();
            retryKeys.current.set(signature, key);

            const result = await reserveTicket(slug, selected.id, key, guestName, guestEmail);
            if ("error" in result) {
                setError(result.error);
                if (result.error.startsWith("Reservation expired.")) {
                    retryKeys.current.delete(signature);
                }
                return;
            }

            const receipt = result.receipt;
            setSuccess({
                kind: "paid",
                tierName: receipt.tierName,
                price: money(receipt.amountMinor, receipt.currency),
                expiresAt: receipt.expiresAt,
            });
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

    const buttonText = selected?.id === "free"
        ? "Claim free ticket"
        : selected
            ? `Reserve ${selected.name} · ${selected.price}`
            : "Select a ticket to continue";

    return (
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-sm sm:p-6">
            {success ? (
                <div role="status">
                    <h2 className="text-xl font-semibold">
                        {success.kind === "free" ? "Your ticket is ready" : `${success.tierName} reserved`}
                    </h2>
                    {success.kind === "free" ? (
                        <>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Open your private QR pass and bookmark it before closing this page.
                            </p>
                            <a href={success.passPath} className={`${action} mt-4`}>Open my QR pass</a>
                        </>
                    ) : (
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                            {success.price} · Payment pending. Your reservation expires on{" "}
                            {nairobiTime.format(new Date(success.expiresAt))} Nairobi time.
                        </p>
                    )}
                </div>
            ) : options.length === 0 ? (
                <div role="status">
                    <h2 className="text-xl font-semibold">
                        {freeStatus === "sold_out" ? "Free tickets sold out" : "Registration closed"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Already have a ticket? Open your private pass link for entry.
                    </p>
                    {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
                </div>
            ) : (
                <form onSubmit={submit}>
                    <fieldset disabled={busy} className="grid min-w-0 gap-2">
                        <legend className="mb-4 text-xl font-semibold">Choose your ticket</legend>

                        {options.map((option) => (
                            <label
                                key={option.id}
                                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 p-3.5 has-checked:border-teal-700 has-checked:bg-teal-50 focus-within:ring-2 focus-within:ring-teal-700"
                            >
                                <input
                                    type="radio"
                                    name="ticket"
                                    value={option.id}
                                    checked={selected?.id === option.id}
                                    onChange={() => {
                                        setChoice(option.id);
                                        setError("");
                                    }}
                                    className="mt-1 accent-teal-700"
                                    required
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                                        <span className="font-semibold">{option.name}</span>
                                        <span className="text-sm font-semibold text-teal-800">{option.price}</span>
                                    </span>
                                    <span className="mt-1 block text-sm leading-5 text-slate-600">
                                        {option.detail}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </fieldset>

                    {freeStatus === "sold_out" && (
                        <p className="mt-2 text-sm text-slate-600">Free admission is sold out.</p>
                    )}

                    <fieldset disabled={busy} className="mt-5 grid gap-4 border-t border-slate-200 pt-5">
                        <legend className="sr-only">Guest details</legend>
                        <label className="text-sm font-semibold">
                            Full name
                            <input className={input} name="guestName" autoComplete="name" maxLength={200} required />
                        </label>
                        <label className="text-sm font-semibold">
                            Email address
                            <input className={input} name="guestEmail" type="email" autoComplete="email" maxLength={254} required />
                        </label>
                    </fieldset>

                    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

                    <button type="submit" disabled={busy || !selected} className={`${action} mt-5 w-full`}>
                        {busy ? (selected?.id === "free" ? "Issuing ticket…" : "Reserving…") : buttonText}
                    </button>
                </form>
            )}
        </aside>
    );
}