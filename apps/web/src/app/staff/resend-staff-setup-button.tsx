"use client";

import { useRef, useState } from "react";

export default function ResendStaffSetupButton({
    slug,
    staffId,
}: {
    slug: string;
    staffId: string;
}) {
    const inFlight = useRef(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function resend() {
        if (inFlight.current) return;

        inFlight.current = true;
        setBusy(true);
        setMessage("");
        setError("");

        try {
            const response = await fetch(
                `/api/staff/events/${encodeURIComponent(slug)}/team/${encodeURIComponent(staffId)}/resend-setup`,
                { method: "POST" },
            );

            const result = await response.json().catch(() => null);

            if (!response.ok) {
                const detail = result?.message;
                throw new Error(
                    Array.isArray(detail)
                        ? detail.join(", ")
                        : typeof detail === "string"
                            ? detail
                            : "Could not send the setup link.",
                );
            }

            setMessage(result?.message ?? "Setup link emailed.");
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : "Could not send the setup link.",
            );
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    }

    return (
        <div className="space-y-1">
            <button
                type="button"
                onClick={resend}
                disabled={busy}
                className="text-sm font-semibold text-teal-800 hover:underline disabled:opacity-50"
            >
                {busy ? "Sending…" : "Resend setup link"}
            </button>
            {message && <p role="status" className="text-xs text-teal-800">{message}</p>}
            {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        </div>
    );
}