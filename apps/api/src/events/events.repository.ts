import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const publicFields = {
  id: true,
  name: true,
  slug: true,
  venue: true,
  startsAt: true,
  ticketAllocation: { select: { capacity: true } },
  _count: {
    select: {
      invitations: {
        where: { isPublicTicket: true, revokedAt: null },
      },
    },
  },
} as const;

type AvailabilityRow = {
  startsAt: Date;
  ticketAllocation: { capacity: number } | null;
  _count: { invitations: number };
};

function presentEvent<T extends AvailabilityRow>(row: T) {
  const { ticketAllocation, _count, ...event } = row;
  const capacity = ticketAllocation?.capacity ?? 0;
  const remaining = Math.max(0, capacity - _count.invitations);

  let ticketStatus: 'closed' | 'available' | 'sold_out' = 'closed';

  if (capacity > 0 && row.startsAt.getTime() > Date.now()) {
    ticketStatus = remaining > 0 ? 'available' : 'sold_out';
  }

  return { ...event, ticketStatus };
}

@Injectable()
export class EventsRepository {
  constructor(private readonly db: PrismaService) {}

  async list() {
    const events = await this.db.event.findMany({
      select: publicFields,
      orderBy: [{ startsAt: 'asc' }, { slug: 'asc' }],
    });

    return events.map((event) => presentEvent(event));
  }

  async findBySlug(slug: string) {
    const event = await this.db.event.findUnique({
      where: { slug },
      select: {
        ...publicFields,
        description: true,
        descriptionHtml: true,
      },
    });

    return event ? presentEvent(event) : null;
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
