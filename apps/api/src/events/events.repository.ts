import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { presentPublicTier, publicTicketSelect } from './public-ticket-options';

const publicFields = (now: Date) =>
  ({
    id: true,
    name: true,
    slug: true,
    venue: true,
    startsAt: true,
    banner: { select: { eventId: true } },
    ticketTiers: {
      where: { archived: false, priceMinor: { gt: 0 } },
      select: publicTicketSelect(now),
      orderBy: [{ priceMinor: 'asc' }, { id: 'asc' }],
    },
    ticketAllocation: { select: { capacity: true } },
    _count: {
      select: {
        invitations: {
          where: { isPublicTicket: true, revokedAt: null },
        },
      },
    },
  }) satisfies Prisma.EventSelect;

type AvailabilityRow = {
  startsAt: Date;
  ticketAllocation: { capacity: number } | null;
  _count: { invitations: number };
  banner: { eventId: string } | null;
  ticketTiers: Parameters<typeof presentPublicTier>[0][];
};

function presentEvent<T extends AvailabilityRow>(row: T, now: Date) {
  const { ticketAllocation, _count, banner, ticketTiers, ...event } = row;
  const capacity = ticketAllocation?.capacity ?? 0;
  const remaining = Math.max(0, capacity - _count.invitations);

  let ticketStatus: 'closed' | 'available' | 'sold_out' = 'closed';

  if (capacity > 0 && row.startsAt > now) {
    ticketStatus = remaining > 0 ? 'available' : 'sold_out';
  }

  return {
    ...event,
    hasBanner: banner !== null,
    ticketStatus,
    ticketTiers: ticketTiers.map((tier) =>
      presentPublicTier(tier, row.startsAt, now),
    ),
  };
}

@Injectable()
export class EventsRepository {
  constructor(private readonly db: PrismaService) {}

  async list() {
    const now = new Date();
    const events = await this.db.event.findMany({
      select: publicFields(now),
      orderBy: [{ startsAt: 'asc' }, { slug: 'asc' }],
    });

    return events.map((event) => presentEvent(event, now));
  }

  async findBySlug(slug: string) {
    const now = new Date();
    const event = await this.db.event.findUnique({
      where: { slug },
      select: {
        ...publicFields(now),
        description: true,
        descriptionHtml: true,
      },
    });

    return event ? presentEvent(event, now) : null;
  }

  findBanner(slug: string) {
    return this.db.eventBanner.findFirst({
      where: { event: { slug } },
      select: { image: true },
    });
  }

  claim(
    slug: string,
    guestName: string,
    guestEmail: string,
    tokenHash: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        // Claims for the same allocation take turns before counting seats.
        const [allocation] = await tx.$queryRaw<
          { eventId: string; capacity: number; startsAt: Date }[]
        >`
        SELECT a.event_id AS "eventId", a.capacity, e.starts_at AS "startsAt"
        FROM ticket_allocations a
        JOIN events e ON e.id = a.event_id
        WHERE e.slug = ${slug}
        FOR UPDATE OF a
      `;

        if (
          !allocation ||
          allocation.capacity <= 0 ||
          allocation.startsAt.getTime() <= Date.now()
        ) {
          return 'closed' as const;
        }

        const used = await tx.invitation.count({
          where: {
            eventId: allocation.eventId,
            isPublicTicket: true,
            revokedAt: null,
          },
        });

        if (used >= allocation.capacity) return 'sold_out' as const;

        const inserted = await tx.invitation.createMany({
          data: [
            {
              eventId: allocation.eventId,
              guestName,
              guestEmail,
              tokenHash,
              isPublicTicket: true,
              rsvpStatus: 'ACCEPTED',
            },
          ],
          skipDuplicates: true,
        });

        return inserted.count === 1
          ? ('issued' as const)
          : ('duplicate' as const);
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }
}
