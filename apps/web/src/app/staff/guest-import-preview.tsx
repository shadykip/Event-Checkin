"use client";

import { useState, type FormEvent } from "react";
import styles from "./staff-styles";

type Status = "ready" | "invalid" | "duplicate" | "existing";

type Preview = {
    summary: Record<Status, number>;
    rows: {
        record: number;
        guestName: string;
        guestEmail: string;
        status: Status;
        message: string;
    }[];
};

export default function GuestImportPreview({ slug }: { slug: string }) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!file || busy) return;

        setPreview(null);
        setError("");

        if (file.size > 32 * 1024) {
            setError("Choose a CSV file of 32 KiB or less.");
            return;
        }

        setBusy(true);
        try {
            const csv = await file.text();
            const response = await fetch(
                `/api/staff/events/${encodeURIComponent(slug)}/invitations/preview`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ csv }),
                    cache: "no-store",
                },
            );

            if (!response.ok) {
                const detail = await response.json().catch(() => null);
                const fallback = response.status === 401
                    ? "Your session expired. Sign in again."
                    : "Could not preview this file. Please try again.";
                throw new Error(
                    typeof detail?.message === "string" ? detail.message : fallback,
                );
            }

            const data: Preview = await response.json();
            setPreview(data);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not preview the CSV.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <details className="border-t border-slate-200 px-5 py-5 sm:px-7">
            <summary className="cursor-pointer font-semibold text-teal-800">
                Preview guest CSV
            </summary>

            <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
                <label className={styles.label}>
                    Guest CSV
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        required
                        disabled={busy}
                        className={styles.input}
                        onChange={(event) => {
                            setFile(event.target.files?.[0] ?? null);
                            setPreview(null);
                            setError("");
                        }}
                    />
                    <span className="text-sm font-normal text-slate-600">
                        Columns: guestName, guestEmail. Up to 200 guests, 32 KiB.
                    </span>
                </label>
                <button type="submit" className={styles.secondary} disabled={!file || busy}>
                    {busy ? "Checking guests…" : "Preview file"}
                </button>
            </form>

            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

            {preview && (
                <div className="mt-5 space-y-3">
                    <p role="status" className="text-sm font-medium text-slate-800">
                        Ready: {preview.summary.ready} · Invalid: {preview.summary.invalid}
                        {" · "}Duplicates in file: {preview.summary.duplicate}
                        {" · "}Already invited: {preview.summary.existing}
                    </p>
                    <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-sm">
                            <caption className="sr-only">Guest import preview</caption>
                            <thead className="sticky top-0 bg-slate-50">
                                <tr>
                                    {["Record", "Guest", "Email", "Result"].map((heading) => (
                                        <th key={heading} scope="col" className="px-3 py-2">
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.rows.map((row) => (
                                    <tr key={row.record} className="border-t border-slate-200">
                                        <td className="px-3 py-2">{row.record}</td>
                                        <td className="px-3 py-2">{row.guestName || "—"}</td>
                                        <td className="px-3 py-2">{row.guestEmail || "—"}</td>
                                        <td className="px-3 py-2">{row.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </details>
    );
}