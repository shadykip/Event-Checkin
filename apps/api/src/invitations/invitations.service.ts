import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InvitationsRepository } from './invitations.repository';

@Injectable()
export class InvitationsService {
  constructor(private readonly repository: InvitationsRepository) {}

  private hashPassToken(token: unknown): string {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new NotFoundException('Invitation unavailable');
    }

    return createHash('sha256').update(token).digest('hex');
  }

  async lookup(token: unknown) {
    const invitation = await this.repository.findActivePass(
      this.hashPassToken(token),
    );

    if (!invitation) {
      throw new NotFoundException('Invitation unavailable');
    }

    const { ticketOrder, isPublicTicket, ...pass } = invitation;

    return {
      ...pass,
      ticket: {
        name:
          ticketOrder?.tierName ??
          (isPublicTicket ? 'Free admission' : 'Guest invitation'),
        peoplePerTicket: ticketOrder?.peoplePerTicket ?? 1,
      },
    };
  }
  async respond(token: unknown, status: unknown) {
    const tokenHash = this.hashPassToken(token);

    if (status !== 'ACCEPTED' && status !== 'DECLINED') {
      throw new BadRequestException('Choose ACCEPTED or DECLINED.');
    }

    const saved = await this.repository.saveRsvp(tokenHash, status);

    if (!saved) throw new NotFoundException('Invitation unavailable');
    return saved;
  }
}
