"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./staff-styles";

type GuestStatus = "expected" | "checked_in" | "revoked";

type Guest = {
    id: string;
    guestName: string;
    guestEmail: string;
    checkedInAt: string | null;
    status: GuestStatus;
};

type GuestPage = {
    items: Guest[];
    page: number;
    hasNextPage: boolean;
};

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

const admissionTime = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
});

export default function GuestList({
    slug,
    version,
}: {
    slug: string;
    version: number;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);

    const [result, setResult] = useState<{
        key: string;
        data?: GuestPage;
        error?: string;
    } | null>(null);

    const requestKey = JSON.stringify([slug, query, page, version, retry]);
    const current = result?.key === requestKey ? result : null;

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();

        async function load() {
            const params = new URLSearchParams({ page: String(page) });
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
    }, [open, slug, query, page, requestKey]);

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
                    <form onSubmit={search} className="flex flex-wrap items-end gap-2">
                        <label className={`${styles.label} min-w-0 flex-1`}>
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
                        <button type="submit" className={styles.primary}>Search</button>
                        {query && (
                            <button
                                type="button"
                                className={styles.secondary}
                                onClick={() => {
                                    setDraft("");
                                    setQuery("");
                                    setPage(1);
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </form>

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
                                    {query ? "No guests match your search." : "No invitations on this page."}
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <caption className="sr-only">Event guest list</caption>
                                        <thead className="border-b border-slate-200 text-slate-600">
                                            <tr>
                                                <th scope="col" className="py-2 pr-4">Guest</th>
                                                <th scope="col" className="py-2 pr-4">Status</th>
                                                <th scope="col" className="py-2">Check-in · Nairobi time</th>
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