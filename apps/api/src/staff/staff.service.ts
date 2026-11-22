import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

import type { Prisma, RsvpStatus } from '../generated/prisma/client';
import { parseGuestCsv, validateGuest } from './guest-import';
import { guestRosterCsv } from './guest-roster-csv';
import {
  sendInvitationEmail,
  sendPasswordResetEmail,
} from './invitation-mailer';
import { StaffRepository, type AdmissionStatus } from './staff.repository';
import { prepareEventBanner } from './event-banner';
import { parseEventDetails } from './event-details';

const sessionDurationMs = 8 * 60 * 60 * 1000;
const rosterPageSize = 25;

function isToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class StaffService {
  constructor(private readonly repository: StaffRepository) {}
  private readonly logger = new Logger(StaffService.name);

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

    const created = await this.repository.createSession(
      staff.id,
      staff.passwordHash,
      hashToken(token),
      expiresAt,
    );

    if (!created) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { name: staff.name, token, expiresAt };
  }

  async requestPasswordReset(rawEmail: unknown) {
    const email =
      typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

    if (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const token = randomBytes(32).toString('base64url');
      const account = await this.repository.issuePasswordReset(
        email,
        hashToken(token),
      );

      if (account) {
        // SMTP delivery time should not reveal whether an account exists.
        void sendPasswordResetEmail(account.email, token).catch(() => {
          this.logger.warn('Staff password reset email delivery failed.');
        });
      }
    }

    return {
      message:
        'If an active account matches that email, a password reset link will arrive shortly.',
    };
  }

  async resetPassword(rawToken: unknown, rawPassword: unknown) {
    const invalidLink =
      'This reset link is invalid or has expired. Request a new one.';

    if (!isToken(rawToken)) {
      throw new BadRequestException(invalidLink);
    }

    if (
      typeof rawPassword !== 'string' ||
      rawPassword.length < 8 ||
      rawPassword.length > 128
    ) {
      throw new BadRequestException('Use a password of 15 to 128 characters.');
    }

    const tokenHash = hashToken(rawToken);

    // Avoid an expensive password hash for an invalid or expired token.
    if (!(await this.repository.hasValidPasswordReset(tokenHash))) {
      throw new BadRequestException(invalidLink);
    }

    const passwordHash = await argon2.hash(rawPassword, {
      type: argon2.argon2id,
    });

    // Check validity again during the write so two submissions can only reset once.
    if (
      !(await this.repository.consumePasswordReset(tokenHash, passwordHash))
    ) {
      throw new BadRequestException(invalidLink);
    }

    return { message: 'Password updated. Sign in with your new password.' };
  }

  getDashboard(sessionToken: unknown) {
    return this.repository.transaction(async (tx) => {
      const staff = await this.requireStaff(tx, sessionToken);
      const events = await this.repository.listAssignedEvents(tx, staff.id);

      return {
        canCreateEvents: staff.canCreateEvents,
        events,
      };
    });
  }

  createEvent(
    sessionToken: unknown,
    rawName: unknown,
    rawVenue: unknown,
    rawStartsAt: unknown,
    rawDescription?: unknown,
    bannerFile?: Express.Multer.File,
    rawDescriptionHtml?: unknown,
  ) {
    return this.repository.transaction(async (tx) => {
      const staff = await this.requireStaff(tx, sessionToken);

      if (!staff.canCreateEvents) {
        throw new ForbiddenException(
          'Your account does not have permission to create events.',
        );
      }

      const details = parseEventDetails({
        name: rawName,
        venue: rawVenue,
        startsAt: rawStartsAt,
        description: rawDescription,
        descriptionHtml: rawDescriptionHtml,
      });

      const baseSlug = details.name
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '');

      if (!baseSlug) {
        throw new BadRequestException(
          'Include a letter or number in the event name.',
        );
      }

      const localDate = String(rawStartsAt).slice(0, 10);
      const bannerImage = await prepareEventBanner(bannerFile);

      const event = await this.repository.createAssignedEvent(tx, staff.id, {
        ...details,
        slug: `${baseSlug}-${localDate}`,
        bannerImage,
      });

      if (!event) {
        throw new ConflictException(
          'That event address is already in use for this date. Add a distinguishing detail to the name.',
        );
      }

      return event;
    });
  }

  updateEvent(
    sessionToken: unknown,
    slug: string,
    rawName: unknown,
    rawVenue: unknown,
    rawStartsAt: unknown,
    rawDescription?: unknown,
    bannerFile?: Express.Multer.File,
    rawDescriptionHtml?: unknown,
  ) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);

      const details = parseEventDetails({
        name: rawName,
        venue: rawVenue,
        startsAt: rawStartsAt,
        description: rawDescription,
        descriptionHtml: rawDescriptionHtml,
      });

      const bannerImage = await prepareEventBanner(bannerFile);

      return this.repository.updateEventDetails(
        tx,
        eventId,
        details,
        bannerImage,
      );
    });
  }

  getEventBanner(sessionToken: unknown, slug: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireAssignment(tx, sessionToken, slug);
      const banner = await this.repository.findEventBanner(tx, eventId);

      if (!banner) {
        throw new NotFoundException('This event has no banner.');
      }

      return Buffer.from(banner.image);
    });
  }

  private async requireStaff(tx: Prisma.TransactionClient, token: unknown) {
    if (!isToken(token)) {
      throw new UnauthorizedException('Sign in required');
    }

    const staff = await this.repository.findActiveSession(tx, hashToken(token));

    if (!staff) {
      throw new UnauthorizedException('Sign in required');
    }

    return staff;
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

  issueInvitation(
    sessionToken: unknown,
    slug: string,
    rawName: unknown,
    rawEmail: unknown,
  ) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      const { guestName, guestEmail, error } = validateGuest(rawName, rawEmail);

      if (error) {
        throw new BadRequestException(error);
      }

      const token = randomBytes(32).toString('base64url');

      const invitation = await this.repository.insertInvitation(
        tx,
        eventId,
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
    rawAdmission: unknown,
  ): {
    query: string;
    rsvpStatus: RsvpStatus | undefined;
    admission: AdmissionStatus | undefined;
  } {
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

    if (
      rawAdmission !== undefined &&
      rawAdmission !== 'expected' &&
      rawAdmission !== 'checked_in' &&
      rawAdmission !== 'revoked'
    ) {
      throw new BadRequestException(
        'Admission must be expected, checked_in or revoked.',
      );
    }

    return {
      query: typeof rawQuery === 'string' ? rawQuery.trim() : '',
      rsvpStatus: rawRsvp,
      admission: rawAdmission,
    };
  }

  listInvitations(
    sessionToken: unknown,
    slug: string,
    rawPage: unknown,
    rawQuery?: unknown,
    rawRsvp?: unknown,
    rawAdmission?: unknown,
  ) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      const { query, rsvpStatus, admission } = this.rosterFilters(
        rawQuery,
        rawRsvp,
        rawAdmission,
      );

      const pageText = rawPage === undefined ? '1' : rawPage;

      if (typeof pageText !== 'string' || !/^[1-9]\d*$/.test(pageText)) {
        throw new BadRequestException('Page must be a positive integer.');
      }

      const page = Number(pageText);
      const skip = (page - 1) * rosterPageSize;

      if (!Number.isSafeInteger(skip) || skip > 2_147_483_647) {
        throw new BadRequestException('Page is too large.');
      }

      // The extra row indicates whether the filtered roster has another page.
      const rows = await this.repository.listInvitations(
        tx,
        eventId,
        skip,
        rosterPageSize + 1,
        query,
        rsvpStatus,
        admission,
      );

      const items = rows.slice(0, rosterPageSize).map((row) => {
        const checkIn = row.checkIns[0];
        let status: AdmissionStatus = 'expected';

        if (checkIn) {
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
          checkedInAt: checkIn?.checkedInAt ?? null,
          status,
        };
      });

      // The summary cards show all active invitations for the event.
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
        pageSize: rosterPageSize,
        hasNextPage: rows.length > rosterPageSize,
        rsvpSummary,
      };
    });
  }

  async exportInvitations(
    sessionToken: unknown,
    slug: string,
    rawQuery?: unknown,
    rawRsvp?: unknown,
    rawAdmission?: unknown,
  ) {
    const guests = await this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      const { query, rsvpStatus, admission } = this.rosterFilters(
        rawQuery,
        rawRsvp,
        rawAdmission,
      );

      return this.repository.listInvitations(
        tx,
        eventId,
        0,
        undefined,
        query,
        rsvpStatus,
        admission,
      );
    });

    return guestRosterCsv(guests);
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

      if (!invitation) {
        throw new NotFoundException('Pass unavailable for this event');
      }

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

  async emailInvitation(
    sessionToken: unknown,
    slug: string,
    rawToken: unknown,
  ) {
    const delivery = await this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);

      if (!isToken(rawToken)) {
        throw new BadRequestException('Invalid invitation token.');
      }

      const invitation = await this.repository.findInvitationForEmail(
        tx,
        eventId,
        hashToken(rawToken),
      );

      if (!invitation) {
        throw new NotFoundException('This pass is unavailable for this event.');
      }

      return { invitation, token: rawToken };
    });

    await sendInvitationEmail(delivery.invitation, delivery.token);
    return { accepted: true };
  }

  getEventTeam(sessionToken: unknown, slug: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      return this.repository.listEventTeam(tx, eventId);
    });
  }

  assignDoorStaff(sessionToken: unknown, slug: string, rawEmail: unknown) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      const email =
        typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('Enter a valid staff email address.');
      }

      const staff = await this.repository.findActiveStaffByEmail(tx, email);

      if (!staff) {
        throw new NotFoundException(
          'No active staff account was found for that email address.',
        );
      }

      const result = await this.repository.assignDoorStaff(
        tx,
        eventId,
        staff.id,
      );

      return {
        message:
          result.count === 1
            ? 'Door staff assigned to this event.'
            : 'This staff member is already assigned to this event.',
        members: await this.repository.listEventTeam(tx, eventId),
      };
    });
  }

  removeDoorStaff(sessionToken: unknown, slug: string, staffId: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      const result = await this.repository.removeDoorStaff(
        tx,
        eventId,
        staffId,
      );

      if (result.count === 0) {
        throw new NotFoundException(
          'No removable door-staff assignment was found for this event.',
        );
      }

      return {
        message: 'Door staff removed from this event.',
        members: await this.repository.listEventTeam(tx, eventId),
      };
    });
  }

  async logout(sessionToken: unknown): Promise<void> {
    if (isToken(sessionToken)) {
      await this.repository.deleteSession(hashToken(sessionToken));
    }
  }
}
