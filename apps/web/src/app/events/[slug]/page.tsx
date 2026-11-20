import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

type EventDetails = {
  name: string;
  venue: string;
  startsAt: string;
};

const eventDate = new Intl.DateTimeFormat("en-KE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

export default function EventPage({ params }: EventPageProps) {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-14 text-stone-950">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="underline underline-offset-4">
          Back to events
        </Link>

        <Suspense fallback={<p role="status" className="mt-8">Loading event…</p>}>
          <EventDetail params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function EventDetail({ params }: EventPageProps) {
  const { slug } = await params;
  const baseUrl = process.env.API_BASE_URL;

  if (!baseUrl) {
    throw new Error("Set API_BASE_URL in apps/web/.env.local");
  }

  const url = new URL(`/events/${encodeURIComponent(slug)}`, baseUrl);
  const response = await fetch(url, { cache: "no-store" });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error(`Could not load event: API returned ${response.status}`);
  }

  const event: EventDetails = await response.json();

  return (
    <article className="mt-8 rounded-xl border border-stone-200 bg-white p-6 sm:p-8">
      <h1 className="text-3xl font-semibold tracking-tight">{event.name}</h1>

      <dl className="mt-6 space-y-5">
        <div>
          <dt className="text-sm text-stone-600">Venue</dt>
          <dd className="mt-1">{event.venue}</dd>
        </div>
        <div>
          <dt className="text-sm text-stone-600">Date and time</dt>
          <dd className="mt-1">
            <time dateTime={event.startsAt}>
              {eventDate.format(new Date(event.startsAt))}
            </time>
            {" · Nairobi time"}
          </dd>
        </div>
      </dl>
    </article>
  );
}
