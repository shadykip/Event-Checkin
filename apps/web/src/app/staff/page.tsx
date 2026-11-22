"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import styles from "./staff-styles";

import StaffDashboard, { type StaffEvent } from "./staff-dashboard";

type DashboardData = {
  canCreateEvents: boolean;
  events: StaffEvent[];
};

type Screen =
  | { status: "loading" }
  | { status: "login" }
  | ({ status: "ready"; loadedAt: number } & DashboardData)
  | { status: "error" };

async function loadStaffEvents(signal?: AbortSignal): Promise<Screen> {
  const response = await fetch("/api/staff/events?view=dashboard", {
    cache: "no-store",
    signal,
  });

  if (response.status === 401) return { status: "login" };
  if (!response.ok) throw new Error("Could not load the staff dashboard.");


  const data: DashboardData = await response.json();
  return { status: "ready", ...data, loadedAt: Date.now() };
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

  if (screen.status === "ready") {
    return (
      <Suspense fallback={<p className="p-6">Loading dashboard…</p>}>
        <StaffDashboard
          events={screen.events}
          canCreateEvents={screen.canCreateEvents}
          signingOut={submitting}
          onSignOut={signOut}
          loadedAt={screen.loadedAt}
          message={message}
          onCreated={(created) => {
            setScreen((current) => {
              if (current.status !== "ready") return current;

              const events = [
                ...current.events.filter((event) => event.slug !== created.slug),
                created,
              ].sort(
                (a, b) =>
                  Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
                  a.slug.localeCompare(b.slug),
              );

              return { ...current, events };
            });
          }}
        />
      </Suspense>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <span className={styles.brand}>Event check-in</span>


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


      </div>
    </main>
  );
}