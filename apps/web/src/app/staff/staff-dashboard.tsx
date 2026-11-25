"use client";


import EventOperations from "./event-operations";
import styles from "./staff-styles";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { descriptionStyles } from "./event-description-editor";
import TicketSalesCards from "./ticket-sales-cards";

import CreateEventForm from "./create-event-form";
import EventDirectory, { EventBanner } from "./event-directory";

export type StaffEvent = {
    name: string;
    slug: string;
    venue: string;
    startsAt: string;
    description?: string | null;
    descriptionHtml?: string | null;
    hasBanner?: boolean;
    role: "DOOR_STAFF" | "ORGANIZER";
};

type View = "overview" | "events" | "create";

type Props = {
    events: StaffEvent[];
    canCreateEvents: boolean;
    onCreated: (event: StaffEvent) => void;
    onSignOut: () => void;
    signingOut: boolean;
    message: string;
    loadedAt: number;
};

const menu: { id: View; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "events", label: "My events" },
    { id: "create", label: "Create event" },
];

const eventDate = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
});

function formatDate(value: string) {
    return `${eventDate.format(new Date(value))} · Nairobi time`;
}

export default function StaffDashboard({
    events,
    canCreateEvents,
    onCreated,
    onSignOut,
    signingOut,
    message,
    loadedAt
}: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams<{ slug?: string }>();
    const searchParams = useSearchParams();

    const slug = params.slug;
    const isDirectory = pathname === "/staff/events";
    const isDetail = typeof slug === "string";

    const upcoming = events
        .filter((event) => Date.parse(event.startsAt) >= loadedAt)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

    const next = upcoming[0];

    const view: View =
        isDetail || isDirectory
            ? "events"
            : searchParams.get("view") === "create" && canCreateEvents
                ? "create"
                : "overview";

    const pageText = searchParams.get("page") ?? "1";
    const requestedPage = /^[1-9]\d*$/.test(pageText) ? Number(pageText) : 1;
    const page = Number.isSafeInteger(requestedPage) ? requestedPage : 1;

    const selected = isDetail
        ? events.find((event) => event.slug === slug)
        : undefined;

    const editingEvent =
        selected?.role === "ORGANIZER" && searchParams.get("edit") === "1";

    const eventUrl = selected
        ? `/staff/events/${encodeURIComponent(selected.slug)}?page=${page}`
        : "";

    const title = isDetail
        ? editingEvent
            ? "Edit event"
            : "Event workspace"
        : menu.find((item) => item.id === view)?.label ?? "Overview";

    function navigate(destination: View) {
        const destinations: Record<View, string> = {
            overview: "/staff",
            events: "/staff/events",
            create: "/staff?view=create",
        };

        router.push(destinations[destination]);
    }

    function openEvent(eventSlug: string) {
        router.push(`/staff/events/${encodeURIComponent(eventSlug)}`);
    }

    function created(event: StaffEvent) {
        onCreated(event);
        router.push(`/staff/events/${encodeURIComponent(event.slug)}?created=1`);
    }


    // function created(event: StaffEvent) {
    //     onCreated(event);
    //     openEvent(event.slug);
    //     setNotice(`${event.name} was created. You can now invite your first guest.`);
    // }

    return (
        <div className="min-h-dvh bg-slate-100 font-sans text-slate-950 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
            <a
                href="#staff-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
            >
                Skip to dashboard content
            </a>

            <aside className="bg-slate-950 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
                <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6 lg:py-7">
                    <span className="flex items-center gap-3 font-bold tracking-tight">
                        <span
                            aria-hidden="true"
                            className="grid size-9 place-items-center rounded-xl bg-teal-400 text-lg text-slate-950"
                        >
                            ✓
                        </span>
                        Event check-in
                    </span>

                    <button
                        type="button"
                        onClick={onSignOut}
                        disabled={signingOut}
                        className="min-h-11 rounded-lg px-2 text-sm text-slate-200 hover:text-white lg:hidden"
                    >
                        {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                </div>

                <nav
                    aria-label="Staff dashboard"
                    className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-4"
                >
                    {menu
                        .filter((item) => item.id !== "create" || canCreateEvents)
                        .map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                aria-current={view === item.id ? "page" : undefined}
                                onClick={() => navigate(item.id)}
                                className={`min-h-11 shrink-0 rounded-xl px-4 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-teal-300 ${view === item.id
                                    ? "bg-teal-300 text-slate-950"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                </nav>

                <div className="mt-auto hidden border-t border-white/10 p-4 lg:block">
                    <button
                        type="button"
                        onClick={onSignOut}
                        disabled={signingOut}
                        className="min-h-11 w-full rounded-xl px-4 text-left text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                        {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                </div>
            </aside>

            <main
                id="staff-content"
                tabIndex={-1}
                className="mx-auto w-full min-w-0  px-4 py-6 sm:px-7 lg:px-10 lg:py-10"
            >
                <h1 className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                    {title}
                </h1>

                {message && (
                    <p role="alert" className={`${styles.feedback} ${styles.error} mb-4`}>
                        {message}
                    </p>
                )}

                {selected && searchParams.get("created") === "1" && (
                    <p role="status" className={`${styles.feedback} ${styles.success} mb-4`}>
                        {selected.name} was created. You can now invite your first guest.
                    </p>
                )}
                {selected && !editingEvent && searchParams.get("saved") === "1" && (
                    <p role="status" className={`${styles.feedback} ${styles.success} mb-4`}>
                        Event changes saved.
                    </p>
                )}

                {view === "overview" && (
                    <div className="space-y-6">
                        <dl className="grid grid-cols-2 gap-3 sm:gap-5">
                            {[
                                { label: "Assigned events", value: events.length },
                                { label: "Upcoming events", value: upcoming.length },
                            ].map((metric) => (
                                <div
                                    key={metric.label}
                                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                >
                                    <dt className="text-sm font-medium text-slate-600">{metric.label}</dt>
                                    <dd className="mt-2 text-3xl font-semibold tabular-nums">{metric.value}</dd>
                                </div>
                            ))}
                        </dl>

                        {events.some((event) => event.role === "ORGANIZER") && (
                            <TicketSalesCards />
                        )}

                        <section className="rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
                            <h2 className="text-sm font-semibold text-teal-300">Next event</h2>
                            {next ? (
                                <>
                                    <p className="mt-3 text-2xl font-semibold tracking-tight">{next.name}</p>
                                    <p className="mt-2 text-sm text-slate-200">{next.venue}</p>
                                    <p className="mt-1 text-sm text-slate-200">{formatDate(next.startsAt)}</p>
                                    <button
                                        type="button"
                                        onClick={() => openEvent(next.slug)}
                                        className="mt-5 min-h-11 rounded-xl bg-teal-300 px-4 text-sm font-bold text-slate-950 hover:bg-teal-200"
                                    >
                                        Open event
                                    </button>
                                </>
                            ) : (
                                <p className="mt-3 text-slate-200">You have no upcoming assigned events.</p>
                            )}
                        </section>
                    </div>
                )}

                {isDirectory && (
                    <EventDirectory events={events} requestedPage={page} />
                )}

                {isDetail && (
                    <div className="space-y-5">
                        <Link
                            href={`/staff/events?page=${page}`}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                        >
                            <span aria-hidden="true">←</span>
                            Back to my events
                        </Link>

                        {selected && editingEvent ? (
                            <CreateEventForm
                                key={selected.slug}
                                initialEvent={selected}
                                onCancel={() => router.replace(eventUrl)}
                                onCreated={(updated) => {
                                    onCreated(updated);
                                    router.replace(`${eventUrl}&saved=1`);
                                }}
                            />
                        ) : selected ? (
                            <article className={styles.card}>
                                {selected.hasBanner && (
                                    <EventBanner
                                        key={selected.slug}
                                        slug={selected.slug}
                                        hasBanner
                                        wide
                                    />
                                )}
                                <header className={styles.eventHeader}>
                                    <div className="min-w-0">
                                        <h2 className={styles.eventName}>{selected.name}</h2>
                                        <p className="mt-2 break-words text-sm text-slate-200">
                                            {selected.venue}
                                        </p>
                                        <time
                                            dateTime={selected.startsAt}
                                            className="mt-1 block text-sm text-slate-200"
                                        >
                                            {formatDate(selected.startsAt)}
                                        </time>
                                    </div>

                                    <span className="w-fit shrink-0 rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white">
                                        {selected.role === "ORGANIZER" ? "Organizer" : "Door staff"}
                                    </span>
                                </header>
                                {selected.role === "ORGANIZER" && (
                                    <div className="border-b border-slate-200 px-5 py-3 sm:px-7">
                                        <Link href={`${eventUrl}&edit=1`} className={styles.secondary}>
                                            Edit event
                                        </Link>
                                    </div>
                                )}

                                {(selected.descriptionHtml || selected.description) && (
                                    <section className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
                                        <h2 className="text-base font-semibold text-slate-950">
                                            About this event
                                        </h2>

                                        {selected.descriptionHtml ? (
                                            <div
                                                className={`mt-2 ${descriptionStyles}`}
                                                dangerouslySetInnerHTML={{ __html: selected.descriptionHtml }}
                                            />
                                        ) : (
                                            <p className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-slate-700">
                                                {selected.description}
                                            </p>
                                        )}
                                    </section>
                                )}

                                <EventOperations
                                    // key={selected.slug}
                                    slug={selected.slug}
                                    role={selected.role}
                                />
                            </article>
                        ) : (
                            <section className="rounded-2xl border border-slate-200 bg-white p-6">
                                <h2 className="font-semibold text-slate-950">Event unavailable</h2>
                                <p className="mt-2 text-sm text-slate-600">
                                    This event could not be found among your assignments.
                                </p>
                            </section>
                        )}
                    </div>
                )}


                {view === "create" && canCreateEvents && <CreateEventForm onCreated={created} />}
            </main>
        </div>
    );
}