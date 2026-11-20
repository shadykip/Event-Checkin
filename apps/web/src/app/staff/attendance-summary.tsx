"use client";

import { useState } from "react";

type Totals = {
    checkedIn: number;
    expected: number;
};

export default function AttendanceSummary({ slug }: { slug: string }) {
    const [totals, setTotals] = useState<Totals | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function refresh() {
        setLoading(true);
        setError("");

        try {
            const response = await fetch(
                `/api/staff/events/${encodeURIComponent(slug)}/attendance`,
                { cache: "no-store" },
            );

            if (response.status === 401) {
                throw new Error("Your session expired. Refresh the page to sign in.");
            }
            if (response.status === 403) {
                throw new Error("You are no longer assigned to this event.");
            }
            if (!response.ok) throw new Error("Could not load attendance. Try again.");

            const latest: Totals = await response.json();
            setTotals(latest);
        } catch (failure) {
            setTotals(null);
            setError(
                failure instanceof TypeError
                    ? "Could not reach the event service. Try again."
                    : failure instanceof Error
                        ? failure.message
                        : "Could not load attendance.",
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="mt-4 border-t border-stone-200 pt-3">
            <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="text-sm font-medium underline underline-offset-4 disabled:opacity-60"
            >
                {loading ? "Loading attendance…" : totals ? "Refresh attendance" : "View attendance"}
            </button>

            <div aria-live="polite">
                {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
                {totals && (
                    <dl className="mt-3 grid grid-cols-2 gap-4">
                        <div>
                            <dt className="text-sm text-stone-600">Checked in</dt>
                            <dd className="text-2xl font-semibold">{totals.checkedIn}</dd>
                        </div>
                        <div>
                            <dt className="text-sm text-stone-600">Expected</dt>
                            <dd className="text-2xl font-semibold">{totals.expected}</dd>
                        </div>
                    </dl>
                )}
            </div>
        </section>
    );
}