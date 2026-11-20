"use client";

import { useState } from "react";

export type RsvpStatus = "PENDING" | "ACCEPTED" | "DECLINED";
type Answer = Exclude<RsvpStatus, "PENDING">;

type Props = {
    token: string;
    initialStatus: RsvpStatus;
    onUnavailable: () => void;
};

const choices: { value: Answer; label: string }[] = [
    { value: "ACCEPTED", label: "Going" },
    { value: "DECLINED", label: "Can’t attend" },
];

const statusMessages: Record<RsvpStatus, string> = {
    PENDING: "You haven’t responded yet.",
    ACCEPTED: "You’re going.",
    DECLINED: "You’ve marked that you can’t attend.",
};

export default function GuestRsvp({
    token,
    initialStatus,
    onUnavailable,
}: Props) {
    const [status, setStatus] = useState(initialStatus);
    const [saving, setSaving] = useState<Answer | null>(null);
    const [error, setError] = useState("");

    async function respond(answer: Answer) {
        if (saving || (answer === status && !error)) return;

        setSaving(answer);
        setError("");

        try {
            const response = await fetch("/api/invitations/rsvp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, status: answer }),
                cache: "no-store",
            });

            if (response.status === 404) {
                onUnavailable();
                return;
            }

            if (!response.ok) {
                throw new Error("RSVP request failed");
            }

            const saved: { rsvpStatus: Answer } = await response.json();
            setStatus(saved.rsvpStatus);
        } catch {
            setError(
                "Couldn’t confirm your response. Choose your answer again or refresh to see what was saved.",
            );
        } finally {
            setSaving(null);
        }
    }

    return (
        <section
            aria-labelledby="guest-rsvp-heading"
            className="mt-6 border-t border-slate-200 pt-5"
        >
            <h2 id="guest-rsvp-heading" className="text-lg font-semibold text-slate-950">
                Will you attend?
            </h2>

            <p role="status" className="mt-1 text-sm text-slate-600">
                {saving ? "Saving your response…" : statusMessages[status]}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
                {choices.map(({ value, label }) => {
                    const selected = status === value;

                    return (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            disabled={saving !== null}
                            onClick={() => respond(value)}
                            className={[
                                "min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold",
                                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700",
                                "disabled:cursor-wait disabled:opacity-60",
                                selected
                                    ? "border-teal-700 bg-teal-700 text-white"
                                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
                            ].join(" ")}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {error && (
                <p role="alert" className="mt-3 text-sm text-rose-800">
                    {error}
                </p>
            )}
        </section>
    );
}