
import { Suspense } from "react";
import Link from "next/link";

type EventSummary = {
  id: string;
  name: string;
  slug: string;
  venue: string;
  startsAt: string;
  ticketStatus: "closed" | "available" | "sold_out";
};

const eventDate = new Intl.DateTimeFormat("en-KE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

async function getEvents(): Promise<EventSummary[]> {
  const baseUrl = process.env.API_BASE_URL;

  if (!baseUrl) {
    throw new Error("Set API_BASE_URL in apps/web/.env.local");
  }

  const response = await fetch(new URL("/events", baseUrl), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Could not load events: API returned ${response.status}`);
  }

  return response.json();
}

export default function EventsPage() {
  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <span className="text-lg font-bold tracking-tight">Event check-in</span>
          <Link href="/staff/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-teal-800 hover:underline">
            Staff sign-in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Discover events</h1>
        <Suspense fallback={<p role="status" className="mt-8">Loading events…</p>}>
          <EventList />
        </Suspense>
      </section>
    </main>
  );
}

async function EventList() {
  const events = await getEvents();

  if (events.length === 0) {
    return <p className="mt-6 text-stone-600">No events are listed yet.</p>;
  }

  return (
    <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`/events/${encodeURIComponent(event.slug)}`}
            className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-teal-500 focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            <time dateTime={event.startsAt} className="text-sm font-semibold text-teal-800">
              {eventDate.format(new Date(event.startsAt))} EAT
            </time>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight group-hover:text-teal-800">
              {event.name}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{event.venue}</p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-6">
              <span className="text-sm font-semibold">
                {event.ticketStatus === "available"
                  ? "Free tickets"
                  : event.ticketStatus === "sold_out"
                    ? "Sold out"
                    : "Registration closed"}
              </span>
              <span aria-hidden="true" className="text-teal-800">→</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
