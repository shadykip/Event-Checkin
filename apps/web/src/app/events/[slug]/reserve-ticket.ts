"use server";

import type { Attendee } from "../../ticket-quantity";

type Receipt = {
  id: string;
  tierName?: string;
  peoplePerTicket: number;
  amountMinor: number;
  currency: string;
  expiresAt: string;
};

type Result = { receipt: Receipt } | { error: string };

export async function reserveTicket(
  slug: string,
  tierId: string,
  checkoutKey: string,
  guestName: string,
  guestEmail: string,
  attendees?: Attendee[],
): Promise<Result> {
  const base = process.env.API_BASE_URL;
  if (!base) throw new Error("API_BASE_URL is missing");

  const path = `/events/${encodeURIComponent(slug)}/ticket-tiers/${encodeURIComponent(tierId)}/reservations`;
  const response = await fetch(new URL(path, base), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      checkoutKey,
      guestName,
      guestEmail,
      quantity: attendees?.length ?? 1,
      attendees,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    return {
      error:
        response.status < 500 && typeof body?.message === "string"
          ? body.message
          : "Could not confirm the reservation. Retry with the same details.",
    };
  }

  const body = await response.json();
  const id = attendees ? body?.purchaseId : body?.id;
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ||
    (attendees && body.quantity !== attendees.length)
  ) {
    return {
      error:
        "Could not confirm the requested number of tickets. Retry with the same details.",
    };
  }
  return { receipt: { ...body, id } };
}
