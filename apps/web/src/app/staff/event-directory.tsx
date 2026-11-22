"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { StaffEvent } from "./staff-dashboard";

const PAGE_SIZE = 6;
const defaultBanner = "/events/default.jpg";

const eventBanners: Record<string, string> = {
    "aws-student-community-day-nairobi-2026-11-28":
        "/events/aws-student-community-day-nairobi.jpg",
};

const dateFormat = new Intl.DateTimeFormat("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
});

const timeFormat = new Intl.DateTimeFormat("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Nairobi",
});

function EventBanner({ slug }: { slug: string }) {
    const [failedSource, setFailedSource] = useState<string | null>(null);
    const customBanner = eventBanners[slug];
    const source =
        customBanner && failedSource !== customBanner ? customBanner : defaultBanner;

    return (
        <div className="relative aspect-[2.3/1] overflow-hidden bg-gradient-to-br from-teal-800 via-slate-800 to-slate-950">
            {failedSource !== defaultBanner && (
                <Image
                    src={source}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 27vw, (min-width: 640px) 45vw, 100vw"
                    className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                    onError={() => setFailedSource(source)}
                />
            )}
        </div>
    );
}

const pageButton =
    "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";

export default function EventDirectory({
    events,
    requestedPage,
}: {
    events: StaffEvent[];
    requestedPage: number;
}) {
    const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
    const page = Math.min(Math.max(requestedPage, 1), pageCount);
    const start = (page - 1) * PAGE_SIZE;
    const visible = events.slice(start, start + PAGE_SIZE);

    if (!events.length) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-8">
                <h2 className="text-lg font-semibold text-slate-950">
                    No assigned events yet
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                    Events you organize or staff will appear here.
                </p>
            </section>
        );
    }

    return (
        <section aria-label="Assigned event directory">
            <p className="mb-4 text-sm text-slate-600">
                Showing {start + 1}–{start + visible.length} of {events.length}{" "}
                {events.length === 1 ? "event" : "events"}
            </p>

            <ul className="grid list-none gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((event) => {
                    const startsAt = new Date(event.startsAt);

                    return (
                        <li key={event.slug} className="min-w-0">
                            <Link
                                href={`/staff/events/${encodeURIComponent(event.slug)}?page=${page}`}
                                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
                            >
                                <EventBanner slug={event.slug} />

                                <div className="flex flex-1 flex-col p-5">
                                    <span className="mb-3 w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                        {event.role === "ORGANIZER" ? "Organizer" : "Door staff"}
                                    </span>

                                    <h2 className="break-words text-xl font-semibold leading-snug tracking-tight text-slate-950 group-hover:text-teal-800">
                                        {event.name}
                                    </h2>

                                    <p className="mt-3 break-words text-sm text-slate-600">
                                        {event.venue}
                                    </p>

                                    <time
                                        dateTime={event.startsAt}
                                        className="mt-1 block text-sm leading-6 text-slate-600"
                                    >
                                        {dateFormat.format(startsAt)} · {timeFormat.format(startsAt)} EAT
                                    </time>

                                    <div className="mt-auto pt-5">
                                        <span className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-teal-800">
                                            Open event
                                            <span aria-hidden="true">→</span>
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </li>
                    );
                })}
            </ul>

            {pageCount > 1 && (
                <nav
                    aria-label="Event pages"
                    className="mt-6 flex flex-wrap items-center justify-between gap-3"
                >
                    <span className="text-sm text-slate-600">
                        Page {page} of {pageCount}
                    </span>

                    <div className="flex gap-2">
                        {page > 1 && (
                            <Link href={`/staff/events?page=${page - 1}`} className={pageButton}>
                                Previous
                            </Link>
                        )}
                        {page < pageCount && (
                            <Link href={`/staff/events?page=${page + 1}`} className={pageButton}>
                                Next
                            </Link>
                        )}
                    </div>
                </nav>
            )}
        </section>
    );
}