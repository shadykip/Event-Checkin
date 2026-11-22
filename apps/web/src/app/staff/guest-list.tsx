"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./staff-styles";
import RevokePassButton from "./revoke-pass-button";


type GuestStatus = "expected" | "checked_in" | "revoked";

type GuestRsvpStatus = "PENDING" | "ACCEPTED" | "DECLINED";

type Guest = {
    id: string;
    guestName: string;
    guestEmail: string;
    checkedInAt: string | null;
    status: GuestStatus;
    rsvpStatus: GuestRsvpStatus;
};

type GuestPage = {
    items: Guest[];
    page: number;
    hasNextPage: boolean;
    rsvpSummary: Record<GuestRsvpStatus, number>;
};

const summaryOrder: GuestRsvpStatus[] = ["ACCEPTED", "DECLINED", "PENDING"];

const statusLabels: Record<GuestStatus, string> = {
    expected: "Expected",
    checked_in: "Checked in",
    revoked: "Revoked",
};

const statusStyles: Record<GuestStatus, string> = {
    expected: "bg-slate-100 text-slate-700",
    checked_in: "bg-emerald-100 text-emerald-900",
    revoked: "bg-rose-100 text-rose-900",
};

const rsvpLabels: Record<GuestRsvpStatus, string> = {
    PENDING: "Awaiting response",
    ACCEPTED: "Going",
    DECLINED: "Can’t attend",
};

const rsvpStyles: Record<GuestRsvpStatus, string> = {
    PENDING: "bg-slate-100 text-slate-700",
    ACCEPTED: "bg-teal-50 text-teal-800",
    DECLINED: "bg-amber-50 text-amber-900",
};

const admissionTime = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
});

