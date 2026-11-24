import type { Prisma } from '../generated/prisma/client';

// Public availability uses the same paid orders and live holds as reservations.
export function publicTicketSelect(now: Date) {
  return {
    id: true,
    name: true,
    peoplePerTicket: true,
    priceMinor: true,
    currency: true,
    capacity: true,
    salesStartAt: true,
    salesEndAt: true,
    _count: {
      select: {
        orders: {
          where: {
            OR: [{ paidAt: { not: null } }, { expiresAt: { gt: now } }],
          },
        },
      },
    },
  } satisfies Prisma.TicketTierSelect;
}

type TierRow = {
  id: string;
  name: string;
  peoplePerTicket: number;
  priceMinor: number;
  currency: string;
  capacity: number;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  _count: { orders: number };
};

export function presentPublicTier(tier: TierRow, startsAt: Date, now: Date) {
  const remaining = Math.max(0, tier.capacity - tier._count.orders);
  let status: 'available' | 'sold_out' | 'upcoming' | 'closed' = 'available';

  if (startsAt <= now || (tier.salesEndAt && tier.salesEndAt <= now)) {
    status = 'closed';
  } else if (tier.salesStartAt && tier.salesStartAt > now) {
    status = 'upcoming';
  } else if (remaining === 0) {
    status = 'sold_out';
  }

  return {
    id: tier.id,
    name: tier.name,
    peoplePerTicket: tier.peoplePerTicket,
    priceMinor: tier.priceMinor,
    currency: tier.currency,
    salesStartAt: tier.salesStartAt,
    status,
    remaining,
  };
}
