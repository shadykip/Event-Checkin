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

    const linkInput = useRef<HTMLInputElement>(null);

    function close() {
        setOpen(false);
        setIssued(null);
        setError("");
        setCopyStatus("");

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
        <section className="border-t border-slate-200 px-4 py-5 sm:px-6">
            {!open ? (
                <button
                    type="button"
                    className={styles.primary}
                    onClick={() => setOpen(true)}
                >
                    Invite guest
                </button>
            ) : issued ? (
                <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 sm:p-5">
                    <h4 className="text-lg font-semibold tracking-tight text-slate-950">
                        Invitation ready for {issued.guestName}
                    </h4>
                    <p className="mt-1 break-words text-sm text-slate-600">
                        Email the pass to {issued.guestEmail}, or copy the private link before closing.
                    </p>

                    <label className={`${styles.label} mt-4`}>
                        Private invitation link
                        <input
                            ref={linkInput}
                            className={styles.input}
                            value={issued.url}
                            readOnly
                            onFocus={(event) => event.currentTarget.select()}
                        />
                    </label>

                    <div className="mt-4 flex flex-wrap items-start gap-2">
                        <EmailPassButton
                            key={issued.url}
                            slug={slug}
                            passUrl={issued.url}
                            guestEmail={issued.guestEmail}
                            label="Email invitation"
                        />
                        <button type="button" className={styles.secondary} onClick={copyLink}>
                            Copy link
                        </button>
                        <button type="button" className={styles.textButton} onClick={close}>
                            Done
                        </button>
                    </div>

                    <p role="status" className={styles.muted}>{copyStatus}</p>
                </div>
            ) : (
                <form
                    onSubmit={submit}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                >
                    <h4 className="text-lg font-semibold tracking-tight text-slate-950">
                        Invite a guest
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                        Create a private pass, then choose how to share it.
                    </p>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className={styles.label}>
                            Guest name
                            <input
                                name="guestName"
                                className={styles.input}
                                maxLength={200}
                                required
                                autoFocus
                                disabled={busy}
                            />
                        </label>
                        <label className={styles.label}>
                            Email address
                            <input
                                name="guestEmail"
                                type="email"
                                className={styles.input}
                                maxLength={254}
                                required
                                disabled={busy}
                            />
                        </label>
                    </div>

                    {error && (
                        <p role="alert" className={`${styles.feedback} ${styles.error} mt-4`}>
                            {error}
                        </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
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