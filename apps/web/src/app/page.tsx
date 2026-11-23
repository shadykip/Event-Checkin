import { publicStyles } from "./public-styles";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import EventSpotlight from "./event-spotlight";
import EventCatalog, { RetryEvents } from "./event-catalog";
import PublicShell from "./public-shell";
import type { PublicEvent } from "./public-events";

export const metadata: Metadata = {
  title: "Discover events | Event check-in",
  description: "Explore upcoming events, compare tickets, and book your place.",
};

export default function EventsPage() {
  return (
    <PublicShell>
      <main id="main-content" className={publicStyles.container}>
        <Suspense
          fallback={
            <p role="status" className="py-12 text-slate-600">
              Loading events…
            </p>
          }
        >
          <EventList />
        </Suspense>
      </main>
    </PublicShell>
  );
}

async function loadEvents() {
  await connection();
  const response = await fetch(new URL("/events", process.env.API_BASE_URL), {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not load events");
  const events: PublicEvent[] = await response.json();
  return { events, loadedAt: Date.now() };
}

async function EventList() {
  let data: Awaited<ReturnType<typeof loadEvents>>;
  try {
    data = await loadEvents();
  } catch {
    return (
      <div className={publicStyles.empty} role="alert">
        <h1>Events are temporarily unavailable</h1>
        <p>Please try loading the events again.</p>
        <RetryEvents />
      </div>
    );
  }
  const upcoming = data.events.filter(
    (event) => Date.parse(event.startsAt) > data.loadedAt,
  );
  const highlights = [
    ...upcoming.filter((event) => event.hasBanner),
    ...upcoming.filter((event) => !event.hasBanner),
  ].slice(0, 5);
  return (
    <>
      <EventSpotlight events={highlights} />
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
        Explore events
      </h2>
      <EventCatalog events={data.events} loadedAt={data.loadedAt} />
    </>
  );
}
