"use client";

import Link from "next/link";
import { useState } from "react";
import PublicEventBanner from "./public-event-banner";
import {
  eventDate,
  eventTime,
  ticketSummary,
  type PublicEvent,
} from "./public-events";

export default function EventSpotlight({ events }: { events: PublicEvent[] }) {
  const [index, setIndex] = useState(0);
  const position = Math.min(index, Math.max(0, events.length - 1));
  const event = events[position];

  if (!event) {
    return (
      <section
        aria-labelledby="discover-title"
        className="mb-10 rounded-3xl bg-linear-to-br from-slate-950 via-slate-900 to-teal-950 px-6 py-14 text-white sm:px-12 sm:py-20"
      >
        <h1
          id="discover-title"
          className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl"
        >
          Discover your next event.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
          Find your next meetup, live show, or community gathering.
        </p>
        <a
          href="#event-directory"
          className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-teal-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-teal-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Browse events
        </a>
      </section>
    );
  }

  const date = new Date(event.startsAt);
  const summary = ticketSummary(event);

  return (
    <section
      aria-label="Event highlights"
      aria-roledescription={events.length > 1 ? "carousel" : undefined}
      className="relative mb-10 isolate overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm"
    >
      <PublicEventBanner
        key={event.slug}
        slug={event.slug}
        hasBanner={event.hasBanner}
        hero
        priority
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-r from-slate-950 via-slate-950/90 to-slate-950/25"
      />
      <div className="relative flex min-h-[400px] flex-col justify-center px-6 py-10 sm:min-h-[460px] sm:px-10 lg:px-14">
        <div className="max-w-3xl" aria-live="polite" aria-atomic="true">
          <time
            dateTime={event.startsAt}
            className="text-sm font-semibold leading-6 text-teal-300"
          >
            {eventDate.format(date)} · {eventTime.format(date)} EAT
          </time>
          <h1 className="mt-4 break-words text-3xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {event.name}
          </h1>
          <p className="mt-5 break-words text-base leading-7 text-slate-200 sm:text-lg">
            {event.venue}
          </p>
          <p className="mt-2 text-sm font-semibold text-teal-200">
            {summary.label}
          </p>
          <Link
            href={`/events/${encodeURIComponent(event.slug)}`}
            className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-teal-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-teal-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-safe:transition-colors"
          >
            View event
          </Link>
        </div>

        {events.length > 1 && (
          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-white/15 pt-5">
            <div
              className="flex gap-2"
              role="group"
              aria-label="Choose a highlighted event"
            >
              {events.map((item, slideIndex) => (
                <button
                  key={item.slug}
                  type="button"
                  aria-label={`Show ${item.name}`}
                  aria-pressed={position === slideIndex}
                  onClick={() => setIndex(slideIndex)}
                  className="grid size-11 cursor-pointer place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 rounded-full motion-safe:transition-all ${position === slideIndex ? "w-8 bg-teal-300" : "w-3 bg-white/50"}`}
                  />
                </button>
              ))}
            </div>
            <span className="text-sm tabular-nums text-slate-300">
              {position + 1} of {events.length}
            </span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setIndex((position - 1 + events.length) % events.length)
                }
                className="min-h-11 cursor-pointer rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setIndex((position + 1) % events.length)}
                className="min-h-11 cursor-pointer rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