export default function GuestList({
    slug,
    version,
    onRevoked,
}: {
    slug: string;
    version: number;
    onRevoked: () => void;
}) {
    const [notice, setNotice] = useState("");
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [query, setQuery] = useState("");
    const [rsvp, setRsvp] = useState("");
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);

    const [result, setResult] = useState<{
        key: string;
        data?: GuestPage;
        error?: string;
    } | null>(null);

    const requestKey = JSON.stringify([slug, query, rsvp, page, version, retry]);
    const current = result?.key === requestKey ? result : null;
    const summary = result?.data?.rsvpSummary;

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();

        async function load() {
            const params = new URLSearchParams({ page: String(page) });
            if (rsvp) params.set("rsvp", rsvp);
            if (query) params.set("q", query);

            try {
                const response = await fetch(
                    `/api/staff/events/${encodeURIComponent(slug)}/invitations?${params}`,
                    { cache: "no-store", signal: controller.signal },
                );

                if (response.status === 401) throw new Error("Session expired. Sign in again.");
                if (response.status === 403) throw new Error("Organizer access is required.");
                if (!response.ok) throw new Error("Could not load the guest list.");

                const data: GuestPage = await response.json();
                if (!controller.signal.aborted) setResult({ key: requestKey, data });
            } catch (error) {
                if (!controller.signal.aborted) {
                    setResult({
                        key: requestKey,
                        error: error instanceof Error ? error.message : "Guest list unavailable.",
                    });
                }
            }
        }

        void load();
        return () => controller.abort();
    }, [open, slug, query, rsvp, page, requestKey]);

    const exportParams = new URLSearchParams({ format: "csv" });
    if (query) exportParams.set("q", query);
    if (rsvp) exportParams.set("rsvp", rsvp);

    const exportHref =
        `/api/staff/events/${encodeURIComponent(slug)}/invitations?${exportParams}`;

    function search(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPage(1);
        setQuery(draft.trim());
        setRetry((value) => value + 1);
    }

    return (
        <section className="border-t border-slate-200 px-5 py-5 sm:px-7">
            <button
                type="button"
                className={styles.secondary}
                aria-expanded={open}
                onClick={() => {
                    if (!open) setRetry((value) => value + 1);
                    setOpen(!open);
                }}
            >
                {open ? "Hide guest list" : "View guest list"}
            </button>

            {open && (
                <div className="mt-5 space-y-4">
                    {summary && (
                        <fieldset className="min-w-0">
                            <legend className="mb-2 text-sm font-semibold text-slate-800">
                                RSVP · Active invitations
                            </legend>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                {summaryOrder.map((status) => {
                                    const selected = rsvp === status;

                                    return (
                                        <button
                                            key={status}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => {
                                                setRsvp(status);
                                                setQuery(draft.trim());
                                                setPage(1);
                                            }}
                                            className={[
                                                "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left",
                                                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700",
                                                selected
                                                    ? "border-teal-700 bg-teal-50 text-teal-950"
                                                    : "border-slate-200 bg-white text-slate-800 hover:border-teal-500",
                                            ].join(" ")}
                                        >
                                            <span className="text-sm font-medium">
                                                {rsvpLabels[status]}
                                            </span>
                                            <span className="text-2xl font-semibold tabular-nums">
                                                {summary[status]}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>
                    )}
                    <form onSubmit={search} className="flex flex-wrap items-end gap-2">
                        <label className={`${styles.label} min-w-0 basis-full sm:flex-1`}>
                            Search guests
                            <input
                                type="search"
                                value={draft}
                                maxLength={200}
                                className={styles.input}
                                placeholder="Name or email address"
                                onChange={(event) => setDraft(event.target.value)}
                            />
                        </label>
                        <label className={styles.label}>
                            RSVP
                            <select className={styles.input} value={rsvp} onChange={(event) => {
                                setRsvp(event.target.value);
                                setQuery(draft.trim());
                                setPage(1);
                            }}>
                                <option value="">All responses</option>
                                <option value="ACCEPTED">Going</option>
                                <option value="DECLINED">Can’t attend</option>
                                <option value="PENDING">Awaiting response</option>
                            </select>
                        </label>
                        <button type="submit" className={styles.primary}>Search</button>
                        {(query || rsvp) && (
                            <button
                                type="button"
                                className={styles.secondary}
                                onClick={() => {
                                    setRsvp("");
                                    setDraft("");
                                    setQuery("");
                                    setPage(1);
                                }}
                            >
                                Clear
                            </button>
                        )}
                        <a
                            href={exportHref}
                            download
                            className={`${styles.secondary} inline-flex items-center justify-center`}
                        >
                            Download guest list
                        </a>
                    </form>

                    <p role="status" className="text-sm font-medium text-emerald-800">
                        {notice}
                    </p>

                    {!current && <p role="status" className={styles.muted}>Loading guests…</p>}

                    {current?.error && (
                        <div role="alert" className={`${styles.feedback} ${styles.error}`}>
                            <p>{current.error}</p>
                            <button
                                type="button"
                                className={styles.textButton}
                                onClick={() => setRetry((value) => value + 1)}
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {current?.data && (
                        <>
                            {current.data.items.length === 0 ? (
                                <p role="status" className={styles.muted}>
                                    {query || rsvp ? "No guests match your filters." : "No invitations on this page."}
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <caption className="sr-only">Event guest list</caption>
                                        <thead className="border-b border-slate-200 text-slate-600">
                                            <tr>
                                                <th scope="col" className="py-2 pr-4">Guest</th>
                                                <th scope="col" className="py-2 pr-4">RSVP</th>
                                                <th scope="col" className="py-2 pr-4">Admission</th>
                                                <th scope="col" className="py-2">Check-in · Nairobi time</th>
                                                <th scope="col" className="py-2 pl-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {current.data.items.map((guest) => (
                                                <tr key={guest.id}>
                                                    <td className="py-3 pr-4">
                                                        <div className="font-semibold">{guest.guestName}</div>
                                                        <div className="break-all text-slate-600">{guest.guestEmail}</div>
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        <span
                                                            className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${rsvpStyles[guest.rsvpStatus]}`}
                                                        >
                                                            {rsvpLabels[guest.rsvpStatus]}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        <span className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[guest.status]}`}>
                                                            {statusLabels[guest.status]}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-slate-600">
                                                        {guest.checkedInAt ? (
                                                            <time dateTime={guest.checkedInAt}>
                                                                {admissionTime.format(new Date(guest.checkedInAt))}
                                                            </time>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="py-3 pl-3 align-top">
                                                        {guest.status === "expected" && (
                                                            <RevokePassButton
                                                                slug={slug}
                                                                guest={guest}
                                                                onRevoked={(guestName) => {
                                                                    setNotice(`Pass revoked for ${guestName}.`);
                                                                    onRevoked();
                                                                }}
                                                            />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {(page > 1 || current.data.hasNextPage) && (
                                <nav aria-label="Guest list pages" className="flex items-center gap-3">
                                    <button type="button" className={styles.secondary}
                                        disabled={page === 1} onClick={() => setPage(page - 1)}>
                                        Previous
                                    </button>
                                    <span className="text-sm">Page {page}</span>
                                    <button type="button" className={styles.secondary}
                                        disabled={!current.data.hasNextPage} onClick={() => setPage(page + 1)}>
                                        Next
                                    </button>
                                </nav>
                            )}
                        </>
                    )}
                </div>
            )}
        </section>
    );
}