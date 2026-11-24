import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { validateGuest } from '../staff/guest-import';
import { EventsRepository } from './events.repository';

@Injectable()
export class EventsService {
  constructor(private readonly repository: EventsRepository) {}

  list() {
    return this.repository.list();
  }

  async findBySlug(slug: string) {
    const event = await this.repository.findBySlug(slug);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async banner(slug: string) {
    const banner = await this.repository.findBanner(slug);
    if (!banner) throw new NotFoundException('Event banner not found');
    return Buffer.from(banner.image);
  }

  async claim(slug: string, rawName: unknown, rawEmail: unknown) {
    const { guestName, guestEmail, error } = validateGuest(rawName, rawEmail);
    if (error) throw new BadRequestException(error);

    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token).digest('hex');
    const result = await this.repository.claim(
      slug,
      guestName,
      guestEmail,
      hash,
    );

    switch (result) {
      case 'closed':
        throw new ConflictException('Public registration is closed.');
      case 'sold_out':
        throw new ConflictException('All public tickets have been claimed.');
      case 'duplicate':
        throw new ConflictException(
          'A new ticket could not be issued for this email. If you already have a pass, open your original link or contact the organizer.',
        );
      case 'issued':
        return { passPath: `/pass#${token}` };
    }
  }
}
