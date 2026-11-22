"use client";

import { useState } from "react";
import styles from "./staff-styles";
import EmailPassButton from "./email-pass-button";

type Props = {
    slug: string;
    guest: { id: string; guestName: string; guestEmail: string };
};

export default function ReplacePassButton({ slug, guest }: Props) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [link, setLink] = useState("");
    const [error, setError] = useState("");
    const [copyMessage, setCopyMessage] = useState("");

    async function replace() {
        if (busy) return;

        setBusy(true);
        setError("");
        try {
            const response = await fetch(
                `/api/staff/events/${encodeURIComponent(slug)}/invitations/${encodeURIComponent(guest.id)}/replace-pass`,
                { method: "POST", cache: "no-store" },
            );

            if (!response.ok) {
                const detail = await response.json().catch(() => null);
                throw new Error(
                    typeof detail?.message === "string"
                        ? detail.message
                        : "Could not confirm replacement. Refresh the roster.",
                );
            }

            const result: { passPath: string } = await response.json();
            if (
                typeof result.passPath !== "string" ||
                !/^\/pass#[A-Za-z0-9_-]{43}$/.test(result.passPath)
            ) {
                throw new Error("The replacement link could not be read.");
            }

            setLink(new URL(result.passPath, window.location.origin).href);
            setConfirming(false);
        } catch (cause) {
            setError(
                cause instanceof TypeError
                    ? "Connection interrupted. The old pass may already have been replaced."
                    : cause instanceof Error
                        ? cause.message
                        : "Could not confirm replacement.",
            );
        } finally {
            setBusy(false);
        }
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(link);
            setCopyMessage("Replacement link copied.");
        } catch {
            setCopyMessage("Select the link and copy it manually.");
        }
    }

    if (link) {
        return (
            <div className="min-w-56 space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-3">
                <label className={styles.label}>
                    New private link for {guest.guestName}
                    <input
                        className={styles.input}
                        value={link}
                        readOnly
                        onFocus={(event) => event.currentTarget.select()}
                    />
                </label>
                <p className="text-xs text-slate-700">
                    Email the replacement to {guest.guestEmail}, or copy it before closing.
                </p>

                <EmailPassButton
                    key={link}
                    slug={slug}
                    passUrl={link}
                    guestEmail={guest.guestEmail}
                    label="Email replacement pass"
                />
                <div className="flex flex-wrap gap-3">
                    <button type="button" className={styles.textButton} onClick={copy}>
                        Copy link
                    </button>
                    <button
                        type="button"
                        className={styles.textButton}
                        onClick={() => {
                            setLink("");
                            setCopyMessage("");
                        }}
                    >
                        Done
                    </button>
                </div>
                {copyMessage && <p role="status">{copyMessage}</p>}
            </div>
        );
    }

    if (!confirming) {
        return (
            <button
                type="button"
                className={styles.textButton}
                onClick={() => setConfirming(true)}
            >
                Replace pass link
            </button>
        );
    }

    return (
        <div className="min-w-52 space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-sm">
                Replace the pass for <strong>{guest.guestName}</strong>?
                Their current link and QR code will stop working.
            </p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className={styles.primary}
                    onClick={replace}
                    disabled={busy}
                >
                    {busy ? "Replacing…" : "Replace link"}
                </button>
                <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => {
                        setConfirming(false);
                        setError("");
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
