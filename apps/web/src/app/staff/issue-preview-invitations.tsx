"use client";

import { useRef, useState } from "react";
import styles from "./staff-styles";
import EmailIssuedPasses from "./email-issued-passes";

type Guest = {
    record: number;
    guestName: string;
    guestEmail: string;
    status: "ready" | "invalid" | "duplicate" | "existing";
};

type IssuedPass = {
    record: number;
    guestName: string;
    guestEmail: string;
    url: string;
};

type Props = {
    slug: string;
    rows: Guest[];
    onIssued: () => void;
    onBusyChange: (busy: boolean) => void;
};

export default function IssuePreviewInvitations({
    slug,
    rows,
    onIssued,
    onBusyChange,
}: Props) {
    const running = useRef(false);
    const [busy, setBusy] = useState(false);
    const [emailBusy, setEmailBusy] = useState(false);
    const [passes, setPasses] = useState<IssuedPass[]>([]);
    const [existing, setExisting] = useState<number[]>([]);
    const [error, setError] = useState("");
    const [copyMessage, setCopyMessage] = useState("");

    const completed = new Set([
        ...passes.map((pass) => pass.record),
        ...existing,
    ]);
    const remaining = rows.filter(
        (guest) => guest.status === "ready" && !completed.has(guest.record),
    );

    async function issue() {
        if (running.current || emailBusy || remaining.length === 0) return;

        running.current = true;
        setBusy(true);
        onBusyChange(true);
        setError("");
        setCopyMessage("");

        let rosterChanged = false;

        try {
            for (const guest of remaining) {
                const response = await fetch(
                    `/api/staff/events/${encodeURIComponent(slug)}/invitations`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            guestName: guest.guestName,
                            guestEmail: guest.guestEmail,
                        }),
                        cache: "no-store",
                    },
                );

                if (response.status === 409) {
                    setExisting((previous) => [...previous, guest.record]);
                    rosterChanged = true;
                    continue;
                }

                if (!response.ok) {
                    const detail = await response.json().catch(() => null);
                    const message = typeof detail?.message === "string"
                        ? detail.message
                        : "Could not confirm issuance.";
                    throw new Error(`Record ${guest.record}: ${message}`);
                }

                const issued: { passPath: string } = await response.json();
                if (
                    typeof issued.passPath !== "string" ||
                    !/^\/pass#[A-Za-z0-9_-]{43}$/.test(issued.passPath)
                ) {
                    throw new Error(
                        `Record ${guest.record}: the server returned an unexpected pass link. Check the roster.`,
                    );
                }

                const pass = {
                    record: guest.record,
                    guestName: guest.guestName,
                    guestEmail: guest.guestEmail,
                    url: new URL(issued.passPath, window.location.origin).href,
                };
                setPasses((previous) => [...previous, pass]);
                rosterChanged = true;
            }
        } catch (cause) {
            setError(
                cause instanceof TypeError
                    ? "Connection interrupted. Check the roster before retrying the remaining guests."
                    : cause instanceof Error
                        ? cause.message
                        : "Issuance stopped. Check the roster before retrying.",
            );
        } finally {
            running.current = false;
            setBusy(false);
            onBusyChange(false);
            if (rosterChanged) onIssued();
        }
    }

    async function copy(pass: IssuedPass) {
        try {
            await navigator.clipboard.writeText(pass.url);
            setCopyMessage(`Copied the invitation link for ${pass.guestName}.`);
        } catch {
            setCopyMessage("Select the invitation link and copy it manually.");
        }
    }

    if (!rows.some((guest) => guest.status === "ready")) return null;

    return (
        <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-950">Issue invitations</h3>

            {remaining.length > 0 && (
                <>
                    <p className="text-sm text-slate-600">
                        Create passes for the guests marked ready. Copy their private
                        links before leaving this page or starting another preview.
                    </p>
                    <button
                        type="button"
                        className={styles.primary}
                        onClick={issue}
                        disabled={busy || emailBusy}
                    >
                        {busy
                            ? "Issuing invitations…"
                            : `Issue ${remaining.length} invitation${remaining.length === 1 ? "" : "s"}`}
                    </button>
                </>
            )}

            {(passes.length > 0 || existing.length > 0) && (
                <p role="status" className="text-sm font-medium text-slate-800">
                    Issued: {passes.length} · Already invited since preview: {existing.length}
                    {" · "}Remaining: {remaining.length}
                </p>
            )}

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

            {passes.length > 0 && (
                <ul className="space-y-3">
                    {passes.map((pass) => (
                        <li key={pass.record} className="rounded-lg bg-slate-50 p-3">
                            <label className={styles.label}>
                                Private link for {pass.guestName} · {pass.guestEmail}
                                <input
                                    className={styles.input}
                                    value={pass.url}
                                    readOnly
                                    onFocus={(event) => event.currentTarget.select()}
                                />
                            </label>
                            <button
                                type="button"
                                className={styles.textButton}
                                onClick={() => copy(pass)}
                            >
                                Copy invitation link
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <EmailIssuedPasses
                slug={slug}
                passes={passes}
                disabled={busy}
                onBusyChange={(sending) => {
                    setEmailBusy(sending);
                    onBusyChange(sending);
                }}
            />
            {copyMessage && <p role="status" className="text-sm">{copyMessage}</p>}
        </section>
    );
}
