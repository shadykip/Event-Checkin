"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./staff-styles";
import EmailPassButton from "./email-pass-button";

type IssuedInvitation = {
    guestName: string;
    guestEmail: string;
    url: string;
};

type Props = {
    slug: string;
    onIssued: () => void;
};

export default function InviteGuestForm({ slug, onIssued }: Props) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [issued, setIssued] = useState<IssuedInvitation | null>(null);
    const [copyStatus, setCopyStatus] = useState("");
    const [emailState, setEmailState] = useState<"idle" | "sending" | "sent">("idle");
    const linkInput = useRef<HTMLInputElement>(null);

    function close() {
        setOpen(false);
        setIssued(null);
        setError("");
        setCopyStatus("");
        setEmailState("idle");
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;

        const form = new FormData(event.currentTarget);
        const guestName = String(form.get("guestName") ?? "").trim();
        const guestEmail = String(form.get("guestEmail") ?? "").trim();

        if (!guestName) {
            setError("Enter the guest’s name.");
            return;
        }

        setBusy(true);
        setError("");

        try {
            const response = await fetch(
                `/api/staff/events/${encodeURIComponent(slug)}/invitations`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ guestName, guestEmail }),
                    cache: "no-store",
                },
            );

            if (!response.ok) {
                const messages: Record<number, string> = {
                    400: "Check the guest’s name and email address.",
                    401: "Your session expired. Sign in again.",
                    403: "You need organizer access to invite guests to this event.",
                    409: "This email already has an invitation for this event.",
                };

                setError(messages[response.status] ?? "Could not confirm invitation creation.");
                return;
            }

            const data: {
                guestName: string;
                guestEmail: string;
                passPath: string;
            } = await response.json();

            setIssued({
                guestName: data.guestName,
                guestEmail: data.guestEmail,
                url: new URL(data.passPath, window.location.origin).href,
            });
            onIssued()
        } catch {
            setError(
                "Connection interrupted. The invitation may already have been created. " +
                "If a retry reports a duplicate, the first request succeeded.",
            );
        } finally {
            setBusy(false);
        }
    }


    async function copyLink() {
        if (!issued) return;

        try {
            await navigator.clipboard.writeText(issued.url);
            setCopyStatus("Invitation link copied.");
        } catch {
            linkInput.current?.focus();
            linkInput.current?.select();
            setCopyStatus("Link selected. Use your device’s Copy command.");
        }
    }



    return (
        <section className="border-t border-slate-200 px-5 py-5 sm:px-7">
            {!open ? (
                <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => setOpen(true)}
                >
                    Invite guest
                </button>
            ) : issued ? (
                <div className="max-w-xl space-y-3">
                    <h3 className={styles.sectionTitle}>Invitation ready</h3>

                    <p className={styles.muted}>
                        Email the invitation to <strong>{issued.guestEmail}</strong>,
                        or copy the private link before closing this panel.
                    </p>

                    <label className={styles.label}>
                        Invitation link
                        <input
                            ref={linkInput}
                            className={styles.input}
                            value={issued.url}
                            readOnly
                            onFocus={(event) => event.currentTarget.select()}
                        />
                    </label>

                    <div className="flex flex-wrap gap-3">
                        <EmailPassButton
                            key={issued.url}
                            slug={slug}
                            passUrl={issued.url}
                            guestEmail={issued.guestEmail}
                            label="Email invitation"
                        />
                        <button
                            type="button"
                            className={styles.secondary}
                            onClick={copyLink}
                        >
                            Copy invitation link
                        </button>

                        <button
                            type="button"
                            className={styles.secondary}
                            onClick={close}
                        >
                            Done
                        </button>
                    </div>

                    <div role="status" aria-live="polite" className={styles.muted}>

                        {copyStatus && <p>{copyStatus}</p>}
                    </div>
                    <p role="status" className={styles.muted}>{copyStatus}</p>
                </div>
            ) : (
                <form onSubmit={submit} className={`${styles.stack} max-w-xl`}>
                    <h3 className={styles.sectionTitle}>Invite a guest</h3>

                    <label className={styles.label}>
                        Guest name
                        <input
                            name="guestName"
                            className={styles.input}
                            maxLength={200}
                            required
                            autoFocus
                        />
                    </label>

                    <label className={styles.label}>
                        Guest email
                        <input
                            name="guestEmail"
                            type="email"
                            className={styles.input}
                            maxLength={254}
                            required
                        />
                    </label>

                    {error && (
                        <p role="alert" className={`${styles.feedback} ${styles.error}`}>
                            {error}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-3">
                        <button type="submit" className={styles.primary} disabled={busy}>
                            {busy ? "Creating invitation…" : "Create invitation"}
                        </button>
                        <button
                            type="button"
                            className={styles.secondary}
                            disabled={busy}
                            onClick={close}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </section>
    );
}