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

  listAssignedEvents(tx: DbClient, staffId: string) {
    return tx.event.findMany({
      where: { staffAssignments: { some: { staffId } } },
      select: { name: true, slug: true, venue: true, startsAt: true },
      orderBy: [{ startsAt: 'asc' }, { slug: 'asc' }],
    });
  }

  async lockAssignment(tx: DbClient, staffId: string, slug: string) {
    const [assignment] = await tx.$queryRaw<{ eventId: string }[]>`
      SELECT a.event_id AS "eventId"
      FROM event_staff_assignments a
      JOIN events e ON e.id = a.event_id
      WHERE e.slug = ${slug} AND a.staff_id = ${staffId}::uuid
      FOR SHARE OF a, e
    `;
    return assignment;
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
  deleteSession(tokenHash: string) {
    return this.db.staffSession.deleteMany({
      where: { tokenHash },
    });
  }
}
