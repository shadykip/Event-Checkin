"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./staff-styles";

export default function TicketAllocation({ slug }: { slug: string }) {
    const endpoint = `/api/staff/events/${encodeURIComponent(slug)}/ticket-allocation`;
    const [capacity, setCapacity] = useState("");
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            try {
                const response = await fetch(endpoint, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error();
                const data: { capacity: number } = await response.json();

                if (!controller.signal.aborted) {
                    setCapacity(String(data.capacity));
                    setReady(true);
                }
            } catch {
                if (!controller.signal.aborted) {
                    setError("Could not load ticket settings. Refresh the workspace to retry.");
                }
            }
        }

        void load();
        return () => controller.abort();
    }, [endpoint]);

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || !ready) return;
        setBusy(true);
        setMessage("");
        setError("");

        try {
            const response = await fetch(endpoint, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ capacity: Number(capacity) }),
            });

            if (!response.ok) throw new Error();
            setMessage(
                Number(capacity) === 0
                    ? "Public registration closed."
                    : "Public ticket allocation saved.",
            );
        } catch {
            setError("Could not save ticket settings. Please retry.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h3 className={styles.sectionTitle}>Free public tickets</h3>
            <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
                <label className={styles.label}>
                    Public ticket allocation
                    <input
                        className={styles.input}
                        type="number"
                        min="0"
                        max="100000"
                        step="1"
                        required
                        value={capacity}
                        disabled={!ready || busy}
                        onChange={(event) => {
                            setCapacity(event.target.value);
                            setMessage("");
                        }}
                    />
                </label>
                <button className={styles.primary} disabled={!ready || busy}>
                    {busy ? "Saving…" : "Save allocation"}
                </button>
            </form>
            <p className="mt-2 text-sm text-slate-600">
                Set 0 to close registration. Previously issued passes stay valid.
            </p>
            {message && <p role="status" className="mt-3 text-sm text-teal-800">{message}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        </section>
    );
}