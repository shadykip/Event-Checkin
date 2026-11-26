import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
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
  sendStaffSetupEmail,
} from './invitation-mailer';
import { StaffRepository, type AdmissionStatus } from './staff.repository';
import { prepareEventBanner } from './event-banner';
import { parseEventDetails } from './event-details';
import { parseTicketTier, type TicketTierInput } from './ticket-tier-input';
import { TicketPaymentService } from '../events/ticket-payment.service';

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
  constructor(
    private readonly repository: StaffRepository,
    private readonly payments: TicketPaymentService,
  ) {}
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
          isPaidTicket: Boolean(row.ticketOrder?.paidAt),
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
  checkIn(
    sessionToken: unknown,
    slug: string,
    passToken: unknown,
    action?: unknown,
    quantity?: unknown,
    requestId?: unknown,
  ) {
    return this.repository.transaction(async (tx) => {
      const { staffId, eventId } = await this.requireAssignment(
        tx,
        sessionToken,
        slug,
      );

      if (!isToken(passToken)) {
        throw new NotFoundException('Pass unavailable for this event');
      }

      if (action !== undefined && action !== 'preview' && action !== 'admit') {
        throw new BadRequestException('Unknown check-in action.');
      }

      const pass = await this.repository.lockValidInvitation(
        tx,
        eventId,
        hashToken(passToken),
      );
      if (!pass) throw new NotFoundException('Pass unavailable for this event');

      const balance = await this.repository.admissionBalance(tx, pass.id);
      const remaining = pass.capacity - balance.admitted;
      const summary = {
        guestName: pass.guestName,
        ticketTier: pass.ticketTier,
        capacity: pass.capacity,
        ...balance,
        remaining,
      };

      if (action === 'preview') {
        return { ...summary, status: 'preview' };
      }

      // Keep older single-ticket clients and the existing two-gate test working.
      if (pass.capacity === 1) {
        if (quantity !== undefined && quantity !== 1) {
          throw new BadRequestException('This pass admits one person.');
        }

        const admission = await this.repository.recordAdmission(
          tx,
          pass.id,
          staffId,
        );
        return {
          ...summary,
          status: admission.created ? 'checked_in' : 'already_checked_in',
          admitted: 1,
          remaining: 0,
          quantity: admission.created ? 1 : 0,
          checkedInAt: admission.checkedInAt,
          checkedInBy: admission.checkedInBy,
        };
      }

      if (
        action !== 'admit' ||
        typeof quantity !== 'number' ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > pass.capacity ||
        typeof requestId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          requestId,
        )
      ) {
        throw new BadRequestException(
          'Confirm a group size and supply a valid request ID.',
        );
      }

      // Check retries before checking the remaining balance. The original
      // request may itself have used the final places.
      const prior = await this.repository.findAdmissionBatch(
        tx,
        pass.id,
        requestId,
      );
      if (prior) {
        if (prior.quantity !== quantity || prior.staffId !== staffId) {
          throw new ConflictException(
            'This request ID was already used for another admission.',
          );
        }
        return {
          ...summary,
          status: 'confirmation_replayed',
          quantity: prior.quantity,
          checkedInAt: prior.checkedInAt,
          checkedInBy: prior.staff.name,
        };
      }

      if (quantity > remaining) {
        throw new ConflictException(
          `Only ${remaining} places remain. View the pass again.`,
        );
      }

      const admitted = balance.admitted + quantity;
      const batch = await this.repository.addAdmissionBatch(
        tx,
        pass.id,
        staffId,
        requestId,
        quantity,
        admitted,
      );

      return {
        ...summary,
        status: 'checked_in',
        quantity,
        admitted,
        remaining: pass.capacity - admitted,
        checkedInAt: batch.checkedInAt,
        checkedInBy: batch.staff.name,
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

  async inviteDoorStaff(
    sessionToken: unknown,
    slug: string,
    rawName: unknown,
    rawEmail: unknown,
  ) {
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const email =
      typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

    if (!name || name.length > 120) {
      throw new BadRequestException(
        'Enter a staff name of up to 120 characters.',
      );
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid staff email address.');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const passwordHash = await argon2.hash(
      randomBytes(32).toString('base64url'),
      { type: argon2.argon2id },
    );

    const result = await this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { name: true },
      });

      const created = await tx.staffAccount.createMany({
        data: [
          {
            name,
            email,
            passwordHash,
            isActive: true,
            canCreateEvents: false,
            resetTokenHash: tokenHash,
            resetRequestedAt: new Date(),
            resetExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        ],
        skipDuplicates: true,
      });

      if (created.count !== 1) {
        throw new ConflictException(
          'A staff account already uses this email. Assign the existing account instead.',
        );
      }

      const account = await tx.staffAccount.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      });

      await tx.eventStaffAssignment.create({
        data: {
          eventId,
          staffId: account.id,
          role: 'DOOR_STAFF',
        },
      });

      return {
        eventName: event.name,
        members: await this.repository.listEventTeam(tx, eventId),
      };
    });

    try {
      await sendStaffSetupEmail(name, email, result.eventName, token);
      return {
        message: 'Door staff invited. Password setup email sent.',
        members: result.members,
      };
    } catch {
      this.logger.warn('Door staff setup email delivery failed.');
      return {
        message:
          'Door staff was created and assigned, but the setup email could not be sent. Ask them to use Forgot password.',
        members: result.members,
      };
    }
  }
  async resendDoorStaffSetup(
    sessionToken: unknown,
    slug: string,
    staffId: string,
  ) {
    const email = await this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);

      const assignment = await tx.eventStaffAssignment.findFirst({
        where: {
          eventId,
          staffId,
          role: 'DOOR_STAFF',
          staff: { isActive: true },
        },
        select: { staff: { select: { email: true } } },
      });

      if (!assignment) {
        throw new NotFoundException(
          'No active door staff assignment was found for this event.',
        );
      }

      return assignment.staff.email;
    });

    const token = randomBytes(32).toString('base64url');
    const account = await this.repository.issuePasswordReset(
      email,
      hashToken(token),
    );

    if (!account) {
      throw new BadRequestException(
        'A setup link cannot be sent right now. Please try again later.',
      );
    }

    try {
      await sendPasswordResetEmail(account.email, token);
    } catch {
      this.logger.warn('Door staff setup email delivery failed.');
      throw new ServiceUnavailableException(
        'The setup email could not be sent. Please try again.',
      );
    }

    return {
      message:
        'A new password setup link was emailed to the door staff member.',
    };
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

  getTicketAllocation(session: unknown, slug: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, session, slug);
      const allocation = await this.repository.getTicketAllocation(tx, eventId);
      return allocation ?? { capacity: 0 };
    });
  }

  saveTicketAllocation(session: unknown, slug: string, capacity: unknown) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, session, slug);

      if (
        typeof capacity !== 'number' ||
        !Number.isSafeInteger(capacity) ||
        capacity < 0 ||
        capacity > 100000
      ) {
        throw new BadRequestException(
          'Enter a whole number from 0 to 100,000.',
        );
      }

      return this.repository.saveTicketAllocation(tx, eventId, capacity);
    });
  }

  listTicketTiers(session: unknown, slug: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, session, slug);
      return this.repository.listTicketTiers(tx, eventId);
    });
  }

  async saveTicketTier(
    session: unknown,
    slug: string,
    input: TicketTierInput,
    tierId?: string,
  ) {
    try {
      return await this.repository.transaction(async (tx) => {
        const { eventId } = await this.requireOrganizer(tx, session, slug);

        if (!input || typeof input !== 'object' || Array.isArray(input)) {
          throw new BadRequestException('Enter the ticket details.');
        }

        const data = parseTicketTier(input);

        if (tierId) {
          const version = input.version;

          if (
            typeof version !== 'number' ||
            !Number.isSafeInteger(version) ||
            version < 1
          ) {
            throw new BadRequestException(
              'A valid ticket version is required.',
            );
          }

          const result = await this.repository.updateTicketTier(
            tx,
            eventId,
            tierId,
            version,
            data,
          );

          if (result.count !== 1) {
            throw new ConflictException(
              'This tier changed or is unavailable. Reload the tiers before editing.',
            );
          }
        } else {
          await this.repository.createTicketTier(tx, eventId, data);
        }

        return this.repository.listTicketTiers(tx, eventId);
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This event already has a tier with that name.',
        );
      }

      throw error;
    }
  }

  async resendPaidPass(
    sessionToken: unknown,
    slug: string,
    invitationId: string,
  ) {
    const order = await this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);
      return tx.ticketOrder.findFirst({
        where: {
          invitationId,
          paidAt: { not: null },
          tier: { eventId },
          invitation: { is: { revokedAt: null } },
        },
        select: { id: true },
      });
    });
    if (!order) {
      throw new NotFoundException('Paid pass unavailable for this event.');
    }
    return this.payments.resendCurrentPass(order.id);
  }

  listPaymentReviews(sessionToken: unknown, slug: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);

      const [purchases, individualOrders] = await Promise.all([
        tx.ticketPurchase.findMany({
          where: {
            tier: { eventId },
            paymentReview: { not: null },
            reviewResolvedAt: null,
          },
          select: {
            id: true,
            buyerName: true,
            buyerEmail: true,
            amountMinor: true,
            currency: true,
            paymentReview: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        tx.ticketOrder.findMany({
          where: {
            tier: { eventId },
            purchaseId: null,
            paymentReview: { not: null },
            reviewResolvedAt: null,
          },
          select: {
            id: true,
            guestName: true,
            guestEmail: true,
            amountMinor: true,
            currency: true,
            paymentReview: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

      const items = [
        ...purchases.map((purchase) => ({
          kind: 'purchase' as const,
          reference: `ticket-${purchase.id}`,
          name: purchase.buyerName,
          email: purchase.buyerEmail,
          amountMinor: purchase.amountMinor,
          currency: purchase.currency,
          reason: purchase.paymentReview,
          createdAt: purchase.createdAt,
        })),
        ...individualOrders.map((order) => ({
          kind: 'individual' as const,
          reference: `ticket-${order.id}`,
          name: order.guestName,
          email: order.guestEmail,
          amountMinor: order.amountMinor,
          currency: order.currency,
          reason: order.paymentReview,
          createdAt: order.createdAt,
        })),
      ]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 50);

      return { items };
    });
  }

  listResolvedPaymentReviews(sessionToken: unknown, slug: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);

      const [purchases, individualOrders] = await Promise.all([
        tx.ticketPurchase.findMany({
          where: {
            tier: { eventId },
            paymentReview: { not: null },
            reviewResolvedAt: { not: null },
          },
          select: {
            id: true,
            buyerName: true,
            amountMinor: true,
            currency: true,
            paymentReview: true,
            reviewResolution: true,
            reviewNote: true,
            reviewResolvedAt: true,
            reviewResolvedBy: true,
          },
          orderBy: { reviewResolvedAt: 'desc' },
          take: 50,
        }),
        tx.ticketOrder.findMany({
          where: {
            tier: { eventId },
            purchaseId: null,
            paymentReview: { not: null },
            reviewResolvedAt: { not: null },
          },
          select: {
            id: true,
            guestName: true,
            amountMinor: true,
            currency: true,
            paymentReview: true,
            reviewResolution: true,
            reviewNote: true,
            reviewResolvedAt: true,
            reviewResolvedBy: true,
          },
          orderBy: { reviewResolvedAt: 'desc' },
          take: 50,
        }),
      ]);

      const items = [
        ...purchases.map((row) => ({
          kind: 'purchase' as const,
          reference: `ticket-${row.id}`,
          name: row.buyerName,
          amountMinor: row.amountMinor,
          currency: row.currency,
          reason: row.paymentReview,
          resolution: row.reviewResolution,
          note: row.reviewNote,
          resolvedAt: row.reviewResolvedAt,
          resolvedBy: row.reviewResolvedBy,
        })),
        ...individualOrders.map((row) => ({
          kind: 'individual' as const,
          reference: `ticket-${row.id}`,
          name: row.guestName,
          amountMinor: row.amountMinor,
          currency: row.currency,
          reason: row.paymentReview,
          resolution: row.reviewResolution,
          note: row.reviewNote,
          resolvedAt: row.reviewResolvedAt,
          resolvedBy: row.reviewResolvedBy,
        })),
      ]
        .sort(
          (a, b) =>
            (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0),
        )
        .slice(0, 50);

      return { items };
    });
  }

  async inspectPaymentReview(
    sessionToken: unknown,
    slug: string,
    kind: 'purchase' | 'individual',
    id: string,
  ) {
    const booking = await this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);

      if (kind === 'purchase') {
        const purchase = await tx.ticketPurchase.findFirst({
          where: {
            id,
            tier: { eventId },
            paymentReview: { not: null },
          },
          select: {
            amountMinor: true,
            currency: true,
            paymentReview: true,
          },
        });

        return purchase;
      }

      return tx.ticketOrder.findFirst({
        where: {
          id,
          purchaseId: null,
          tier: { eventId },
          paymentReview: { not: null },
        },
        select: {
          amountMinor: true,
          currency: true,
          paymentReview: true,
        },
      });
    });

    if (!booking) {
      throw new NotFoundException('Payment review unavailable.');
    }

    // Contact Paystack after the authorization query has completed.
    const provider = await this.payments.inspectProviderPayment(id);

    return {
      reference: `ticket-${id}`,
      reviewReason: booking.paymentReview,
      expectedAmountMinor: booking.amountMinor,
      expectedCurrency: booking.currency,
      provider,
      matches: {
        reference: provider.reference === `ticket-${id}`,
        amount: provider.amountMinor === booking.amountMinor,
        currency: provider.currency === booking.currency,
      },
    };
  }
  async resolveReversedPaymentReview(
    sessionToken: unknown,
    slug: string,
    kind: 'purchase' | 'individual',
    id: string,
  ) {
    const inspection = await this.inspectPaymentReview(
      sessionToken,
      slug,
      kind,
      id,
    );

    if (
      inspection.provider.status !== 'reversed' ||
      !inspection.matches.reference ||
      !inspection.matches.amount ||
      !inspection.matches.currency
    ) {
      throw new ConflictException(
        'Paystack has not confirmed a matching reversed transaction.',
      );
    }

    const processedRefunds = inspection.provider.refunds.filter(
      (refund) =>
        refund.status === 'processed' &&
        refund.currency === inspection.expectedCurrency &&
        Number.isSafeInteger(refund.amountMinor) &&
        refund.amountMinor > 0,
    );

    const processedAmount = processedRefunds.reduce(
      (total, refund) => total + refund.amountMinor,
      0,
    );

    const fullyRefunded =
      processedRefunds.length > 0 &&
      processedAmount === inspection.expectedAmountMinor;

    const resolution = fullyRefunded
      ? 'PROVIDER_REFUND_PROCESSED'
      : 'PROVIDER_REVERSED';

    return this.repository.transaction(async (tx) => {
      const { eventId, staffId } = await this.requireOrganizer(
        tx,
        sessionToken,
        slug,
      );

      const data = {
        reviewResolution: resolution,
        reviewNote: fullyRefunded
          ? 'Matching full refund verified as processed by Paystack.'
          : 'Matching transaction verified as reversed by Paystack; no full processed refund found.',
        reviewResolvedAt: new Date(),
        reviewResolvedBy: staffId,
      };

      const result =
        kind === 'purchase'
          ? await tx.ticketPurchase.updateMany({
              where: {
                id,
                tier: { eventId },
                paymentReview: { not: null },
                reviewResolvedAt: null,
                paidAt: null,
              },
              data,
            })
          : await tx.ticketOrder.updateMany({
              where: {
                id,
                purchaseId: null,
                tier: { eventId },
                paymentReview: { not: null },
                reviewResolvedAt: null,
                paidAt: null,
              },
              data,
            });

      if (result.count !== 1) {
        throw new ConflictException('This payment review has already changed.');
      }

      return { resolution };
    });
  }

  getOverviewTicketSales(sessionToken: unknown) {
    return this.repository.transaction(async (tx) => {
      const staff = await this.requireStaff(tx, sessionToken);

      const assignments = await tx.eventStaffAssignment.findMany({
        where: { staffId: staff.id, role: 'ORGANIZER' },
        select: { eventId: true },
      });
      const eventIds = assignments.map(({ eventId }) => eventId);

      if (eventIds.length === 0) {
        return {
          currency: 'KES',
          paidOrders: 0,
          ticketsSold: 0,
          grossMinor: 0,
          providerFeesMinor: 0,
          feeRecordedOrders: 0,
          feeAdjustedMinor: 0,
        };
      }

      const [purchases, individualOrders] = await Promise.all([
        tx.ticketPurchase.aggregate({
          where: {
            tier: { eventId: { in: eventIds } },
            paidAt: { not: null },
          },
          _count: { _all: true, providerFeeMinor: true },
          _sum: {
            quantity: true,
            amountMinor: true,
            providerFeeMinor: true,
          },
        }),
        tx.ticketOrder.aggregate({
          where: {
            tier: { eventId: { in: eventIds } },
            purchaseId: null,
            paidAt: { not: null },
          },
          _count: { _all: true, providerFeeMinor: true },
          _sum: {
            amountMinor: true,
            providerFeeMinor: true,
          },
        }),
      ]);

      const paidOrders = purchases._count._all + individualOrders._count._all;
      const ticketsSold =
        (purchases._sum.quantity ?? 0) + individualOrders._count._all;
      const grossMinor =
        (purchases._sum.amountMinor ?? 0) +
        (individualOrders._sum.amountMinor ?? 0);
      const providerFeesMinor =
        (purchases._sum.providerFeeMinor ?? 0) +
        (individualOrders._sum.providerFeeMinor ?? 0);
      const feeRecordedOrders =
        purchases._count.providerFeeMinor +
        individualOrders._count.providerFeeMinor;

      return {
        currency: 'KES',
        paidOrders,
        ticketsSold,
        grossMinor,
        providerFeesMinor,
        feeRecordedOrders,
        feeAdjustedMinor:
          feeRecordedOrders === paidOrders
            ? grossMinor - providerFeesMinor
            : null,
      };
    });
  }

  getTicketSalesSummary(sessionToken: unknown, slug: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);

      const [purchases, individualOrders] = await Promise.all([
        tx.ticketPurchase.aggregate({
          where: { tier: { eventId }, paidAt: { not: null } },
          _count: { _all: true, providerFeeMinor: true },
          _sum: {
            quantity: true,
            amountMinor: true,
            providerFeeMinor: true,
          },
        }),
        tx.ticketOrder.aggregate({
          where: {
            tier: { eventId },
            purchaseId: null,
            paidAt: { not: null },
          },
          _count: { _all: true, providerFeeMinor: true },
          _sum: {
            amountMinor: true,
            providerFeeMinor: true,
          },
        }),
      ]);

      const paidOrders = purchases._count._all + individualOrders._count._all;
      const ticketsSold =
        (purchases._sum.quantity ?? 0) + individualOrders._count._all;
      const grossMinor =
        (purchases._sum.amountMinor ?? 0) +
        (individualOrders._sum.amountMinor ?? 0);
      const providerFeesMinor =
        (purchases._sum.providerFeeMinor ?? 0) +
        (individualOrders._sum.providerFeeMinor ?? 0);
      const feeRecordedOrders =
        purchases._count.providerFeeMinor +
        individualOrders._count.providerFeeMinor;

      return {
        currency: 'KES',
        paidOrders,
        ticketsSold,
        grossMinor,
        providerFeesMinor,
        feeRecordedOrders,
        feeAdjustedMinor:
          feeRecordedOrders === paidOrders
            ? grossMinor - providerFeesMinor
            : null,
      };
    });
  }
  async exportTicketSales(sessionToken: unknown, slug: string) {
    return this.repository.transaction(async (tx) => {
      const { eventId } = await this.requireOrganizer(tx, sessionToken, slug);

      const [purchases, individualOrders] = await Promise.all([
        tx.ticketPurchase.findMany({
          where: { tier: { eventId }, paidAt: { not: null } },
          select: {
            id: true,
            buyerName: true,
            buyerEmail: true,
            quantity: true,
            amountMinor: true,
            providerFeeMinor: true,
            currency: true,
            paidAt: true,
            tier: { select: { name: true } },
          },
        }),
        tx.ticketOrder.findMany({
          where: {
            tier: { eventId },
            purchaseId: null,
            paidAt: { not: null },
          },
          select: {
            id: true,
            guestName: true,
            guestEmail: true,
            tierName: true,
            amountMinor: true,
            providerFeeMinor: true,
            currency: true,
            paidAt: true,
          },
        }),
      ]);

      const cell = (value: string | number | null | undefined) => {
        let text = value == null ? '' : String(value);

        // Prevent spreadsheet programs from interpreting user-entered text as formulas.
        if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;

        return `"${text.replace(/"/g, '""')}"`;
      };

      const rows = [
        ...purchases.map((purchase) => ({
          paidAt: purchase.paidAt!,
          values: [
            `ticket-${purchase.id}`,
            'purchase',
            purchase.tier.name,
            purchase.buyerName,
            purchase.buyerEmail,
            purchase.quantity,
            purchase.currency,
            purchase.amountMinor,
            purchase.providerFeeMinor,
            purchase.paidAt!.toISOString(),
          ],
        })),
        ...individualOrders.map((order) => ({
          paidAt: order.paidAt!,
          values: [
            `ticket-${order.id}`,
            'individual',
            order.tierName,
            order.guestName,
            order.guestEmail,
            1,
            order.currency,
            order.amountMinor,
            order.providerFeeMinor,
            order.paidAt!.toISOString(),
          ],
        })),
      ].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());

      return (
        [
          'reference,type,tier,name,email,tickets,currency,gross_minor,provider_fee_minor,paid_at',
          ...rows.map(({ values }) => values.map(cell).join(',')),
        ].join('\r\n') + '\r\n'
      );
    });
  }
  async logout(sessionToken: unknown): Promise<void> {
    if (isToken(sessionToken)) {
      await this.repository.deleteSession(hashToken(sessionToken));
    }
  }
}
