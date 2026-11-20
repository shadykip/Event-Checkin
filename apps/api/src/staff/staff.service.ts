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
      const assignment = await this.requireAssignment(tx, sessionToken, slug);

      if (assignment.role !== 'ORGANIZER') {
        throw new ForbiddenException(
          'Only an organizer for this event can issue invitations.',
        );
      }

      const guestName = typeof rawName === 'string' ? rawName.trim() : '';
      const guestEmail =
        typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

      if (!guestName || guestName.length > 200) {
        throw new BadRequestException(
          'Enter a guest name of 1 to 200 characters.',
        );
      }

      if (
        guestEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)
      ) {
        throw new BadRequestException('Enter a valid guest email address.');
      }

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

  async logout(sessionToken: unknown): Promise<void> {
    if (isToken(sessionToken)) {
      await this.repository.deleteSession(hashToken(sessionToken));
    }
  }
}
