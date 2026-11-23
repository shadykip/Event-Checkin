"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./staff-styles";

type Tier = {
    id: string;
    name: string;
    priceMinor: number;
    currency: string;
    capacity: number;
    salesStartAt: string | null;
    salesEndAt: string | null;
    archived: boolean;
    version: number;
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
            </header>

            {!ready && !error && <p role="status" className="mt-4">Loading ticket tiers…</p>}

            {ready && tiers.length === 0 && !editing && (
                <p className="mt-4 text-sm text-slate-600">
                    Add your first tier, such as Early Bird or VIP.
                </p>
            )}

            {tiers.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-200">
                    {tiers.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <div>
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-sm text-slate-600">
                                    {money.format(item.priceMinor / 100)} · {item.capacity} tickets
                                    {item.archived ? " · Archived" : ""}
                                </p>
                            </div>

                            <button
                                type="button"
                                className={styles.secondary}
                                disabled={busy || editing !== null || !ready}
                                onClick={() => open(item)}
                            >
                                Edit<span className="sr-only"> {item.name}</span>
                            </button>
                        </li>
                    ))}
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
                            Price per guest (KES)
                            <input className={styles.input} name="priceKes" inputMode="decimal"
                                defaultValue={tier ? (tier.priceMinor / 100).toFixed(2) : ""}
                                placeholder="500.00" required />
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