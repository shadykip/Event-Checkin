"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const input =
    "mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 focus:border-teal-700 focus:outline-2 focus:outline-teal-700";

export default function FreeTicketForm({ slug }: { slug: string }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [passPath, setPassPath] = useState("");
    const router = useRouter();

    async function register(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || passPath) return;

        const data = new FormData(event.currentTarget);
        setBusy(true);
        setError("");

        try {
            const response = await fetch(`/api/events/${encodeURIComponent(slug)}/tickets`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guestName: data.get("guestName"),
                    guestEmail: data.get("guestEmail"),
                }),
            });

            const body = await response.json();



            if (!response.ok) {
                setError(
                    typeof body.message === "string"
                        ? body.message
                        : "Could not issue a ticket.",
                );

                if (response.status === 409) {
                    router.refresh();
                }

                return;
            }

            if (typeof body.passPath !== "string" || !/^\/pass#[A-Za-z0-9_-]{43}$/.test(body.passPath)) {
                throw new Error();
            }

            setPassPath(body.passPath);
        } catch {
            setError("Could not confirm your ticket. If retrying reports an existing pass, contact the organizer.");
        } finally {
            setBusy(false);
        }
    }

    if (passPath) {
        return (
            <section className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
                <h2 role="status" className="text-xl font-semibold">Your ticket is ready</h2>
                <p className="mt-2 text-sm text-slate-700">
                    Open your private QR pass and bookmark it before closing this page.
                </p>
                <a href={passPath} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-teal-800 px-5 font-semibold text-white">
                    Open my QR pass
                </a>
            </section>
        );
    }

    return (
        <form onSubmit={register} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Get your free ticket</h2>
            <label className="text-sm font-semibold">
                Full name
                <input className={input} name="guestName" autoComplete="name" maxLength={200} required />
            </label>
            <label className="text-sm font-semibold">
                Email address
                <input className={input} type="email" name="guestEmail" autoComplete="email" maxLength={254} required />
            </label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="min-h-12 rounded-xl bg-teal-800 px-5 font-semibold text-white hover:bg-teal-900 disabled:opacity-60">
                {busy ? "Issuing ticket…" : "Claim free ticket"}
            </button>
        </form>
    );
}