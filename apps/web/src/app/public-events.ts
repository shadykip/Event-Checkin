export type PublicTier = {
  id: string;
  name: string;
  priceMinor: number;
  peoplePerTicket: number;
  currency: string;
  status: "available" | "sold_out" | "upcoming" | "closed";
  remaining: number;
  salesStartAt: string | null;
};

export type PublicEvent = {
  id: string;
  name: string;
  slug: string;
  venue: string;
  startsAt: string;
  hasBanner: boolean;
  ticketStatus: "closed" | "available" | "sold_out";
  ticketTiers: PublicTier[];
};

export const eventDate = new Intl.DateTimeFormat("en-KE", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Nairobi",
});

export const eventTime = new Intl.DateTimeFormat("en-KE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

export function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function admissions(people: number) {
  return people === 1 ? "Admits 1 person" : `Admits up to ${people} people`;
}

export function ticketSummary(event: PublicEvent) {
  const paid = event.ticketTiers.filter((tier) => tier.status === "available");
  const free = event.ticketStatus === "available";
  const cheapest = paid[0];

  if (free && cheapest) return { label: "Free & paid tickets", open: true };
  if (free) return { label: "Free admission", open: true };
  if (cheapest) {
    return {
      label: `From ${money(cheapest.priceMinor, cheapest.currency)}`,
      open: true,
    };
  }
  if (event.ticketTiers.some((tier) => tier.status === "upcoming")) {
    return { label: "Tickets opening soon", open: false };
  }
  if (
    event.ticketStatus === "sold_out" ||
    event.ticketTiers.some((tier) => tier.status === "sold_out")
  ) {
    return { label: "Sold out", open: false };
  }
  return { label: "Registration closed", open: false };
}
