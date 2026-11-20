"use client";

import { useEffect, useState, type FormEvent } from "react";
import CheckInForm from "./check-in-form";
import AttendanceSummary from "./attendance-summary";

type StaffEvent = {
  slug: string;
  name: string;
  venue: string;
};

type Screen =
  | { status: "loading" }
  | { status: "login" }
  | { status: "ready"; events: StaffEvent[] }
  | { status: "error" };

async function loadStaffEvents(signal?: AbortSignal): Promise<Screen> {
  const response = await fetch("/api/staff/events", {
    cache: "no-store",
    signal,
  });

  if (response.status === 401) return { status: "login" };
  if (!response.ok) throw new Error("Could not load assigned events");

  const events: StaffEvent[] = await response.json();
  return { status: "ready", events };
}

export default function StaffPage() {
  const [screen, setScreen] = useState<Screen>({ status: "loading" });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    loadStaffEvents(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setScreen(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setScreen({ status: "error" });
      });

    return () => controller.abort();
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });

      if (response.status === 401) {
        setMessage("Incorrect email or password.");
        return;
      }
      if (!response.ok) throw new Error("Sign-in request failed");

      const next = await loadStaffEvents();
      setScreen(next);
      if (next.status === "login") {
        setMessage("Sign-in succeeded, but the session cookie was not received.");
      }
    } catch {
      setMessage("Could not reach the staff service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/staff/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      setScreen({ status: "login" });
    } catch {
      setMessage("Could not confirm sign-out. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-14 text-stone-950">
      <section className="mx-auto max-w-lg rounded-xl border border-stone-200 bg-white p-7">
        <h1 className="text-2xl font-semibold">
          {screen.status === "ready" ? "Your assigned events" : "Staff sign-in"}
        </h1>

        {screen.status === "ready" && (
          <div className="mt-3">
            <button
              type="button"
              onClick={signOut}
              disabled={submitting}
              className="text-sm font-medium underline underline-offset-4 disabled:opacity-60"
            >
              {submitting ? "Signing out…" : "Sign out"}
            </button>

            {message && (
              <p role="alert" className="mt-2 text-sm text-red-700">{message}</p>
            )}
          </div>
        )}

        {screen.status === "loading" && (
          <p role="status" className="mt-5">Checking your session…</p>
        )}

        {screen.status === "error" && (
          <p role="alert" className="mt-5">
            Could not load your events. Refresh to try again.
          </p>
        )}

        {screen.status === "login" && (
          <form onSubmit={signIn} className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-medium">Email address</span>
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
              />
            </label>

            {message && <p role="alert" className="text-sm text-red-700">{message}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {screen.status === "ready" && (
          screen.events.length === 0 ? (
            <p className="mt-5">You have no event assignments yet.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {screen.events.map((event) => (
                <li key={event.slug} className="rounded-lg border border-stone-200 p-4">
                  <h2 className="font-semibold">{event.name}</h2>
                  <p className="mt-1 text-sm text-stone-600">{event.venue}</p>
                  <AttendanceSummary slug={event.slug} />
                  <CheckInForm slug={event.slug} />
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </main>
  );
}
