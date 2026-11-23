import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { presentPublicTier, publicTicketSelect } from './public-ticket-options';
import {
  committedTickets,
  inventoryTime,
  lockTicketTier,
} from './ticket-inventory';

const HOLD_MS = 15 * 60 * 1000;

const receipt = {
  id: true,
  tierName: true,
  peoplePerTicket: true,
  amountMinor: true,
  currency: true,
  expiresAt: true,
} as const;

type Reservation = {
  slug: string;
  tierId: string;
  checkoutKey: string;
  guestName: string;
  guestEmail: string;
};

@Injectable()
export class TicketCheckoutRepository {
  constructor(private readonly db: PrismaService) {}

  async list(slug: string) {
    const now = new Date();
    const event = await this.db.event.findUnique({
      where: { slug },
      select: {
        startsAt: true,
        ticketTiers: {
          where: { archived: false, priceMinor: { gt: 0 } },
          select: publicTicketSelect(now),
          orderBy: [{ priceMinor: 'asc' }, { id: 'asc' }],
        },
      },
    });

    // Keep the existing endpoint limited to tiers whose sales window is open.
    return event
      ? event.ticketTiers
          .map((tier) => presentPublicTier(tier, event.startsAt, now))
          .filter(
            (tier) => tier.status === 'available' || tier.status === 'sold_out',
          )
      : [];
  }

  reserve(input: Reservation) {
    return this.db.$transaction(
      async (tx) => {
        const event = await tx.event.findUnique({
          where: { slug: input.slug },
          select: { id: true, startsAt: true },
        });

        if (!event || !(await lockTicketTier(tx, event.id, input.tierId))) {
          throw new NotFoundException('Ticket tier unavailable.');
        }

        const now = await inventoryTime(tx);
        const previous = await tx.ticketOrder.findUnique({
          where: {
            tierId_checkoutKey: {
              tierId: input.tierId,
              checkoutKey: input.checkoutKey,
            },
          },
          select: {
            ...receipt,
            guestName: true,
            guestEmail: true,
            paidAt: true,
          },
        });

        if (previous) {
          if (
            previous.guestName !== input.guestName ||
            previous.guestEmail !== input.guestEmail
          ) {
            throw new ConflictException(
              'This checkout key belongs to a different request.',
            );
          }
          if (previous.paidAt)
            throw new ConflictException('Order already paid.');
          if (previous.expiresAt <= now) {
            throw new ConflictException(
              'Reservation expired. Start a new reservation.',
            );
          }

          return {
            id: previous.id,
            tierName: previous.tierName,
            peoplePerTicket: previous.peoplePerTicket,
            amountMinor: previous.amountMinor,
            currency: previous.currency,
            expiresAt: previous.expiresAt,
          };
        }

        const tier = await tx.ticketTier.findUniqueOrThrow({
          where: { id: input.tierId },
        });

        if (
          tier.archived ||
          tier.priceMinor <= 0 ||
          event.startsAt <= now ||
          (tier.salesStartAt && tier.salesStartAt > now) ||
          (tier.salesEndAt && tier.salesEndAt <= now)
        ) {
          throw new ConflictException('Sales are closed for this ticket tier.');
        }

        const committed = await committedTickets(tx, tier.id, now);
        if (committed >= tier.capacity) {
          throw new ConflictException(
            'All tickets in this tier are paid or currently reserved.',
          );
        }

        const expiresAt = new Date(
          Math.min(
            now.getTime() + HOLD_MS,
            event.startsAt.getTime(),
            tier.salesEndAt?.getTime() ?? Infinity,
          ),
        );

        return tx.ticketOrder.create({
          data: {
            tierId: tier.id,
            checkoutKey: input.checkoutKey,
            guestName: input.guestName,
            guestEmail: input.guestEmail,
            tierName: tier.name,
            peoplePerTicket: tier.peoplePerTicket,
            amountMinor: tier.priceMinor,
            currency: tier.currency,
            expiresAt,
          },
          select: receipt,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
