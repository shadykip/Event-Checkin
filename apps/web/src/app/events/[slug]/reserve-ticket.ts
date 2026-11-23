"use server";

type Receipt = {
  id: string;
  tierName: string;
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
): Promise<Result> {
  const base = process.env.API_BASE_URL;
  if (!base) throw new Error("API_BASE_URL is missing");

  const path = `/events/${encodeURIComponent(slug)}/ticket-tiers/${encodeURIComponent(tierId)}/reservations`;
  const response = await fetch(new URL(path, base), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkoutKey, guestName, guestEmail }),
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

  return { receipt: (await response.json()) as Receipt };
}
