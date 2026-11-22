import { Injectable } from '@nestjs/common';
import { Prisma, type RsvpStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  createSession(staffId: string, tokenHash: string, expiresAt: Date) {
    return this.db.staffSession.create({
      data: { staffId, tokenHash, expiresAt },
      select: { staffId: true },
    });
  }

  transaction<T>(work: (tx: DbClient) => Promise<T>) {
    return this.db.$transaction(work, { isolationLevel: 'ReadCommitted' });
  }
  async getAttendance(tx: DbClient, eventId: string) {
    const [totals] = await tx.$queryRaw<
      { checkedIn: number; expected: number }[]
    >`
    SELECT
      count(c.invitation_id)::integer AS "checkedIn",
      (count(*) FILTER (
        WHERE c.invitation_id IS NULL AND i.revoked_at IS NULL
      ))::integer AS "expected"
    FROM invitations i
    LEFT JOIN check_ins c ON c.invitation_id = i.id
    WHERE i.event_id = ${eventId}::uuid
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
      { id: string; guestName: string }[]
    >`
      SELECT id, guest_name AS "guestName"
      FROM invitations
      WHERE event_id = ${eventId}::uuid
        AND token_hash = ${tokenHash}
        AND revoked_at IS NULL
      FOR UPDATE
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

  deleteSession(tokenHash: string) {
    return this.db.staffSession.deleteMany({
      where: { tokenHash },
    });
  }
}
