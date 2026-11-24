"use client";

import { publicStyles } from "./public-styles";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import PublicEventBanner from "./public-event-banner";
import {
  eventDate,
  eventTime,
  ticketSummary,
  type PublicEvent,
} from "./public-events";

const PAGE_SIZE = 12;

export function RetryEvents() {
  return (
    <button
      type="button"
      className={publicStyles.secondary}
      onClick={() => window.location.reload()}
    >
      Try again
    </button>
  );
}

export default function EventCatalog({
  events,
  loadedAt,
}: {
  events: PublicEvent[];
  loadedAt: number;
}) {
  const [period, setPeriod] = useState<"upcoming" | "past">("upcoming");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const resultHeading = useRef<HTMLParagraphElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const filtered = events.filter((event) => {
    const isPast = Date.parse(event.startsAt) <= loadedAt;
    const matchesPeriod = period === "past" ? isPast : !isPast;
    return (
      matchesPeriod &&
      `${event.name} ${event.venue}`.toLocaleLowerCase("en-KE").includes(query)
    );
  });
  const ordered = period === "past" ? [...filtered].reverse() : filtered;
  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = ordered.slice(start, start + PAGE_SIZE);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(
      String(new FormData(event.currentTarget).get("query") ?? "")
        .trim()
        .toLocaleLowerCase("en-KE"),
    );
    setPage(1);
  }

  function changePage(destination: number) {
    setPage(destination);
    resultHeading.current?.focus({ preventScroll: true });
    resultHeading.current?.scrollIntoView({ block: "start" });
  }

  return (
    <section
      id="event-directory"
      className="scroll-mt-6"
      aria-label="Event directory"
    >
      <form
        onSubmit={search}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
        role="search"
      >
        <label className="grid min-w-0 flex-[1_1_240px] gap-2 text-sm font-semibold">
          Search events
          <input
            ref={searchInput}
            className={publicStyles.input}
            name="query"
            type="search"
            placeholder="Event name or venue"
            maxLength={200}
          />
        </label>
        <button type="submit" className={publicStyles.primary}>
          Search events
        </button>
      </form>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div
          className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1"
          role="group"
          aria-label="Event date filter"
        >
          {(["upcoming", "past"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="min-h-11 cursor-pointer rounded-lg border border-transparent px-4 py-2 text-sm font-semibold text-slate-600 aria-pressed:border-slate-200 aria-pressed:bg-white aria-pressed:text-teal-800 aria-pressed:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 motion-safe:transition-colors"
              aria-pressed={period === value}
              onClick={() => {
                setPeriod(value);
                setPage(1);
              }}
            >
              {value === "upcoming" ? "Upcoming events" : "Past events"}
            </button>
          ))}
        </div>
        <p
          ref={resultHeading}
          tabIndex={-1}
          role="status"
          className="scroll-mt-6 text-sm text-slate-600"
        >
          {ordered.length === 0
            ? "0 events"
            : `${start + 1}–${start + visible.length} of ${ordered.length} ${ordered.length === 1 ? "event" : "events"}`}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className={publicStyles.empty}>
          <h2>
            {query
              ? "No matching events"
              : period === "upcoming"
                ? "No upcoming events yet"
                : "No past events"}
          </h2>
          <p>
            {query
              ? "Try another event name or venue."
              : "Events will appear here when they are listed."}
          </p>
          {query && (
            <button
              type="button"
              className={publicStyles.secondary}
              onClick={() => {
                setQuery("");
                setPage(1);
                if (searchInput.current) searchInput.current.value = "";
                searchInput.current?.focus();
              }}
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map((event, index) => {
            const summary = ticketSummary(event);
            const date = new Date(event.startsAt);
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${encodeURIComponent(event.slug)}`}
                  className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-teal-400 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-1"
                >
                  <PublicEventBanner
                    slug={event.slug}
                    hasBanner={event.hasBanner}
                    priority={index < 3}
                  />
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <time
                      dateTime={event.startsAt}
                      className="text-sm font-semibold leading-6 text-teal-800"
                    >
                      {eventDate.format(date)} · {eventTime.format(date)} EAT
                    </time>
                    <h2 className="break-words text-xl font-semibold leading-7 tracking-tight text-slate-950 group-hover:text-teal-800">
                      {event.name}
                    </h2>
                    <p className="break-words text-sm leading-6 text-slate-600">
                      {event.venue}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
                      <span className="font-bold text-slate-900">
                        {period === "past" ? "Event ended" : summary.label}
                      </span>
                      <span className="font-semibold text-teal-800">
                        View event
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Event pages"
          className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600"
        >
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={publicStyles.secondary}
              disabled={currentPage === 1}
              onClick={() => changePage(currentPage - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className={publicStyles.secondary}
              disabled={currentPage === pageCount}
              onClick={() => changePage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
