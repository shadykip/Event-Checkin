"use client";

import { useEffect, useState, type FormEvent } from "react";
import AttendanceSummary from "./attendance-summary";
import CheckInForm from "./check-in-form";
import styles from "./staff-styles";
import InviteGuestForm from "./invite-guest-form";

type StaffEvent = {
  slug: string;
  name: string;
  venue: string;
  startsAt: string;
  role: "DOOR_STAFF" | "ORGANIZER";
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

  if (response.status === 401) {
    return { status: "login" };
  }

  if (!response.ok) {
    throw new Error("Could not load assigned events.");
  }

  const events: StaffEvent[] = await response.json();
  return { status: "ready", events };
}

export default function StaffPage() {
  const [screen, setScreen] = useState<Screen>({ status: "loading" });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const next = await loadStaffEvents(controller.signal);

        if (!controller.signal.aborted) {
          setScreen(next);
        }
      } catch {
        if (!controller.signal.aborted) {
          setScreen({ status: "error" });
        }
      }
    }

    void checkSession();

    return () => controller.abort();
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

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

      if (!response.ok) {
        throw new Error("Sign-in request failed.");
      }

      const next = await loadStaffEvents();
      setScreen(next);

      if (next.status === "login") {
        setMessage("Your session could not be opened. Please sign in again.");
      }
    } catch {
      setMessage("Could not reach the staff service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    if (submitting) return;

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/staff/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Sign-out failed.");
      }

      setScreen({ status: "login" });
    } catch {
      setMessage("Could not confirm sign-out. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <span className={styles.brand}>Event check-in</span>

          {screen.status === "ready" && (
            <button
              type="button"
              className={styles.barButton}
              onClick={signOut}
              disabled={submitting}
            >
              {submitting ? "Signing out…" : "Sign out"}
            </button>
          )}
        </div>
      </header>

      <div className={styles.workspace}>
        {screen.status === "loading" && (
          <p role="status">Checking your staff session…</p>
        )}

        {screen.status === "error" && (
          <div role="alert" className={`${styles.feedback} ${styles.error}`}>
            Could not load your events. Refresh the page to try again.
          </div>
        )}

        {screen.status === "login" && (
          <section className={styles.loginCard} aria-labelledby="staff-login-title">
            <h1 id="staff-login-title" className={styles.title}>
              Staff sign-in
            </h1>

            <form onSubmit={signIn} className={styles.stack}>
              <label className={styles.label}>
                Email address
                <input
                  className={styles.input}
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>

              <label className={styles.label}>
                Password
                <input
                  className={styles.input}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>

              {message && (
                <p role="alert" className={`${styles.feedback} ${styles.error}`}>
                  {message}
                </p>
              )}

              <button
                type="submit"
                className={styles.primary}
                disabled={submitting}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </section>
        )}

        {screen.status === "ready" && (
          <>
            <h1 className={styles.title}>Your assigned events</h1>

            {message && (
              <p role="alert" className={`${styles.feedback} ${styles.error}`}>
                {message}
              </p>
            )}

            {screen.events.length === 0 ? (
              <div className={`${styles.card} ${styles.panel}`}>
                You have no event assignments yet. Ask your organizer to assign
                you to an event.
              </div>
            ) : (
              <ul className={styles.eventList}>
                {screen.events.map((event) => (
                  <li key={event.slug} className={styles.card}>
                    <header className={styles.eventHeader}>
                      <h2 className={styles.eventName}>{event.name}</h2>
                      <p className={styles.muted}>{event.venue}</p>
                    </header>

                    <div className={styles.eventBody}>
                      <CheckInForm slug={event.slug} />
                      <AttendanceSummary slug={event.slug} />
                    </div>
                    {event.role === "ORGANIZER" && <InviteGuestForm slug={event.slug} />}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}