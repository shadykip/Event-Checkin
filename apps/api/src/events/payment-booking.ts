import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { committedTickets } from './ticket-inventory';
import { MAX_TICKETS_PER_PURCHASE } from './ticket-purchase-quote';

type Tx = Prisma.TransactionClient;

const paymentFields = {
  id: true,
  tierId: true,
  peoplePerTicket: true,
  amountMinor: true,
  currency: true,
  expiresAt: true,
  paymentStartedAt: true,
  checkoutUrl: true,
  paidAt: true,
  paymentReview: true,
  reviewResolution: true,
  tier: {
    select: {
      eventId: true,
      capacity: true,
      priceMinor: true,
      currency: true,
      peoplePerTicket: true,
      archived: true,
      salesStartAt: true,
      salesEndAt: true,
      event: { select: { startsAt: true, slug: true } },
    },
  },
} as const;

const ticketFields = {
  id: true,
  tierName: true,
  guestName: true,
  guestEmail: true,
  invitation: { select: { revokedAt: true, tokenHash: true } },
} as const;

export function checkoutKey(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new NotFoundException('Order unavailable.');
  }
  return value;
}

export async function findBooking(db: Tx, id: string, key?: string) {
  const where = { id, checkoutKey: key };
  const order = await db.ticketOrder.findFirst({
    where: { ...where, purchaseId: null },
    select: { ...paymentFields, ...ticketFields },
  });
  if (order) {
    return {
      ...order,
      kind: 'order' as const,
      buyerName: order.guestName,
      buyerEmail: order.guestEmail,
      quantity: 1,
      unitAmountMinor: order.amountMinor,
      tickets: [order],
    };
  }
  const purchase = await db.ticketPurchase.findFirst({
    where,
    select: {
      ...paymentFields,
      buyerName: true,
      buyerEmail: true,
      quantity: true,
      unitAmountMinor: true,
      orders: { orderBy: { ticketNumber: 'asc' }, select: ticketFields },
    },
  });
  if (!purchase) return null;
  const { orders: tickets, ...details } = purchase;
  if (!tickets.length || tickets.length !== purchase.quantity) {
    throw new ConflictException(
      'Ticket records are incomplete. Contact the organizer.',
    );
  }
  return {
    ...details,
    kind: 'purchase' as const,
    tierName: tickets[0].tierName,
    tickets,
  };
}

export type PaymentBooking = NonNullable<
  Awaited<ReturnType<typeof findBooking>>
>;

export async function lockedBooking(tx: Tx, id: string, key?: string) {
  // The checkout keeps its public ID when a standalone hold becomes a purchase.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${id.toLowerCase()}::text, 0))`;
  const result = await findBooking(tx, id, key);
  if (!result) throw new NotFoundException('Order unavailable.');
  return result;
}

export function canEditQuantity(booking: PaymentBooking, now: Date) {
  return (
    booking.peoplePerTicket === 1 &&
    booking.expiresAt > now &&
    !booking.paymentStartedAt &&
    !booking.checkoutUrl &&
    !booking.paidAt &&
    !booking.paymentReview
  );
}

export async function maximumQuantity(
  db: Tx,
  booking: PaymentBooking,
  now: Date,
) {
  const { tier, quantity, unitAmountMinor } = booking;
  if (
    tier.archived ||
    tier.event.startsAt <= now ||
    tier.priceMinor !== unitAmountMinor ||
    tier.currency !== booking.currency ||
    tier.peoplePerTicket !== 1 ||
    (tier.salesStartAt && tier.salesStartAt > now) ||
    (tier.salesEndAt && tier.salesEndAt <= now)
  ) {
    return quantity;
  }
  const committed = await committedTickets(db, booking.tierId, now);
  return Math.min(
    MAX_TICKETS_PER_PURCHASE,
    Math.floor(2_147_483_647 / unitAmountMinor),
    quantity + Math.max(0, tier.capacity - committed),
  );
}
