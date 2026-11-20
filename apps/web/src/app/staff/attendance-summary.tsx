"use client";

import { useEffect, useState } from "react";
import styles from "./staff-styles";

type Totals = { checkedIn: number; expected: number };

export default function AttendanceSummary({ slug }: { slug: string }) {
    const [totals, setTotals] = useState<Totals | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [request, setRequest] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            try {
                const response = await fetch(
                    `/api/staff/events/${encodeURIComponent(slug)}/attendance`,
                    { cache: "no-store", signal: controller.signal },
                );

                if (response.status === 401) throw new Error("Session expired. Sign in again.");
                if (response.status === 403) throw new Error("Event access has changed.");
                if (!response.ok) throw new Error("Could not load attendance.");

                const data: Totals = await response.json();
                if (!controller.signal.aborted) {
                    setTotals(data);
                    setError("");
                }
            } catch (failure) {
                if (!controller.signal.aborted) {
                    setTotals(null);
                    setError(
                        failure instanceof TypeError
                            ? "Could not reach the event service."
                            : failure instanceof Error ? failure.message : "Attendance unavailable.",
                    );
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void load();
        return () => controller.abort();
    }, [slug, request]);

    return (
        <section className={`${styles.panel} ${styles.attendance}`}>
            <h3 className={styles.sectionTitle}>Attendance</h3>

            <div aria-live="polite" aria-busy={loading}>
                {totals && (
                    <dl className={styles.metrics}>
                        <div><dt>Checked in</dt><dd>{totals.checkedIn}</dd></div>
                        <div><dt>Still expected</dt><dd>{totals.expected}</dd></div>
                    </dl>
                )}
                {!totals && loading && <p className={styles.muted}>Loading totals…</p>}
                {error && <p className={styles.muted}>{error}</p>}
            </div>

            <button
                type="button"
                className={styles.textButton}
                disabled={loading}
                onClick={() => {
                    setLoading(true);
                    setError("");
                    setRequest((current) => current + 1);
                }}
            >
                {loading ? "Refreshing…" : "Refresh totals"}
            </button>
        </section>
    );
}