import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type DbClient = Prisma.TransactionClient;

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
    const [staff] = await tx.$queryRaw<{ id: string }[]>`
      SELECT s.id
      FROM staff_sessions ss
      JOIN staff_accounts s ON s.id = ss.staff_id
      WHERE ss.token_hash = ${tokenHash}
        AND ss.expires_at > clock_timestamp()
        AND s.is_active
      FOR SHARE OF ss, s
    `;
    return staff;
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
          },
        },
      },
      orderBy: [{ event: { startsAt: 'asc' } }, { event: { slug: 'asc' } }],
    });

    return assignments.map(({ event, role }) => ({ ...event, role }));
  }

  listInvitations(
    tx: DbClient,
    eventId: string,
    skip: number,
    take: number,
    query = '',
  ) {
    const term = query.replace(/[\\%_]/g, '\\$&');

    return tx.invitation.findMany({
      where: {
        eventId,
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

  deleteSession(tokenHash: string) {
    return this.db.staffSession.deleteMany({
      where: { tokenHash },
    });
  }
}
