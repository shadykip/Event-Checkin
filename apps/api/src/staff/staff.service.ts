import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Prisma } from '../generated/prisma/client';
import { StaffRepository } from './staff.repository';
import { guestRosterCsv } from './guest-roster-csv';
import type { RsvpStatus } from '../generated/prisma/client';
import { parseGuestCsv, validateGuest } from './guest-import';

const sessionDurationMs = 8 * 60 * 60 * 1000;

function isToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class StaffService {
  constructor(private readonly repository: StaffRepository) {}

  async login(email: unknown, password: unknown) {
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !password
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const staff = await this.repository.findAccountByEmail(
      email.trim().toLowerCase(),
    );

    if (
      !staff?.isActive ||
      !(await argon2.verify(staff.passwordHash, password))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + sessionDurationMs);
    await this.repository.createSession(staff.id, hashToken(token), expiresAt);

    return { name: staff.name, token, expiresAt };
  }

  private async requireStaff(tx: Prisma.TransactionClient, token: unknown) {
    if (!isToken(token)) {
      throw new UnauthorizedException('Sign in required');
    }

    const staff = await this.repository.findActiveSession(tx, hashToken(token));
    if (!staff) throw new UnauthorizedException('Sign in required');
    return staff;
  }

  listEvents(sessionToken: unknown) {
    return this.repository.transaction(async (tx) => {
      const staff = await this.requireStaff(tx, sessionToken);
      return this.repository.listAssignedEvents(tx, staff.id);
    });
  }
  getAttendance(sessionToken: unknown, slug: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireAssignment(tx, sessionToken, slug);
      return this.repository.getAttendance(tx, eventId);
    });
  }

  private async requireAssignment(
    tx: Prisma.TransactionClient,
    sessionToken: unknown,
    slug: string,
  ) {
    const staff = await this.requireStaff(tx, sessionToken);
    const assignment = await this.repository.lockAssignment(tx, staff.id, slug);

    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this event');
    }

    return {
      staffId: staff.id,
      eventId: assignment.eventId,
      role: assignment.role,
    };
  }

  issueInvitation(
    sessionToken: unknown,
    slug: string,
    rawName: unknown,
    rawEmail: unknown,
  ) {
    return this.repository.transaction(async (tx) => {
      const assignment = await this.requireOrganizer(tx, sessionToken, slug);

      const { guestName, guestEmail, error } = validateGuest(rawName, rawEmail);
      if (error) throw new BadRequestException(error);

      // const guestName = typeof rawName === 'string' ? rawName.trim() : '';
      // const guestEmail =
      //   typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

      // if (!guestName || guestName.length > 200) {
      //   throw new BadRequestException(
      //     'Enter a guest name of 1 to 200 characters.',
      //   );
      // }

      // if (
      //   guestEmail.length > 254 ||
      //   !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)
      // ) {
      //   throw new BadRequestException('Enter a valid guest email address.');
      // }

      const token = randomBytes(32).toString('base64url');

      const invitation = await this.repository.insertInvitation(
        tx,
        assignment.eventId,
        guestName,
        guestEmail,
        hashToken(token),
      );

      if (!invitation) {
        throw new ConflictException(
          'This guest already has an invitation for this event.',
        );
      }

      return {
        id: invitation.id,
        guestName,
        guestEmail,
        passPath: `/pass#${token}`,
      };
    });
  }

  previewGuestImport(sessionToken: unknown, slug: string, csv: unknown) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      const candidates = parseGuestCsv(csv);

      const emails = new Set(
        candidates
          .filter((guest) => !guest.error)
          .map((guest) => guest.guestEmail),
      );

      const existing = await this.repository.findInvitedEmails(tx, eventId, [
        ...emails,
      ]);

      const invited = new Set(
        existing.map((row) => row.guestEmail.toLowerCase()),
      );
      const firstRecord = new Map<string, number>();
      const summary = { ready: 0, invalid: 0, duplicate: 0, existing: 0 };

      const rows = candidates.map(
        ({ record, guestName, guestEmail, error }) => {
          let status: keyof typeof summary = 'ready';
          let message = 'Ready to invite';

          if (error) {
            status = 'invalid';
            message = error;
          } else {
            const previous = firstRecord.get(guestEmail);

            if (previous !== undefined) {
              status = 'duplicate';
              message = `Duplicate of record ${previous}`;
            } else {
              firstRecord.set(guestEmail, record);

              if (invited.has(guestEmail)) {
                status = 'existing';
                message = 'Already invited to this event';
              }
            }
          }

          summary[status] += 1;
          return { record, guestName, guestEmail, status, message };
        },
      );

      return { summary, rows };
    });
  }

  private rosterFilters(
    rawQuery: unknown,
    rawRsvp: unknown,
  ): { query: string; rsvpStatus: RsvpStatus | undefined } {
    if (
      rawQuery !== undefined &&
      (typeof rawQuery !== 'string' || rawQuery.length > 200)
    ) {
      throw new BadRequestException('Search must be at most 200 characters.');
    }

    if (
      rawRsvp !== undefined &&
      rawRsvp !== 'PENDING' &&
      rawRsvp !== 'ACCEPTED' &&
      rawRsvp !== 'DECLINED'
    ) {
      throw new BadRequestException(
        'RSVP must be PENDING, ACCEPTED or DECLINED.',
      );
    }

    return {
      query: typeof rawQuery === 'string' ? rawQuery.trim() : '',
      rsvpStatus: rawRsvp,
    };
  }

  listInvitations(
    sessionToken: unknown,
    slug: string,
    rawPage: unknown,
    rawQuery?: unknown,
    rsvp?: unknown,
  ) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);

      if (
        rawQuery !== undefined &&
        (typeof rawQuery !== 'string' || rawQuery.length > 200)
      ) {
        throw new BadRequestException('Search must be at most 200 characters.');
      }

      const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';

      if (
        rsvp !== undefined &&
        rsvp !== 'PENDING' &&
        rsvp !== 'ACCEPTED' &&
        rsvp !== 'DECLINED'
      ) {
        throw new BadRequestException(
          'RSVP must be PENDING, ACCEPTED or DECLINED.',
        );
      }

      const pageText = rawPage === undefined ? '1' : rawPage;
      if (typeof pageText !== 'string' || !/^[1-9]\d*$/.test(pageText)) {
        throw new BadRequestException('Page must be a positive integer.');
      }

      const page = Number(pageText);
      const pageSize = 25;
      const skip = (page - 1) * pageSize;

      if (!Number.isSafeInteger(skip) || skip > 2_147_483_647) {
        throw new BadRequestException('Page is too large.');
      }

      // One extra row tells the UI whether to enable Next.
      const rows = await this.repository.listInvitations(
        tx,
        eventId,
        skip,
        pageSize + 1,
        query,
        rsvp,
      );

      const items = rows.slice(0, pageSize).map((row) => {
        const admission = row.checkIns[0];

        let status: 'expected' | 'checked_in' | 'revoked' = 'expected';

        if (admission) {
          status = 'checked_in';
        } else if (row.revokedAt) {
          status = 'revoked';
        }

        return {
          id: row.id,
          guestName: row.guestName,
          guestEmail: row.guestEmail,
          rsvpStatus: row.rsvpStatus,
          invitedAt: row.createdAt,
          checkedInAt: admission?.checkedInAt ?? null,
          status,
        };
      });

      const counts = await this.repository.countActiveInvitationsByRsvp(
        tx,
        eventId,
      );

      const rsvpSummary = { ACCEPTED: 0, DECLINED: 0, PENDING: 0 };
      for (const row of counts) {
        rsvpSummary[row.rsvpStatus] = row._count._all;
      }

      return {
        items,
        page,
        pageSize,
        hasNextPage: rows.length > pageSize,
        rsvpSummary,
      };
    });
  }

  async exportInvitations(
    sessionToken: unknown,
    slug: string,
    rawQuery?: unknown,
    rawRsvp?: unknown,
  ) {
    const guests = await this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      const { query, rsvpStatus } = this.rosterFilters(rawQuery, rawRsvp);

      return this.repository.listInvitations(
        tx,
        eventId,
        0,
        undefined,
        query,
        rsvpStatus,
      );
    });

    return guestRosterCsv(guests);
  }

  private async requireOrganizer(
    tx: Prisma.TransactionClient,
    sessionToken: unknown,
    slug: string,
  ) {
    const assignment = await this.requireAssignment(tx, sessionToken, slug);

    if (assignment.role !== 'ORGANIZER') {
      throw new ForbiddenException(
        'Organizer access is required for this event.',
      );
    }

    return assignment;
  }

  checkIn(sessionToken: unknown, slug: string, passToken: string) {
    return this.repository.transaction(async (tx) => {
      const { staffId, eventId } = await this.requireAssignment(
        tx,
        sessionToken,
        slug,
      );

      const invitation = await this.repository.lockValidInvitation(
        tx,
        eventId,
        hashToken(passToken),
      );
      if (!invitation)
        throw new NotFoundException('Pass unavailable for this event');

      const admission = await this.repository.recordAdmission(
        tx,
        invitation.id,
        staffId,
      );

      return {
        status: admission.created ? 'checked_in' : 'already_checked_in',
        guestName: invitation.guestName,
        checkedInAt: admission.checkedInAt,
        checkedInBy: admission.checkedInBy,
      };
    });
  }

  replacePass(sessionToken: unknown, slug: string, invitationId: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      const token = randomBytes(32).toString('base64url');

      const result = await this.repository.replacePassHash(
        tx,
        eventId,
        invitationId,
        hashToken(token),
      );

      if (result === 'missing') {
        throw new NotFoundException('Invitation not found for this event.');
      }

      if (result === 'unavailable') {
        throw new ConflictException(
          'Only active passes for guests who have not checked in can be replaced.',
        );
      }

      return { passPath: `/pass#${token}` };
    });
  }

  revokeInvitation(sessionToken: unknown, slug: string, invitationId: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(invitationId)) {
        throw new BadRequestException('Invalid invitation ID.');
      }

      const invitation = await this.repository.revokeInvitation(
        tx,
        eventId,
        invitationId,
      );

      if (!invitation) {
        throw new NotFoundException('Invitation not found for this event.');
      }

      return invitation;
    });
  }
  async logout(sessionToken: unknown): Promise<void> {
    if (isToken(sessionToken)) {
      await this.repository.deleteSession(hashToken(sessionToken));
    }
  }
}
