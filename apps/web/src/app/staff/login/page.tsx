"use client";

import Link from "next/link";
import { useState, useEffect, type FormEvent } from "react";
import styles from "../staff-styles";


function getReturnPath() {
    const fallback = "/staff";
    const requested = new URLSearchParams(window.location.search).get("next");

    if (!requested) return fallback;

    try {
        const url = new URL(requested, window.location.origin);

        const isWorkspace =
            url.pathname === "/staff" ||
            url.pathname === "/staff/events" ||
            /^\/staff\/events\/[^/]+$/.test(url.pathname);

        if (url.origin !== window.location.origin || !isWorkspace) {
            return fallback;
        }

        return `${url.pathname}${url.search}`;
    } catch {
        return fallback;
    }
}

export default function StaffLoginPage() {
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");

    const [sessionStatus, setSessionStatus] = useState<
        "checking" | "signed-out" | "error"
    >("checking");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function checkSession() {
            try {
                const response = await fetch("/api/staff/events?view=dashboard", {
                    cache: "no-store",
                    signal: controller.signal,
                });

                if (controller.signal.aborted) return;

                if (response.status === 401) {
                    setSessionStatus("signed-out");
                    return;
                }

                if (!response.ok) {
                    setSessionStatus("error");
                    return;
                }

                window.location.replace(getReturnPath());
            } catch {
                if (!controller.signal.aborted) {
                    setSessionStatus("error");
                }
            }
        }

        void checkSession();

        return () => controller.abort();
    }, [attempt]);

    async function signIn(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;

        const form = new FormData(event.currentTarget);
        setSubmitting(true);
        setError("");

        try {
            const response = await fetch("/api/staff/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: String(form.get("email") ?? "").trim(),
                    password: String(form.get("password") ?? ""),
                }),
            });

            if (response.status === 401) {
                setError("Incorrect email or password.");
                setSubmitting(false);
                return;
            }

            if (!response.ok) {
                throw new Error("Sign-in failed.");
            }

            // Load the protected page with the session cookie just issued by the API.
            window.location.replace(getReturnPath());
        } catch {
            setError("Could not reach the staff service. Please try again.");
            setSubmitting(false);
        }
    }

    if (sessionStatus !== "signed-out") {
        return (
            <main className="grid min-h-dvh place-items-center bg-slate-100 px-4">
                {sessionStatus === "checking" ? (
                    <p role="status" className="text-sm font-medium text-slate-600">
                        Checking your staff session…
                    </p>
                ) : (
                    <section className={styles.loginCard}>
                        <h1 className="text-xl font-semibold text-slate-950">
                            Couldn’t check your session
                        </h1>
                        <p role="alert" className="my-4 text-sm text-slate-600">
                            The staff service could not be reached. Please try again.
                        </p>
                        <button
                            type="button"
                            className={styles.primary}
                            onClick={() => {
                                setSessionStatus("checking");
                                setAttempt((current) => current + 1);
                            }}
                        >
                            Try again
                        </button>
                    </section>
                )}
            </main>
        );
    }

    return (
        <main className="grid min-h-dvh place-items-center bg-slate-100 px-4 py-10 font-sans text-slate-950">
            <div className="w-full max-w-md">
                <div className="mb-6 flex items-center justify-center gap-3">
                    <span
                        aria-hidden="true"
                        className="grid size-10 place-items-center rounded-xl bg-teal-700 text-xl font-bold text-white"
                    >
                        ✓
                    </span>
                    <span className="text-lg font-bold tracking-tight">
                        Event check-in
                    </span>
                </div>

                <section
                    aria-labelledby="login-title"
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
                >
                    <h1
                        id="login-title"
                        className="text-3xl font-semibold tracking-tight text-slate-950"
                    >
                        Staff sign-in
                    </h1>

                    <form onSubmit={signIn} className="mt-7 grid gap-5">
                        <label className={styles.label}>
                            Email address
                            <input
                                className={styles.input}
                                name="email"
                                type="email"
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                maxLength={254}
                                required
                            />
                        </label>

                        <div>
                            <div className="mb-2 flex items-baseline justify-between gap-3">
                                <label
                                    htmlFor="staff-password"
                                    className="text-sm font-semibold text-slate-800"
                                >
                                    Password
                                </label>

                                <Link
                                    href="/staff/forgot-password"
                                    className="rounded text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-teal-700"
                                >
                                    Forgot password?
                                </Link>
                            </div>

                            <div className="relative">
                                <input
                                    id="staff-password"
                                    className={`${styles.input} pr-20`}
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    required
                                />

                                <button
                                    type="button"
                                    aria-controls="staff-password"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    onClick={() => setShowPassword((current) => !current)}
                                    className="absolute inset-y-1 right-1 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-700"
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p role="alert" className={`${styles.feedback} ${styles.error}`}>
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            className={`${styles.primary} w-full`}
                            disabled={submitting}
                        >
                            {submitting ? "Signing in…" : "Sign in"}
                        </button>
                    </form>
                </section>
            </div>
        </main>
    );
}