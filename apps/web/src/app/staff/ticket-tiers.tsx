"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./staff-styles";

type Tier = {
    id: string;
    name: string;
    priceMinor: number;
    currency: string;
    capacity: number;
    peoplePerTicket: number;
    salesStartAt: string | null;
    salesEndAt: string | null;
    archived: boolean;
    version: number;
    sold: number;
    reserved: number;
    available: number;
    grossMinor: string;
    admitted: number;
    admissionsRemaining: number;
};

const money = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
});

function localInput(value?: string | null) {
    if (!value) return "";
    return new Date(Date.parse(value) + 3 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16);
}

export default function TicketTiers({ slug }: { slug: string }) {
    const endpoint = `/api/staff/events/${encodeURIComponent(slug)}/ticket-tiers`;
    const [tiers, setTiers] = useState<Tier[]>([]);
    const [editing, setEditing] = useState<Tier | "new" | null>(null);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [reload, setReload] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            try {
                const response = await fetch(endpoint, {
                    cache: "no-store",
                    signal: controller.signal,
                });

                if (!response.ok) throw new Error();

                const rows: Tier[] = await response.json();
                if (!controller.signal.aborted) {
                    setTiers(rows);
                    setReady(true);
                }
            } catch {
                if (!controller.signal.aborted) setError("Could not load ticket tiers.");
            }
        }

        void load();
        return () => controller.abort();
    }, [endpoint, reload]);

    const tier = editing && editing !== "new" ? editing : null;

    function open(value: Tier | "new") {
        setEditing(value);
        setError("");
        setMessage("");
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || !editing) return;

        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch(tier ? `${endpoint}/${tier.id}` : endpoint, {
                method: tier ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.get("name"),
                    priceKes: form.get("priceKes"),
                    capacity: Number(form.get("capacity")),
                    peoplePerTicket: Number(form.get("peoplePerTicket")),
                    salesStartAt: form.get("salesStartAt"),
                    salesEndAt: form.get("salesEndAt"),
                    archived: form.get("archived") === "on",
                    version: tier?.version,
                }),
            });

            const body = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    typeof body?.message === "string" ? body.message : "Could not save this tier.",
                );
            }

            setTiers(body as Tier[]);
            setEditing(null);
            setMessage("Ticket tier saved.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not confirm the change.");
        } finally {
            setBusy(false);
        }
    }

    function refresh() {
        setEditing(null);
        setReady(false);
        setError("");
        setMessage("");
        setReload((current) => current + 1);
    }

    const totals = tiers.reduce(
        (sum, tier) => {
            sum.sold += tier.sold;
            sum.reserved += tier.reserved;
            sum.available += tier.available;
            sum.grossMinor += Number(tier.grossMinor);
            sum.admitted += tier.admitted;
            sum.admissionsRemaining += tier.admissionsRemaining;
            return sum;
        },
        {
            sold: 0,
            reserved: 0,
            available: 0,
            grossMinor: 0,
            admitted: 0,
            admissionsRemaining: 0,
        },
    );

    const summaryMetrics = [
        ["Tickets sold", totals.sold.toLocaleString("en-KE")],
        ["Gross sales", money.format(totals.grossMinor / 100)],
        ["Available to buy", totals.available.toLocaleString("en-KE")],
        ["Active reservations", totals.reserved.toLocaleString("en-KE")],
        ["People admitted", totals.admitted.toLocaleString("en-KE")],
        ["Admissions remaining on passes", totals.admissionsRemaining.toLocaleString("en-KE")],
    ] as const;

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h3 className={styles.sectionTitle}>Ticket tiers</h3>
                <button
                    type="button"
                    className={styles.primary}
                    disabled={!ready || busy || editing !== null}
                    onClick={() => open("new")}
                >
                    Add ticket tier
                </button>
                <a
                    href={`/api/staff/events/${encodeURIComponent(slug)}/ticket-sales/export`}
                    className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-teal-600 hover:text-teal-800"
                >
                    Download sales CSV
                </a>
                {ready && (
                    <button
                        type="button"
                        className={styles.textButton}
                        onClick={refresh}
                        disabled={busy || editing !== null}
                    >
                        Refresh ticket statistics
                    </button>
                )}
            </header>

            {!ready && !error && <p role="status" className="mt-4">Loading ticket tiers…</p>}

            {ready && tiers.length === 0 && !editing && (
                <p className="mt-4 text-sm text-slate-600">
                    Add your first tier, such as Early Bird or VIP.
                </p>
            )}

            {ready && tiers.length > 0 && (
                <section
                    aria-labelledby={`ticket-sales-summary-${slug}`}
                    className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                >
                    <h4
                        id={`ticket-sales-summary-${slug}`}
                        className="text-lg font-semibold tracking-tight text-slate-950"
                    >
                        Paid ticket overview
                    </h4>

                    <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
                        {summaryMetrics.map(([label, value]) => (
                            <div
                                key={label}
                                className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4"
                            >
                                <dt className="text-sm leading-5 text-slate-600">
                                    {label}
                                </dt>
                                <dd className="mt-2 break-words text-xl font-semibold tracking-tight text-slate-950 tabular-nums sm:text-2xl">
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            )}

            {ready && tiers.length > 0 && (
                <ul className="mt-5 grid gap-4">
                    {tiers.map((item) => {
                        const metrics = [
                            ["Tickets sold", item.sold.toLocaleString("en-KE")],
                            ["Active reservations", item.reserved.toLocaleString("en-KE")],
                            ["Available to buy", item.available.toLocaleString("en-KE")],
                            ["Gross sales", money.format(Number(item.grossMinor) / 100)],
                            ["People admitted", item.admitted.toLocaleString("en-KE")],
                            [
                                "Admissions remaining on passes",
                                item.admissionsRemaining.toLocaleString("en-KE"),
                            ],
                        ] as const;

                        return (
                            <li
                                key={item.id}
                                className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h4 className="break-words font-semibold text-slate-950">
                                            {item.name}
                                        </h4>
                                        <p className="mt-1 text-sm leading-6 text-slate-600">
                                            {money.format(item.priceMinor / 100)}
                                            {" · "}{item.capacity.toLocaleString("en-KE")} tickets
                                            {" · "}{item.peoplePerTicket}{" "}
                                            {item.peoplePerTicket === 1 ? "person" : "people"} per ticket
                                            {item.archived && " · Archived"}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        className={styles.secondary}
                                        disabled={busy || editing !== null}
                                        onClick={() => open(item)}
                                    >
                                        Edit<span className="sr-only"> {item.name}</span>
                                    </button>
                                </div>

                                <dl className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                                    {metrics.map(([label, value]) => (
                                        <div key={label} className="rounded-lg bg-slate-50 px-3 py-3">
                                            <dt className="text-xs font-medium leading-5 text-slate-600">
                                                {label}
                                            </dt>
                                            <dd className="mt-1 break-words text-lg font-semibold tabular-nums text-slate-950">
                                                {value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </li>
                        );
                    })}
                </ul>
            )}

            {editing && (
                <form
                    key={tier?.id ?? "new"}
                    onSubmit={save}
                    className="mt-5 grid gap-4 rounded-xl border border-slate-200 p-4"
                >
                    <label className={styles.label}>
                        Ticket name
                        <input className={styles.input} name="name" defaultValue={tier?.name}
                            maxLength={80} placeholder="Early Bird" required />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className={styles.label}>
                            Price per ticket (KES)
                            <input className={styles.input} name="priceKes" inputMode="decimal"
                                defaultValue={tier ? (tier.priceMinor / 100).toFixed(2) : ""}
                                placeholder="500.00" required />
                        </label>

                        <label className={styles.label}>
                            People per ticket
                            <input
                                className={styles.input}
                                name="peoplePerTicket"
                                type="number"
                                min="1"
                                max="2147483647"
                                step="1"
                                defaultValue={tier?.peoplePerTicket ?? 1}
                                required
                            />
                        </label>

                        <label className={styles.label}>
                            Ticket quantity
                            <input className={styles.input} name="capacity" type="number"
                                min="1" max="100000" step="1" defaultValue={tier?.capacity} required />
                        </label>

                        <label className={styles.label}>
                            Sales open · Nairobi time
                            <input className={styles.input} name="salesStartAt" type="datetime-local"
                                defaultValue={localInput(tier?.salesStartAt)} />
                        </label>

                        <label className={styles.label}>
                            Sales close · Nairobi time
                            <input className={styles.input} name="salesEndAt" type="datetime-local"
                                defaultValue={localInput(tier?.salesEndAt)} />
                        </label>
                    </div>

                    {tier && (
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <input type="checkbox" name="archived" defaultChecked={tier.archived} />
                            Archive this tier
                        </label>
                    )}

                    <div className="flex gap-2">
                        <button className={styles.primary} disabled={busy}>
                            {busy ? "Saving…" : "Save tier"}
                        </button>
                        <button type="button" className={styles.secondary} disabled={busy}
                            onClick={() => setEditing(null)}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {message && <p role="status" className="mt-3 text-sm text-teal-800">{message}</p>}

            {error && (
                <div className="mt-3">
                    <p role="alert" className="text-sm text-red-700">{error}</p>
                    <button type="button" className={styles.textButton} disabled={busy} onClick={refresh}>
                        Reload ticket tiers
                    </button>
                </div>
            )}
        </section>
    );
}