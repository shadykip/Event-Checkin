"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import GuestRsvp, { type RsvpStatus } from "./guest-rsvp";
import AddToCalendar from "./add-to-calendar";


type Invitation = {
  guestName: string;
  rsvpStatus: RsvpStatus;
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

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-14 text-stone-950">
      <article className="mx-auto max-w-lg rounded-xl border border-stone-200 bg-white p-7">
        <h1 className="text-2xl font-semibold">Your invitation</h1>

        <div aria-live="polite" className="mt-5">
          {view.status === "loading" && <p>Opening invitation…</p>}
          {view.status === "unavailable" && (
            <p>This invitation is unavailable. Check your link or contact the organizer.</p>
          )}
          {view.status === "error" && (
            <p>We couldn’t reach the event service. Refresh the page to try again.</p>
          )}
          {view.status === "ready" && (
            <>
              <h2 className="text-xl font-semibold">{view.invitation.event.name}</h2>
              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="text-sm text-stone-600">Guest</dt>
                  <dd>{view.invitation.guestName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-stone-600">Venue</dt>
                  <dd>{view.invitation.event.venue}</dd>
                </div>
                <div>
                  <dt className="text-sm text-stone-600">Date and time</dt>
                  <dd>
                    <time dateTime={view.invitation.event.startsAt}>
                      {eventDate.format(new Date(view.invitation.event.startsAt))}
                    </time>
                    {" · Nairobi time"}
                  </dd>
                </div>
              </dl>
              <AddToCalendar event={view.invitation.event} />

              <figure className="mt-7 border-t border-stone-200 pt-6 text-center">
                <QRCodeSVG
                  value={view.token}
                  size={224}
                  level="M"
                  marginSize={4}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  title="Guest check-in QR code"
                  className="mx-auto h-auto max-w-full"
                />
                <figcaption className="mt-3 text-sm text-stone-600">
                  Show this code to event staff at the entrance.
                </figcaption>
              </figure>

              <GuestRsvp
                key={view.token}
                token={view.token}
                initialStatus={view.invitation.rsvpStatus}
                onUnavailable={() => setView({ status: "unavailable" })}
              />
            </>
          )}
        </div>
      </article>
    </main>
  );
}
