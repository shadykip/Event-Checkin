"use client";

import { useState } from "react";
import styles from "./staff-styles";

type Props = {
    slug: string;
    guest: {
        id: string;
        guestName: string;
        guestEmail: string;
    };
    onRevoked: (guestName: string) => void;
};

export default function RevokePassButton({ slug, guest, onRevoked }: Props) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function revoke() {
        if (busy) return;

        setBusy(true);
        setError("");

        try {
            const response = await fetch(
                `/api/staff/events/${encodeURIComponent(slug)}/invitations/${encodeURIComponent(guest.id)}/revoke`,
                {
                    method: "POST",
                    cache: "no-store",
                },
            );

            if (!response.ok) {
                const messages: Record<number, string> = {
                    401: "Your session expired. Sign in again.",
                    403: "Organizer access is required for this event.",
                    404: "This invitation could not be found for this event.",
                };

                setError(
                    messages[response.status] ??
                    "Could not confirm revocation. You can retry this request.",
                );
                return;
            }

            onRevoked(guest.guestName);
        } catch {
            setError("Connection interrupted. You can retry to confirm revocation.");
        } finally {
            setBusy(false);
        }
    }

    if (!confirming) {
        return (
            <button
                type="button"
                className="min-h-11 rounded-md px-2 text-sm font-semibold text-rose-800 underline-offset-4 hover:underline focus-visible:outline-2"
                aria-label={`Revoke pass for ${guest.guestName}`}
                onClick={() => setConfirming(true)}
            >
                Revoke pass
            </button>
        );
    }

    return (
        <div className="min-w-44 max-w-xs space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm font-semibold text-slate-950">
                Revoke the pass for {guest.guestName}?
            </p>
            <p className="break-all text-xs text-slate-700">{guest.guestEmail}</p>
            <p className="text-sm text-slate-700">
                This invitation link and QR code will stop working.
            </p>

            {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={busy}
                    className={styles.secondary}
                    onClick={() => {
                        setError("");
                        setConfirming(false);
                    }}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={revoke}
                    className="min-h-11 rounded-xl bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                >
                    {busy ? "Revoking…" : "Confirm revocation"}
                </button>
            </div>
        </div>
    );
}