"use client";

import { useState, type FormEvent } from "react";

export default function InviteDoorStaff({
    slug,
    onInvited,
}: {
    slug: string;
    onInvited?: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;

        const form = event.currentTarget;
        const data = new FormData(form);

        setBusy(true);
        setMessage("");
        setError("");

        try {
            const response = await fetch(
                `/api/staff/events/${encodeURIComponent(slug)}/team/invite`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: String(data.get("name") ?? "").trim(),
                        email: String(data.get("email") ?? "").trim(),
                    }),
                },
            );

            const result = await response.json().catch(() => null);

            if (!response.ok) {
                const detail = result?.message;
                throw new Error(
                    Array.isArray(detail)
                        ? detail.join(", ")
                        : typeof detail === "string"
                            ? detail
                            : "Could not invite this staff member.",
                );
            }

            setMessage(result?.message ?? "Staff invitation sent.");
            form.reset();
            onInvited?.();
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Could not invite this staff member.",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
                <h4 className="font-semibold text-slate-950">Invite new door staff</h4>
                <p className="mt-1 text-sm text-slate-600">
                    Send an account setup link and assign this person to the event.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-800">
                    Name
                    <input
                        name="name"
                        required
                        maxLength={120}
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                </label>
                <label className="text-sm font-medium text-slate-800">
                    Email
                    <input
                        name="email"
                        type="email"
                        required
                        maxLength={254}
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                </label>
            </div>

            <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
                {busy ? "Sending invitation…" : "Invite door staff"}
            </button>

            {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </form>
    );
}