import { publicStyles } from "../../public-styles";
import Link from "next/link";
import { Suspense } from "react";
import PublicShell from "../../public-shell";
import PublicEventBanner from "../../public-event-banner";
import { eventDate, eventTime, ticketSummary } from "../../public-events";
import TicketChoiceForm from "./ticket-choice-form";
import { getPublicEvent } from "./event-data";

export { generateMetadata } from "./metadata";

type Props = { params: Promise<{ slug: string }> };

export default function EventPage({ params }: Props) {
  return (
    <PublicShell>
      <main id="main-content" className={publicStyles.container}>
        <Link
          href="/"
          className="mb-6 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
        >
          Back to events
        </Link>

        <Suspense
          fallback={
            <p role="status" className="py-12 text-slate-600">
              Loading event…
            </p>
          }
        >
          <EventDetail params={params} />
        </Suspense>
      </main>
    </PublicShell>
  );
}

async function EventDetail({ params }: Props) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);

  if (!event) return <EventUnavailable />;

  const startsAt = new Date(event.startsAt);
  const summary = ticketSummary(event);

  return (
    <article>
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {event.hasBanner && (
          <PublicEventBanner slug={slug} hasBanner wide priority />
        )}

        <div className="p-6 sm:p-10">
          <time
            className="text-sm font-semibold leading-6 text-teal-800"
            dateTime={event.startsAt}
          >
            {eventDate.format(startsAt)} · {eventTime.format(startsAt)} EAT
          </time>

          <h1 className="mt-4 max-w-5xl break-words text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            {event.name}
          </h1>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-5">
            <p className="max-w-2xl break-words leading-7 text-slate-600">
              {event.venue}
            </p>

            <a
              href="#tickets"
              className={
                summary.open ? publicStyles.primary : publicStyles.secondary
              }
            >
              {summary.open ? "Choose tickets" : "View ticket availability"}
            </a>
          </div>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
        <div
          id="tickets"
          className="min-w-0 scroll-mt-28 lg:sticky lg:top-28 lg:col-start-2 lg:row-start-1"
        >
          <TicketChoiceForm
            key={slug}
            slug={slug}
            freeStatus={event.ticketStatus}
            tiers={event.ticketTiers}
          />
        </div>

        <section
          className="min-w-0 lg:col-start-1 lg:row-start-1 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
          aria-labelledby="about-event"
        >
          <h2 id="about-event" className="text-xl font-semibold tracking-tight">
            About this event
          </h2>

          {event.descriptionHtml ? (
            <div
              className="mt-5 break-words text-base leading-8 text-slate-600 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-7 [&_h2]:text-slate-950 [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-7 [&_h3]:text-slate-950 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p+p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li+li]:mt-2"
              dangerouslySetInnerHTML={{ __html: event.descriptionHtml }}
            />
          ) : (
            <p className="mt-5 break-words text-base leading-8 text-slate-600 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-7 [&_h2]:text-slate-950 [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-7 [&_h3]:text-slate-950 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p+p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li+li]:mt-2 whitespace-pre-line">
              {event.description || `Join us at ${event.venue}.`}
            </p>
          )}

          <dl className="mt-8 grid gap-5 border-t border-slate-200 pt-6 [&_dt]:text-sm [&_dt]:text-slate-500 [&_dd]:mt-1 [&_dd]:break-words [&_dd]:font-semibold [&_dd]:leading-7">
            <div>
              <dt>Date and time</dt>
              <dd>
                {eventDate.format(startsAt)} · {eventTime.format(startsAt)} EAT
              </dd>
            </div>

            <div>
              <dt>Venue</dt>
              <dd>{event.venue}</dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
}

function EventUnavailable() {
  return (
    <div className={publicStyles.empty} role="alert">
      <h1>This event is temporarily unavailable</h1>
      <p>Please try again shortly.</p>
      <Link href="/" className={publicStyles.secondary}>
        Explore events
      </Link>
    </div>
  );
}