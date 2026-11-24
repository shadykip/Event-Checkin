"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import GuestRsvp, { type RsvpStatus } from "./guest-rsvp";
import AddToCalendar from "./add-to-calendar";
import { admissions } from "../public-events";


type Invitation = {
  guestName: string;
  rsvpStatus: RsvpStatus;
  ticket: {
    name: string;
    peoplePerTicket: number;
  };
  event: {
    id: string;
    name: string;
    venue: string;
    startsAt: string;
  };
};

type View =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ready"; invitation: Invitation; token: string };

const eventDate = new Intl.DateTimeFormat("en-KE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

export default function GuestPassPage() {
  const [view, setView] = useState<View>({ status: "loading" });

  const pageTitle =
    view.status === "ready"
      ? `${view.invitation.event.name} – Guest Pass`
      : "Guest Pass – Event Check-in";

  useEffect(() => {
    const previousTitle = document.title;
    document.title = pageTitle;

    return () => {
      if (document.title === pageTitle) {
        document.title = previousTitle;
      }
    };
  }, [pageTitle]);

  useEffect(() => {
    let activeRequest: AbortController | undefined;

    async function loadInvitation() {
      activeRequest?.abort();
      const controller = new AbortController();
      activeRequest = controller;

      const token = window.location.hash.slice(1);
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        setView({ status: "unavailable" });
        return;
      }

      setView({ status: "loading" });
      try {
        const response = await fetch("/api/invitations/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          cache: "no-store",
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        if (response.status === 404) {
          setView({ status: "unavailable" });
          return;
        }
        if (!response.ok) throw new Error("Lookup failed");

        const invitation: Invitation = await response.json();
        if (!controller.signal.aborted) {
          setView({ status: "ready", invitation, token });
        }
      } catch {
        if (!controller.signal.aborted) setView({ status: "error" });
      }
    }

    void loadInvitation();
    window.addEventListener("hashchange", loadInvitation);
    return () => {
      activeRequest?.abort();
      window.removeEventListener("hashchange", loadInvitation);
    };
  }, []);

  if (view.status !== "ready") {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
        <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Guest pass</h1>

          <p role="status" className="mt-3 text-sm leading-6 text-slate-600">
            {view.status === "loading" && "Opening your invitation…"}
            {view.status === "unavailable" &&
              "This invitation is unavailable. Check your link or ask the organizer for your current pass."}
            {view.status === "error" &&
              "We couldn’t reach the event service. Check your connection and try again."}
          </p>

          {view.status === "error" && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 min-h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Try again
            </button>
          )}
        </section>
      </main>
    );
  }

  const { invitation, token } = view;
  const { event } = invitation;

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 text-slate-950 sm:px-6 sm:py-12 print:min-h-0 print:bg-white print:p-0 print:text-black">
      <article
        aria-labelledby="pass-event-name"
        className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid print:rounded-none print:border-0 print:shadow-none"
      >
        <header className="bg-slate-950 px-5 py-5 text-white sm:px-8 sm:py-7 print:border-b print:border-slate-300 print:bg-white print:px-0 print:text-black">
          <p className="text-sm font-medium text-teal-200 print:text-black">
            Guest pass
          </p>
          <h1
            id="pass-event-name"
            className="mt-1 break-words text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
          >
            {event.name}
          </h1>
          <p className="mt-3 break-words text-base text-slate-200 print:text-black">
            Issued to{" "}
            <strong className="font-semibold text-white print:text-black">
              {invitation.guestName}
            </strong>
          </p>
        </header>

        <div className="grid sm:grid-cols-2 print:grid-cols-2">
          <figure className="flex flex-col items-center justify-center border-b border-dashed border-slate-300 bg-white px-4 py-4 text-center sm:border-r sm:border-b-0 sm:py-6 print:break-inside-avoid print:border-r print:border-b-0">
            <QRCodeSVG
              value={token}
              size={224}
              level="M"
              marginSize={4}
              bgColor="#ffffff"
              fgColor="#000000"
              title="Guest check-in QR code"
              className="block h-auto w-56 max-w-full"
            />
            <figcaption className="mt-1 text-sm text-slate-700">
              Show this code at the entrance.
            </figcaption>
          </figure>

          <section
            aria-label="Event details"
            className="flex flex-col justify-center px-5 py-5 sm:px-7 sm:py-6"
          >
            <dl className="space-y-5">
              <div>
                <dt className="text-sm font-medium text-slate-600">
                  Ticket type
                </dt>
                <dd className="mt-1 break-words font-semibold leading-6">
                  {invitation.ticket.name}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-slate-600">
                  Admission allowance
                </dt>
                <dd className="mt-1 font-semibold leading-6">
                  {admissions(invitation.ticket.peoplePerTicket)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">
                  Date and time
                </dt>
                <dd className="mt-1 font-semibold leading-6">
                  <time dateTime={event.startsAt}>
                    {eventDate.format(new Date(event.startsAt))}
                  </time>
                  <span className="block text-sm font-normal text-slate-600">
                    Nairobi time
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Venue</dt>
                <dd className="mt-1 break-words font-semibold leading-6">
                  {event.venue}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="border-t border-slate-200 px-5 pb-5 sm:px-8 sm:pb-7 print:hidden">
          <GuestRsvp
            key={token}
            token={token}
            initialStatus={invitation.rsvpStatus}
            onUnavailable={() => setView({ status: "unavailable" })}
          />

          <div className="mt-5 flex flex-wrap items-end gap-x-3 border-t border-slate-200">
            <AddToCalendar event={event} />

            <button
              type="button"
              onClick={() => window.print()}
              className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Print pass
            </button>
          </div>
        </div>
      </article>
    </main>
  );

}
