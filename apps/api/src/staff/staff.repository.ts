import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma, type RsvpStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { parseTicketTier } from './ticket-tier-input';

import {
  committedTickets,
  inventoryTime,
  lockTicketTier,
} from '../events/ticket-inventory';

type DbClient = Prisma.TransactionClient;

export type AdmissionStatus = 'expected' | 'checked_in' | 'revoked';

const admissionConditions: Record<
  AdmissionStatus,
  Prisma.InvitationWhereInput
> = {
  expected: {
    revokedAt: null,
    checkIns: { none: {} },
  },
  checked_in: {
    checkIns: { some: {} },
  },
  revoked: {
    revokedAt: { not: null },
    checkIns: { none: {} },
  },
};

@Injectable()
export class StaffRepository {
  constructor(private readonly db: PrismaService) {}

  findAccountByEmail(email: string) {
    return this.db.staffAccount.findUnique({
      where: { email },
      select: { id: true, name: true, isActive: true, passwordHash: true },
    });
  }

  createSession(
    staffId: string,
    verifiedPasswordHash: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.transaction(async (tx) => {
      const [account] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM staff_accounts
      WHERE id = ${staffId}::uuid
        AND password_hash = ${verifiedPasswordHash}
        AND is_active
      FOR SHARE
    `;

      if (!account) return false;

      await tx.staffSession.create({
        data: { staffId, tokenHash, expiresAt },
      });

      return true;
    });
  }

  transaction<T>(work: (tx: DbClient) => Promise<T>) {
    return this.db.$transaction(work, { isolationLevel: 'ReadCommitted' });
  }
  async getAttendance(tx: DbClient, eventId: string) {
    const [totals] = await tx.$queryRaw<
      { checkedIn: number; expected: number }[]
    >`
    WITH balances AS (
      SELECT i.revoked_at,
             COALESCE(o.people_per_ticket, 1) AS capacity,
             COALESCE(
               (
                 SELECT MAX(b.admitted_after)
                 FROM admission_batches b
                 WHERE b.invitation_id = i.id
               ),
               CASE WHEN c.invitation_id IS NULL THEN 0 ELSE 1 END
             ) AS admitted
      FROM invitations i
      LEFT JOIN check_ins c ON c.invitation_id = i.id
      LEFT JOIN ticket_orders o ON o.invitation_id = i.id
      WHERE i.event_id = ${eventId}::uuid
    )
    SELECT COALESCE(SUM(admitted), 0)::float8 AS "checkedIn",
           COALESCE(SUM(capacity - admitted)
             FILTER (WHERE revoked_at IS NULL), 0)::float8 AS "expected"
    FROM balances
  `;

    return totals;
  }

  async findActiveSession(tx: DbClient, tokenHash: string) {
    const [staff] = await tx.$queryRaw<
      { id: string; canCreateEvents: boolean }[]
    >`
    SELECT
      s.id,
      s.can_create_events AS "canCreateEvents"
    FROM staff_sessions ss
    JOIN staff_accounts s ON s.id = ss.staff_id
    WHERE ss.token_hash = ${tokenHash}
      AND ss.expires_at > clock_timestamp()
      AND s.is_active
    FOR SHARE OF ss, s
  `;

    return staff;
  }

  async createAssignedEvent(
    tx: DbClient,
    staffId: string,
    input: {
      name: string;
      slug: string;
      venue: string;
      startsAt: Date;
      description?: string | null;
      descriptionHtml?: string | null;
      bannerImage?: Uint8Array<ArrayBuffer>;
    },
  ) {
    const { bannerImage, ...eventData } = input;

    const inserted = await tx.event.createMany({
      data: [eventData],
      skipDuplicates: true,
    });

    if (inserted.count === 0) return null;

    const event = await tx.event.findUniqueOrThrow({
      where: { slug: input.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        venue: true,
        startsAt: true,
        description: true,
        descriptionHtml: true,
      },
    });

    if (bannerImage) {
      await tx.eventBanner.create({
        data: {
          eventId: event.id,
          image: bannerImage,
        },
        select: { eventId: true },
      });
    }

    const assignment = await tx.eventStaffAssignment.create({
      data: {
        eventId: event.id,
        staffId,
        role: 'ORGANIZER',
      },
      select: { role: true },
    });

    return {
      name: event.name,
      slug: event.slug,
      venue: event.venue,
      startsAt: event.startsAt,
      role: assignment.role,
      description: event.description,
      descriptionHtml: event.descriptionHtml,
      hasBanner: Boolean(bannerImage),
    };
  }

  async listAssignedEvents(tx: DbClient, staffId: string) {
    const assignments = await tx.eventStaffAssignment.findMany({
      where: { staffId },
      select: {
        role: true,
        event: {
          select: {
            name: true,
            slug: true,
            venue: true,
            startsAt: true,
            description: true,
            descriptionHtml: true,
            banner: {
              select: { eventId: true },
            },
          },
        },
      },
      orderBy: [{ event: { startsAt: 'asc' } }, { event: { slug: 'asc' } }],
    });

    return assignments.map(({ event, role }) => {
      const { banner, ...details } = event;

      return {
        ...details,
        role,
        hasBanner: banner !== null,
      };
    });
  }
  async listEventTeam(tx: DbClient, eventId: string) {
    const rows = await tx.eventStaffAssignment.findMany({
      where: { eventId },
      select: {
        role: true,
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ staff: { name: 'asc' } }, { staffId: 'asc' }],
    });

    return rows.map(({ staff, role }) => ({ ...staff, role }));
  }

  findActiveStaffByEmail(tx: DbClient, email: string) {
    return tx.staffAccount.findFirst({
      where: { email, isActive: true },
      select: { id: true },
    });
  }

  assignDoorStaff(tx: DbClient, eventId: string, staffId: string) {
    return tx.eventStaffAssignment.createMany({
      data: [{ eventId, staffId, role: 'DOOR_STAFF' }],
      skipDuplicates: true,
    });
  }

  removeDoorStaff(tx: DbClient, eventId: string, staffId: string) {
    return tx.eventStaffAssignment.deleteMany({
      where: { eventId, staffId, role: 'DOOR_STAFF' },
    });
  }

  async updateEventDetails(
    tx: DbClient,
    eventId: string,
    details: {
      name: string;
      venue: string;
      startsAt: Date;
      description: string | null;
      descriptionHtml: string | null;
    },
    bannerImage?: Uint8Array<ArrayBuffer>,
  ) {
    const event = await tx.event.update({
      where: { id: eventId },
      data: details,
      select: {
        name: true,
        slug: true,
        venue: true,
        startsAt: true,
        description: true,
        descriptionHtml: true,
      },
    });

    if (bannerImage) {
      await tx.eventBanner.upsert({
        where: { eventId },
        create: { eventId, image: bannerImage },
        update: { image: bannerImage },
        select: { eventId: true },
      });
    }

    const banner = await tx.eventBanner.findUnique({
      where: { eventId },
      select: { eventId: true },
    });

    return {
      ...event,
      hasBanner: banner !== null,
      role: 'ORGANIZER' as const,
    };
  }

  findEventBanner(tx: DbClient, eventId: string) {
    return tx.eventBanner.findUnique({
      where: { eventId },
      select: { image: true },
    });
  }

  listInvitations(
    tx: DbClient,
    eventId: string,
    skip: number,
    take: number | undefined,
    query = '',
    rsvpStatus?: RsvpStatus,
    admission?: AdmissionStatus,
  ) {
    const term = query.replace(/[\\%_]/g, '\\$&');

    return tx.invitation.findMany({
      where: {
        eventId,
        ...(admission ? admissionConditions[admission] : {}),
        ...(rsvpStatus && { rsvpStatus }),
        ...(term
          ? {
              OR: [
                { guestName: { contains: term, mode: 'insensitive' as const } },
                {
                  guestEmail: { contains: term, mode: 'insensitive' as const },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        guestName: true,
        guestEmail: true,
        rsvpStatus: true,
        createdAt: true,
        revokedAt: true,
        checkIns: {
          select: { checkedInAt: true },
        },
        ticketOrder: { select: { paidAt: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
  }

  findInvitedEmails(tx: DbClient, eventId: string, guestEmails: string[]) {
    return tx.invitation.findMany({
      where: {
        eventId,
        guestEmail: { in: guestEmails, mode: 'insensitive' },
      },
      select: { guestEmail: true },
    });
  }

  async lockAssignment(tx: DbClient, staffId: string, slug: string) {
    const [assignment] = await tx.$queryRaw<
      { eventId: string; role: 'DOOR_STAFF' | 'ORGANIZER' }[]
    >`
    SELECT a.event_id AS "eventId", a.role::text AS role
    FROM event_staff_assignments a
    JOIN events e ON e.id = a.event_id
    WHERE e.slug = ${slug}
      AND a.staff_id = ${staffId}::uuid
    FOR SHARE OF a, e
  `;

    return assignment;
  }

  async insertInvitation(
    tx: DbClient,
    eventId: string,
    guestName: string,
    guestEmail: string,
    tokenHash: string,
  ) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO invitations (id, event_id, guest_name, guest_email, token_hash)
    VALUES (
      gen_random_uuid(),
      ${eventId}::uuid,
      ${guestName},
      ${guestEmail},
      ${tokenHash}
    )
    ON CONFLICT (event_id, guest_email) DO NOTHING
    RETURNING id
  `;

    return rows[0];
  }

  async lockValidInvitation(tx: DbClient, eventId: string, tokenHash: string) {
    const [invitation] = await tx.$queryRaw<
      {
        id: string;
        guestName: string;
        ticketTier: string | null;
        capacity: number;
      }[]
    >`
    SELECT i.id,
           i.guest_name AS "guestName",
           o.tier_name AS "ticketTier",
           COALESCE(o.people_per_ticket, 1) AS capacity
    FROM invitations i
    LEFT JOIN ticket_orders o ON o.invitation_id = i.id
    WHERE i.event_id = ${eventId}::uuid
      AND i.token_hash = ${tokenHash}
      AND i.revoked_at IS NULL
    FOR UPDATE OF i
  `;

    return invitation;
  }

  async recordAdmission(tx: DbClient, invitationId: string, staffId: string) {
    const inserted = await tx.checkIn.createMany({
      data: { invitationId, staffId },
      skipDuplicates: true,
    });

    const admission = await tx.checkIn.findUniqueOrThrow({
      where: { invitationId },
      select: {
        checkedInAt: true,
        staff: { select: { name: true } },
      },
    });

    return {
      created: inserted.count === 1,
      checkedInAt: admission.checkedInAt,
      checkedInBy: admission.staff.name,
    };
  }

  async replacePassHash(
    tx: DbClient,
    eventId: string,
    invitationId: string,
    tokenHash: string,
  ): Promise<'replaced' | 'missing' | 'unavailable'> {
    const [invitation] = await tx.$queryRaw<
      { id: string; revokedAt: Date | null }[]
    >`
      SELECT id, revoked_at AS "revokedAt"
      FROM invitations
      WHERE id = ${invitationId}::uuid
        AND event_id = ${eventId}::uuid
      FOR UPDATE
    `;

    if (!invitation) return 'missing';
    if (invitation.revokedAt) return 'unavailable';

    const admission = await tx.checkIn.findUnique({
      where: { invitationId },
      select: { invitationId: true },
    });

    if (admission) return 'unavailable';

    await tx.invitation.update({
      where: { id: invitationId },
      data: { tokenHash },
    });

    return 'replaced';
  }

  async revokeInvitation(tx: DbClient, eventId: string, invitationId: string) {
    const [invitation] = await tx.$queryRaw<{ id: string; revokedAt: Date }[]>`
    UPDATE invitations
    SET revoked_at = COALESCE(revoked_at, clock_timestamp())
    WHERE id = ${invitationId}::uuid
      AND event_id = ${eventId}::uuid
    RETURNING id, revoked_at AS "revokedAt"
  `;

    return invitation;
  }

  countActiveInvitationsByRsvp(tx: DbClient, eventId: string) {
    return tx.invitation.groupBy({
      by: ['rsvpStatus'],
      where: { eventId, revokedAt: null },
      _count: { _all: true },
    });
  }

  findInvitationForEmail(tx: DbClient, eventId: string, tokenHash: string) {
    return tx.invitation.findFirst({
      where: {
        eventId,
        tokenHash,
        revokedAt: null,
      },
      select: {
        guestName: true,
        guestEmail: true,
        event: {
          select: { name: true, venue: true, startsAt: true },
        },
      },
    });
  }
  async issuePasswordReset(email: string, tokenHash: string) {
    const [account] = await this.db.$queryRaw<{ email: string }[]>`
    UPDATE staff_accounts
    SET reset_token_hash = ${tokenHash},
        reset_expires_at = clock_timestamp() + interval '30 minutes',
        reset_requested_at = clock_timestamp()
    WHERE email = ${email}
      AND is_active
      AND (
        reset_requested_at IS NULL
        OR reset_requested_at <= clock_timestamp() - interval '60 seconds'
      )
    RETURNING email
  `;

    return account;
  }

  async hasValidPasswordReset(tokenHash: string) {
    const [result] = await this.db.$queryRaw<{ valid: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM staff_accounts
      WHERE reset_token_hash = ${tokenHash}
        AND reset_expires_at > clock_timestamp()
        AND is_active
    ) AS valid
  `;

    return result.valid;
  }

  consumePasswordReset(tokenHash: string, passwordHash: string) {
    return this.transaction(async (tx) => {
      const [account] = await tx.$queryRaw<{ id: string }[]>`
      UPDATE staff_accounts
      SET password_hash = ${passwordHash},
          reset_token_hash = NULL,
          reset_expires_at = NULL
      WHERE reset_token_hash = ${tokenHash}
        AND reset_expires_at > clock_timestamp()
        AND is_active
      RETURNING id
    `;

      if (!account) return false;

      await tx.staffSession.deleteMany({
        where: { staffId: account.id },
      });

      return true;
    });
  }

  getTicketAllocation(tx: DbClient, eventId: string) {
    return tx.ticketAllocation.findUnique({
      where: { eventId },
      select: { capacity: true },
    });
  }

  async admissionBalance(tx: DbClient, invitationId: string) {
    const latest = await tx.admissionBatch.findFirst({
      where: { invitationId },
      orderBy: { admittedAfter: 'desc' },
      select: {
        admittedAfter: true,
        checkedInAt: true,
        staff: { select: { name: true } },
      },
    });

    if (latest) {
      return {
        admitted: latest.admittedAfter,
        checkedInAt: latest.checkedInAt,
        checkedInBy: latest.staff.name,
      };
    }

    const first = await tx.checkIn.findUnique({
      where: { invitationId },
      select: { checkedInAt: true, staff: { select: { name: true } } },
    });

    return {
      admitted: first ? 1 : 0,
      checkedInAt: first?.checkedInAt ?? null,
      checkedInBy: first?.staff.name ?? null,
    };
  }

  findAdmissionBatch(tx: DbClient, invitationId: string, requestId: string) {
    return tx.admissionBatch.findUnique({
      where: { invitationId_requestId: { invitationId, requestId } },
      include: { staff: { select: { name: true } } },
    });
  }

  async addAdmissionBatch(
    tx: DbClient,
    invitationId: string,
    staffId: string,
    requestId: string,
    quantity: number,
    admittedAfter: number,
  ) {
    await tx.checkIn.createMany({
      data: [{ invitationId, staffId }],
      skipDuplicates: true,
    });

    return tx.admissionBatch.create({
      data: { invitationId, staffId, requestId, quantity, admittedAfter },
      include: { staff: { select: { name: true } } },
    });
  }

  saveTicketAllocation(tx: DbClient, eventId: string, capacity: number) {
    return tx.ticketAllocation.upsert({
      where: { eventId },
      create: { eventId, capacity },
      update: { capacity },
      select: { capacity: true },
    });
  }
  deleteSession(tokenHash: string) {
    return this.db.staffSession.deleteMany({
      where: { tokenHash },
    });
  }

  // Ticket tiers
  listTicketTiers(tx: DbClient, eventId: string) {
    type TierRow = Pick<
      Prisma.TicketTierGetPayload<object>,
      | 'id'
      | 'name'
      | 'priceMinor'
      | 'peoplePerTicket'
      | 'currency'
      | 'capacity'
      | 'salesStartAt'
      | 'salesEndAt'
      | 'archived'
      | 'version'
    > & {
      sold: number;
      reserved: number;
      available: number;
      grossMinor: string;
      admitted: number;
      admissionsRemaining: number;
    };

    return tx.$queryRaw<TierRow[]>`
      SELECT
        t.id,
        t.name,
        t.price_minor AS "priceMinor",
        t.people_per_ticket AS "peoplePerTicket",
        t.currency,
        t.capacity,
        t.sales_start_at AS "salesStartAt",
        t.sales_end_at AS "salesEndAt",
        t.archived,
        t.version,
        stats.sold::integer AS sold,
        stats.reserved::integer AS reserved,
        CASE
          WHEN t.archived
            OR t.price_minor <= 0
            OR e.starts_at <= statement_timestamp()
            OR t.sales_start_at > statement_timestamp()
            OR t.sales_end_at <= statement_timestamp()
          THEN 0
          ELSE GREATEST(0, t.capacity - stats.sold - stats.reserved)
        END::integer AS available,
        stats.gross_minor::text AS "grossMinor",
        stats.admitted::double precision AS admitted,
        stats.remaining::double precision AS "admissionsRemaining"
      FROM ticket_tiers t
      JOIN events e ON e.id = t.event_id
      CROSS JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE o.paid_at IS NOT NULL) AS sold,
          COUNT(*) FILTER (WHERE o.paid_at IS NULL) AS reserved,
          COALESCE(
            SUM(o.amount_minor) FILTER (WHERE o.paid_at IS NOT NULL), 0
          ) AS gross_minor,
          COALESCE(
            SUM(balance.used) FILTER (WHERE o.paid_at IS NOT NULL), 0
          ) AS admitted,
          COALESCE(
            SUM(GREATEST(0, o.people_per_ticket - balance.used))
              FILTER (
                WHERE o.paid_at IS NOT NULL
                  AND i.id IS NOT NULL
                  AND i.revoked_at IS NULL
              ),
            0
          ) AS remaining
        FROM ticket_orders o
        LEFT JOIN invitations i ON i.id = o.invitation_id
        LEFT JOIN check_ins c ON c.invitation_id = i.id
        CROSS JOIN LATERAL (
          SELECT COALESCE(
            (
              SELECT b.admitted_after
              FROM admission_batches b
              WHERE b.invitation_id = i.id
              ORDER BY b.admitted_after DESC
              LIMIT 1
            ),
            CASE WHEN c.invitation_id IS NULL THEN 0 ELSE 1 END
          ) AS used
        ) balance
        WHERE o.tier_id = t.id
          AND (o.paid_at IS NOT NULL OR o.expires_at > statement_timestamp())
      ) stats
      WHERE t.event_id = ${eventId}::uuid
      ORDER BY t.archived, t.price_minor, t.name, t.id
    `;
  }

  createTicketTier(
    tx: DbClient,
    eventId: string,
    data: ReturnType<typeof parseTicketTier>,
  ) {
    return tx.ticketTier.create({
      data: { eventId, ...data },
      select: { id: true },
    });
  }

  async updateTicketTier(
    tx: DbClient,
    eventId: string,
    id: string,
    version: number,
    data: ReturnType<typeof parseTicketTier>,
  ) {
    const found = await lockTicketTier(tx, eventId, id);
    if (!found) return { count: 0 };

    const now = await inventoryTime(tx);
    const committed = await committedTickets(tx, id, now);

    if (data.capacity < committed) {
      throw new ConflictException(
        `Capacity must cover the ${committed} paid or currently reserved tickets.`,
      );
    }

    return tx.ticketTier.updateMany({
      where: { id, eventId, version },
      data: { ...data, version: { increment: 1 } },
    });
  }
}
