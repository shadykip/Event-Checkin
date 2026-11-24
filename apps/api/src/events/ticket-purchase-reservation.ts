import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma, TicketTier } from '../generated/prisma/client';
import { validateGuest } from '../staff/guest-import';
import {
  MAX_TICKETS_PER_PURCHASE,
  quoteTicketPurchase,
  TicketPurchaseInputError,
} from './ticket-purchase-quote';

export type TicketGuest = { guestName: string; guestEmail: string };

export function reservationAttendees(
  quantity: unknown = 1,
  rows?: unknown,
): TicketGuest[] | undefined {
  if (quantity === 1 && rows === undefined) return undefined;
  if (
    !Array.isArray(rows) ||
    rows.length < 2 ||
    rows.length > MAX_TICKETS_PER_PURCHASE ||
    rows.length !== quantity
  ) {
    throw new BadRequestException(
      `For 2–${MAX_TICKETS_PER_PURCHASE} tickets, provide one attendee per ticket and a matching numeric quantity.`,
    );
  }

  return validateAttendeeRows(rows);
}

export function validateAttendeeRows(rows: unknown[], firstTicket = 1): TicketGuest[] {
  const emails = new Set<string>();
  return Array.from(rows, (row: unknown, index) => {
    const entry = row as { guestName?: unknown; guestEmail?: unknown } | null;
    const { guestName, guestEmail, error } = validateGuest(entry?.guestName, entry?.guestEmail);
    if (error) throw new BadRequestException(`Ticket ${index + firstTicket}: ${error}`);
    if (emails.has(guestEmail)) {
      throw new BadRequestException('Use a different attendee email for each ticket.');
    }
    emails.add(guestEmail);
    return { guestName, guestEmail };
  });
}

export type Reservation = TicketGuest & {
  slug: string;
  tierId: string;
  checkoutKey: string;
  attendees?: TicketGuest[];
};

const purchaseReceipt = {
  id: true,
  quantity: true,
  unitAmountMinor: true,
  amountMinor: true,
  currency: true,
  peoplePerTicket: true,
  expiresAt: true,
} as const;

export async function existingPurchase(
  tx: Prisma.TransactionClient,
  input: Reservation,
  now: Date,
) {
  const { tierId, checkoutKey, attendees } = input;
  const purchase = await tx.ticketPurchase.findUnique({
    where: { tierId_checkoutKey: { tierId, checkoutKey } },
    select: {
      ...purchaseReceipt,
      buyerName: true,
      buyerEmail: true,
      orders: {
        orderBy: { ticketNumber: 'asc' },
        select: { guestName: true, guestEmail: true, paidAt: true, paymentReview: true },
      },
    },
  });
  if (!purchase) return null;

  const { id, buyerName, buyerEmail, orders, ...summary } = purchase;
  if (
    !attendees ||
    buyerName !== input.guestName ||
    buyerEmail !== input.guestEmail ||
    attendees.length !== summary.quantity ||
    attendees.length !== orders.length ||
    orders.some((order, index) => {
      const attendee = attendees[index];
      return order.guestName !== attendee?.guestName || order.guestEmail !== attendee?.guestEmail;
    })
  ) {
    throw new ConflictException('This checkout key belongs to a different request.');
  }
  if (orders.some((order) => order.paidAt || order.paymentReview)) {
    throw new ConflictException('Check the payment status for this purchase.');
  }
  if (summary.expiresAt <= now) {
    throw new ConflictException('Reservation expired. Start a new reservation.');
  }
  return { purchaseId: id, ...summary };
}

export async function holdPurchase(
  tx: Prisma.TransactionClient,
  input: Reservation,
  tier: TicketTier,
  expiresAt: Date,
  available: number,
) {
  const { attendees } = input;
  if (!attendees) return null;

  let quote: ReturnType<typeof quoteTicketPurchase>;
  try {
    quote = quoteTicketPurchase({
      quantity: attendees.length,
      unitAmountMinor: tier.priceMinor,
      peoplePerTicket: tier.peoplePerTicket,
    });
  } catch (error) {
    if (error instanceof TicketPurchaseInputError) throw new BadRequestException(error.message);
    throw error;
  }
  if (quote.quantity > available) {
    const stock = available === 1 ? 'ticket remains' : 'tickets remain';
    throw new ConflictException(`Only ${available} ${stock}.`);
  }

  const invited = await tx.invitation.findFirst({
    where: {
      eventId: tier.eventId,
      guestEmail: { in: attendees.map((guest) => guest.guestEmail) },
    },
    select: { id: true },
  });
  if (invited) throw new ConflictException('An attendee already has an invitation for this event.');

  const { id, ...summary } = await tx.ticketPurchase.create({
    data: {
      ...quote,
      tierId: tier.id,
      checkoutKey: input.checkoutKey,
      currency: tier.currency,
      expiresAt,
      buyerName: input.guestName,
      buyerEmail: input.guestEmail,
      orders: {
        createMany: {
          data: attendees.map((guest, index) => ({
            ...guest,
            ticketNumber: index + 1,
            tierName: tier.name,
            peoplePerTicket: quote.peoplePerTicket,
            amountMinor: quote.unitAmountMinor,
            currency: tier.currency,
            expiresAt,
          })),
        },
      },
    },
    select: purchaseReceipt,
  });
  return { purchaseId: id, ...summary };
}
