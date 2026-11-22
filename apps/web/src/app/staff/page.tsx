"use client";

import { Suspense, useEffect, useState } from "react";
import StaffDashboard, { type StaffEvent } from "./staff-dashboard";
import styles from "./staff-styles";

type DashboardData = {
  canCreateEvents: boolean;
  events: StaffEvent[];
};

type Screen =
  | { status: "loading" }
  | { status: "error" }
  | ({ status: "ready"; loadedAt: number } & DashboardData);

function redirectToLogin() {
  const next = window.location.pathname + window.location.search;
  const query = new URLSearchParams({ next });

  window.location.replace(`/staff/login?${query.toString()}`);
}

function LoadingScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 px-4">
      <p role="status" className="text-sm font-medium text-slate-600">
        Opening staff workspace…
      </p>
    </main>
  );
}

export default function StaffPage() {
  const [screen, setScreen] = useState<Screen>({ status: "loading" });
  const [message, setMessage] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const response = await fetch("/api/staff/events?view=dashboard", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error("Dashboard request failed.");
        }

        const data: DashboardData = await response.json();

        if (!controller.signal.aborted) {
          setScreen({
            status: "ready",
            events: data.events,
            canCreateEvents: data.canCreateEvents,
            loadedAt: Date.now(),
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setScreen({ status: "error" });
        }
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setScreen({ status: "loading" });
    setAttempt((current) => current + 1);
  }

  function updateEvent(saved: StaffEvent) {
    setScreen((current) => {
      if (current.status !== "ready") return current;

      const events = [
        ...current.events.filter((event) => event.slug !== saved.slug),
        saved,
      ].sort(
        (a, b) =>
          Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
          a.slug.localeCompare(b.slug),
      );

      return { ...current, events };
    });
  }

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    setMessage("");

    try {
      const response = await fetch("/api/staff/logout", { method: "POST" });

      if (!response.ok && response.status !== 401) {
        throw new Error("Sign-out failed.");
      }

      window.location.replace("/staff/login");
    } catch {
      setMessage("Could not confirm sign-out. Please try again.");
      setSigningOut(false);
    }
  }

  if (screen.status === "loading") {
    return <LoadingScreen />;
  }

  if (screen.status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-100 px-4">
        <section className={styles.loginCard}>
          <h1 className="text-xl font-semibold text-slate-950">
            Workspace unavailable
          </h1>
          <p role="alert" className="my-4 text-sm text-slate-600">
            Your assigned events could not be loaded.
          </p>
          <button type="button" className={styles.primary} onClick={retry}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <StaffDashboard
        events={screen.events}
        canCreateEvents={screen.canCreateEvents}
        loadedAt={screen.loadedAt}
        signingOut={signingOut}
        onSignOut={signOut}
        message={message}
        onCreated={updateEvent}
      />
    </Suspense>
  );
}