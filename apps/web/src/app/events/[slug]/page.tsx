import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import TicketChoiceForm, { type PublicTier } from "./ticket-choice-form";
type EventPageProps = {
  params: Promise<{ slug: string }>;
};

type EventDetails = {
  name: string;
  venue: string;
  startsAt: string;
  description: string | null;
  descriptionHtml: string | null;
  ticketStatus: "closed" | "available" | "sold_out";
};

const eventDate = new Intl.DateTimeFormat("en-KE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

export default function EventPage({ params }: EventPageProps) {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-14 text-stone-950">
      <div className="mx-auto max-w-full">
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

  const tiersResponse = await fetch(
    new URL(`/events/${encodeURIComponent(slug)}/ticket-tiers`, baseUrl),
    { cache: "no-store" },
  );
  if (!tiersResponse.ok) throw new Error("Could not load ticket options.");
  const tiers: PublicTier[] = await tiersResponse.json();

  return (
    <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="bg-slate-950 px-6 py-9 text-white sm:px-10 sm:py-12">
        <p className="text-sm font-semibold text-teal-300">
          {eventDate.format(new Date(event.startsAt))} · Nairobi time
        </p>
        <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight sm:text-5xl">
          {event.name}
        </h1>
        <p className="mt-4 text-slate-200">{event.venue}</p>
      </header>

      <div className="grid items-start gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <h2 className="text-xl font-semibold">About this event</h2>
          {event.descriptionHtml ? (
            <div
              className="mt-3 break-words leading-7 text-slate-700 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: event.descriptionHtml }}
            />
          ) : (
            <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">
              {event.description || `Join us at ${event.venue}.`}
            </p>
          )}
        </section>
        <div className="grid gap-4">
          <TicketChoiceForm
            key={slug}
            slug={slug}
            freeStatus={event.ticketStatus}
            tiers={tiers}
          />
        </div>
      </div>
    </article>
  );
}
