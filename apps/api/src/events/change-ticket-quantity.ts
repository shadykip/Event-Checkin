import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import {
  canEditQuantity,
  maximumQuantity,
  type PaymentBooking,
} from './payment-booking';
import { inventoryTime } from './ticket-inventory';
import { MAX_TICKETS_PER_PURCHASE } from './ticket-purchase-quote';
import { validateAttendeeRows } from './ticket-purchase-reservation';

function count(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_TICKETS_PER_PURCHASE
  ) {
    throw new BadRequestException(
      `Choose between 1 and ${MAX_TICKETS_PER_PURCHASE} tickets.`,
    );
  }
  return value;
}

// The caller holds the tier lock and the checkout lock for this transaction.
export async function changeTicketQuantity(
  tx: Prisma.TransactionClient,
  booking: PaymentBooking,
  key: string,
  previous: unknown,
  target: unknown,
  added: unknown,
) {
  const previousQuantity = count(previous);
  const quantity = count(target);
  const now = await inventoryTime(tx);
  if (!canEditQuantity(booking, now)) {
    throw new ConflictException(
      'Quantity can only change on an active individual-ticket reservation before payment starts.',
    );
  }
  if (
    !Array.isArray(added) ||
    added.length !== Math.max(0, quantity - previousQuantity)
  ) {
    throw new BadRequestException(
      'Provide a name and email for each additional ticket.',
    );
  }
  const guests = validateAttendeeRows(added, previousQuantity + 1);
  if (quantity === booking.quantity) {
    // Replaying an acknowledged or interrupted save must never add tickets twice.
    if (
      guests.every((guest, i) => {
        const saved = booking.tickets[previousQuantity + i];
        return (
          saved?.guestName === guest.guestName &&
          saved.guestEmail === guest.guestEmail
        );
      })
    )
      return;
  }
  if (previousQuantity !== booking.quantity) {
    throw new ConflictException(
      'This booking changed. Refresh checkout to see its current tickets.',
    );
  }
  const maximum = await maximumQuantity(tx, booking, now);
  if (quantity > maximum) {
    throw new ConflictException(
      `This booking can currently hold at most ${maximum} ${maximum === 1 ? 'ticket' : 'tickets'}.`,
    );
  }
  if (guests.length) {
    const emails = [...booking.tickets, ...guests].map(
      (guest) => guest.guestEmail,
    );
    if (new Set(emails).size !== emails.length) {
      throw new BadRequestException(
        'Use a different attendee email for each ticket.',
      );
    }
    const invited = await tx.invitation.findFirst({
      where: {
        eventId: booking.tier.eventId,
        guestEmail: { in: guests.map((g) => g.guestEmail) },
      },
      select: { id: true },
    });
    if (invited)
      throw new ConflictException(
        'An attendee already has an invitation for this event.',
      );
  }

  const total = { quantity, amountMinor: booking.unitAmountMinor * quantity };
  if (booking.kind === 'order') {
    await tx.ticketPurchase.create({
      data: {
        id: booking.id,
        tierId: booking.tierId,
        checkoutKey: key,
        buyerName: booking.buyerName,
        buyerEmail: booking.buyerEmail,
        peoplePerTicket: 1,
        unitAmountMinor: booking.unitAmountMinor,
        currency: booking.currency,
        expiresAt: booking.expiresAt,
        ...total,
      },
    });
    await tx.ticketOrder.update({
      where: { id: booking.id },
      data: { checkoutKey: null, purchaseId: booking.id, ticketNumber: 1 },
    });
  } else {
    await tx.ticketPurchase.update({ where: { id: booking.id }, data: total });
  }
  if (quantity < previousQuantity) {
    await tx.ticketOrder.deleteMany({
      where: { purchaseId: booking.id, ticketNumber: { gt: quantity } },
    });
  } else {
    await tx.ticketOrder.createMany({
      data: guests.map((guest, i) => ({
        ...guest,
        purchaseId: booking.id,
        ticketNumber: previousQuantity + i + 1,
        tierId: booking.tierId,
        tierName: booking.tierName,
        peoplePerTicket: 1,
        amountMinor: booking.unitAmountMinor,
        currency: booking.currency,
        expiresAt: booking.expiresAt,
      })),
    });
  }
}
