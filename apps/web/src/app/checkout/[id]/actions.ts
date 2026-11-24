"use server";

import type { Attendee } from "../../ticket-quantity";

type OrderStatus = {
  state: "reserved" | "expired" | "review" | "paid" | "pass_changed";
  tierName: string;
  eventSlug: string;
  quantity: number;
  maxQuantity?: number;
  unitAmountMinor: number;
  peoplePerTicket: number;
  amountMinor: number;
  currency: string;
  expiresAt: string;
  passPath?: string;
  passes?: { ticketNumber: number; guestName: string; passPath?: string }[];
};

async function request<T>(
  id: string,
  action: "start" | "status" | "quantity",
  key: string,
  details: Record<string, unknown>,
): Promise<{ data: T } | { error: string }> {
  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^[a-f0-9-]{36}$/i.test(key)) {
    return { error: "Invalid checkout details." };
  }

  try {
    const response = await fetch(
      new URL(`/payments/orders/${id}/${action}`, process.env.API_BASE_URL),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...details }),
        cache: "no-store",
      },
    );
    const body = await response.json();
    if (!response.ok) {
      return {
        error:
          typeof body.message === "string"
            ? body.message
            : "Checkout unavailable.",
      };
    }
    return { data: body as T };
  } catch {
    return { error: "Could not reach checkout. Try again." };
  }
}

export async function startPayment(
  id: string,
  key: string,
  expectedAmountMinor: number,
) {
  return request<{ url: string }>(id, "start", key, { expectedAmountMinor });
}

export async function readPayment(id: string, key: string, verify: boolean) {
  return request<OrderStatus>(id, "status", key, { verify });
}

export async function saveTicketQuantity(
  id: string,
  key: string,
  previousQuantity: number,
  quantity: number,
  additionalAttendees: Attendee[],
) {
  return request<OrderStatus>(id, "quantity", key, {
    previousQuantity,
    quantity,
    additionalAttendees,
  });
}
