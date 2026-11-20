
import { Suspense } from "react";
import Link from "next/link";
type EventSummary = {
  id: string;
  name: string;
  slug: string;
  venue: string;
  startsAt: string;
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
    <main className="min-h-screen bg-stone-50 px-5 py-14 text-stone-950 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight">Events</h1>

        <Suspense
          fallback={
            <p role="status" className="mt-6 text-stone-600">
              Loading events…
            </p>
          }
        >
          <EventList />
        </Suspense>
      </div>
    </main>
  );
}

async function EventList() {
  const events = await getEvents();

  if (events.length === 0) {
    return <p className="mt-6 text-stone-600">No events are listed yet.</p>;
  }

  return (
    <ul className="mt-8 space-y-4">
      {events.map((event) => (
        <li
          key={event.id}
          className="rounded-xl border border-stone-200 bg-white p-6"
        >
          <h2 className="text-2xl font-semibold">
            <Link
              href={`/events/${encodeURIComponent(event.slug)}`}
              className="underline-offset-4 hover:underline focus-visible:underline"
            >
              {event.name}
            </Link>
          </h2>
          <p className="mt-2 text-stone-700">{event.venue}</p>
          <p className="mt-4 text-sm text-stone-600">
            <time dateTime={event.startsAt}>
              {eventDate.format(new Date(event.startsAt))}
            </time>
            {" · Nairobi time"}
          </p>
        </li>
      ))}
    </ul>
  );
}
