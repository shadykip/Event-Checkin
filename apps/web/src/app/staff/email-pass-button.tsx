"use client";

import { useRef, useState } from "react";
import styles from "./staff-styles";

type Props = {
    slug: string;
    passUrl: string;
    guestEmail: string;
    label: string;
};

export default function EmailPassButton({
    slug,
    passUrl,
    guestEmail,
    label,
}: Props) {
    const inFlight = useRef(false);
    const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
    const [message, setMessage] = useState("");

    async function send() {
        if (inFlight.current || state === "sent") return;

        inFlight.current = true;
        setState("sending");
        setMessage("");

        try {
            const token = new URL(passUrl).hash.slice(1);
            const response = await fetch(
                `/api/staff/events/${encodeURIComponent(slug)}/invitations/email`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                    cache: "no-store",
                },
            );

            if (!response.ok) {
                const detail = await response.json().catch(() => null);
                throw new Error(
                    typeof detail?.message === "string"
                        ? detail.message
                        : "Email delivery could not be confirmed.",
                );
            }

            setState("sent");
            setMessage(`Email accepted for ${guestEmail}.`);
        } catch (cause) {
            setState("idle");
            setMessage(
                cause instanceof TypeError
                    ? "Connection interrupted. Check the inbox before retrying."
                    : cause instanceof Error
                        ? cause.message
                        : "Email delivery could not be confirmed.",
            );
        } finally {
            inFlight.current = false;
        }
    }

    return (
        <div className="space-y-2">
            <button
                type="button"
                className={styles.primary}
                onClick={send}
                disabled={state !== "idle"}
            >
                {state === "sending" ? "Sending…" : state === "sent" ? "Email sent" : label}
            </button>
            <p role="status" className="text-sm text-slate-700">
                {message}
            </p>
        </div>
    );
}
