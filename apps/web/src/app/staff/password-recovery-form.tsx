"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "./staff-styles";

type Props = {
    mode: "request" | "reset";
};

export default function PasswordRecoveryForm({ mode }: Props) {
    const requesting = mode === "request";
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || done) return;

        const form = new FormData(event.currentTarget);
        setError("");

        let payload: { email: string } | { token: string; password: string };

        if (requesting) {
            payload = { email: String(form.get("email") ?? "").trim() };
        } else {
            const token = window.location.hash.slice(1);
            const password = String(form.get("password") ?? "");

            if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
                setError("Open the complete link from your reset email, or request a new link.");
                return;
            }

            if (password !== form.get("confirmation")) {
                setError("The two passwords do not match.");
                return;
            }

            payload = { token, password };
        }

        setBusy(true);

        try {
            const action = requesting ? "forgot" : "reset";
            const response = await fetch(`/api/staff/password/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                cache: "no-store",
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                setError(
                    typeof body?.message === "string"
                        ? body.message
                        : "Could not complete the request. Please try again.",
                );
                return;
            }

            if (!requesting) {
                window.history.replaceState(null, "", window.location.pathname);
            }

            setDone(true);
        } catch {
            setError("Could not reach the staff service. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="grid min-h-dvh place-items-center bg-slate-100 px-4 py-10 text-slate-950">
            <section className={styles.loginCard}>
                <h1 className="text-2xl font-bold tracking-tight">
                    {requesting ? "Forgot your password?" : "Set a new password"}
                </h1>

                {done ? (
                    <p role="status" className={`${styles.feedback} ${styles.success} mt-5`}>
                        {requesting
                            ? "If an active account matches that email, a reset link will arrive shortly. Check your inbox."
                            : "Your password has been updated. Sign in with your new password."}
                    </p>
                ) : (
                    <form onSubmit={submit} className={styles.stack}>
                        {requesting ? (
                            <label className={styles.label}>
                                Staff email address
                                <input
                                    className={styles.input}
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    maxLength={254}
                                    required
                                />
                            </label>
                        ) : (
                            <>
                                <label className={styles.label}>
                                    New password
                                    <input
                                        className={styles.input}
                                        type="password"
                                        name="password"
                                        autoComplete="new-password"
                                        aria-describedby="password-help"
                                        minLength={15}
                                        maxLength={128}
                                        required
                                    />
                                    <span id="password-help" className="text-sm font-normal text-slate-600">
                                        Use 15 to 128 characters. A passphrase is fine.
                                    </span>
                                </label>

                                <label className={styles.label}>
                                    Confirm new password
                                    <input
                                        className={styles.input}
                                        type="password"
                                        name="confirmation"
                                        autoComplete="new-password"
                                        minLength={15}
                                        maxLength={128}
                                        required
                                    />
                                </label>
                            </>
                        )}

                        {error && (
                            <p role="alert" className={`${styles.feedback} ${styles.error}`}>
                                {error}
                            </p>
                        )}

                        <button type="submit" className={styles.primary} disabled={busy}>
                            {busy
                                ? "Submitting…"
                                : requesting
                                    ? "Send reset link"
                                    : "Save new password"}
                        </button>
                    </form>
                )}

                <div className="mt-4 flex flex-wrap gap-4">
                    <Link href="/staff/login" className={styles.textButton}>
                        Back to staff sign-in
                    </Link>
                    {!requesting && !done && (
                        <Link href="/staff/forgot-password" className={styles.textButton}>
                            Request a new link
                        </Link>
                    )}
                </div>
            </section>
        </main>
    );
}