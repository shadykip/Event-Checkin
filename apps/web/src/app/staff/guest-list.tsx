"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./staff-styles";
import RevokePassButton from "./revoke-pass-button";
import ReplacePassButton from "./replace-pass-button";
import ResendPaidPassButton from "./resend-paid-pass-button";


type GuestStatus = "expected" | "checked_in" | "revoked";

type GuestRsvpStatus = "PENDING" | "ACCEPTED" | "DECLINED";

type Guest = {
    id: string;
    guestName: string;
    guestEmail: string;
    checkedInAt: string | null;
    status: GuestStatus;
    rsvpStatus: GuestRsvpStatus;
    isPaidTicket: boolean
};

type GuestPage = {
    items: Guest[];
    page: number;
    pageSize: number;
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
    const [open, setOpen] = useState(true);
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

    const data = current?.data;
    const firstGuest = data && data.items.length > 0
        ? (data.page - 1) * data.pageSize + 1
        : 0;
    const lastGuest = data && firstGuest > 0
        ? firstGuest + data.items.length - 1
        : 0;

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
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-xl font-semibold tracking-tight text-slate-950">
                    Guest directory
                </h4>
                <button
                    type="button"
                    className={styles.textButton}
                    aria-expanded={open}
                    onClick={() => {
                        if (!open) setRetry((value) => value + 1);
                        setOpen(!open);
                    }}
                >
                    {open ? "Hide directory" : "View guest directory"}
                </button>
            </div>
            {/* <button
                type="button"
                className={styles.secondary}
                aria-expanded={open}
                onClick={() => {
                    if (!open) setRetry((value) => value + 1);
                    setOpen(!open);
                }}
            >
                {open ? "Hide guest list" : "View guest list"}
            </button> */}

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
                    <form
                        onSubmit={search}
                        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
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

                    {data && (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            {data.items.length === 0 ? (
                                <div role="status" className="px-5 py-8 text-center">
                                    <p className="font-semibold text-slate-900">
                                        {query || rsvp
                                            ? "No guests match your filters"
                                            : page > 1
                                                ? "No guests on this page"
                                                : "Your guest directory is empty"}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {query || rsvp
                                            ? "Change the search or clear the filters to see more guests."
                                            : page > 1
                                                ? "Go back one page to see earlier results."
                                                : "Invite a guest or import a CSV to start your roster."}
                                    </p>
                                </div>
                            ) : (
                                <div
                                    className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-teal-700"
                                    role="region"
                                    aria-label="Guest directory table"
                                    tabIndex={0}
                                >
                                    <table className="w-full min-w-[44rem] text-left text-sm">
                                        <caption className="sr-only">Guests matching the current filters</caption>
                                        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                                            <tr>
                                                <th scope="col" className="px-4 py-3">Guest</th>
                                                <th scope="col" className="px-3 py-3">RSVP</th>
                                                <th scope="col" className="px-3 py-3">Admission</th>
                                                <th scope="col" className="px-3 py-3">Check-in · Nairobi time</th>
                                                <th scope="col" className="px-4 py-3">Actions</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {data.items.map((guest) => (
                                                <tr
                                                    key={guest.id}
                                                    className="align-top hover:bg-slate-50/70 focus-within:bg-slate-50/70"
                                                >
                                                    <th scope="row" className="px-4 py-4 font-normal">
                                                        <span className="block break-words font-semibold text-slate-950">
                                                            {guest.guestName}
                                                        </span>
                                                        <span className="mt-0.5 block break-all text-xs leading-5 text-slate-600">
                                                            {guest.guestEmail}
                                                        </span>
                                                    </th>

                                                    <td className="px-3 py-4">
                                                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${rsvpStyles[guest.rsvpStatus]}`}>
                                                            {rsvpLabels[guest.rsvpStatus]}
                                                        </span>
                                                    </td>

                                                    <td className="px-3 py-4">
                                                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[guest.status]}`}>
                                                            {statusLabels[guest.status]}
                                                        </span>
                                                    </td>

                                                    <td className="px-3 py-4 text-slate-600">
                                                        {guest.checkedInAt ? (
                                                            <time dateTime={guest.checkedInAt}>
                                                                {admissionTime.format(new Date(guest.checkedInAt))}
                                                            </time>
                                                        ) : (
                                                            <span aria-label="No check-in recorded">—</span>
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-2">
                                                        {guest.status === "expected" ? (
                                                            <details>
                                                                <summary className="w-fit cursor-pointer rounded-md py-2.5 text-sm font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-700">
                                                                    Manage
                                                                    <span className="sr-only"> pass for {guest.guestName}</span>
                                                                </summary>
                                                                <div className="grid gap-1 pb-2">
                                                                    {guest.isPaidTicket && (
                                                                        <ResendPaidPassButton slug={slug} guest={guest} />
                                                                    )}
                                                                    <ReplacePassButton slug={slug} guest={guest} />
                                                                    <RevokePassButton
                                                                        slug={slug}
                                                                        guest={guest}
                                                                        onRevoked={(guestName) => {
                                                                            setNotice(`Pass revoked for ${guestName}.`);
                                                                            onRevoked();
                                                                        }}
                                                                    />
                                                                </div>
                                                            </details>
                                                        ) : (
                                                            <span className="inline-block py-2.5 text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <nav
                                aria-label="Guest directory pagination"
                                className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3"
                            >
                                <p role="status" className="text-sm text-slate-600">
                                    {firstGuest > 0
                                        ? `Showing guests ${firstGuest}–${lastGuest}`
                                        : "Showing 0 guests"}
                                    <span className="ml-2 text-xs">({data.pageSize} per page)</span>
                                </p>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className={styles.secondary}
                                        disabled={page <= 1}
                                        onClick={() => setPage(page - 1)}
                                    >
                                        Previous
                                    </button>
                                    <span className="px-1 text-sm font-semibold tabular-nums text-slate-800">
                                        Page {data.page}
                                    </span>
                                    <button
                                        type="button"
                                        className={styles.secondary}
                                        disabled={!data.hasNextPage}
                                        onClick={() => setPage(page + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </nav>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}