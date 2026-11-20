import {
  Body,
  Controller,
  Header,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('lookup')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async lookup(@Body('token') token: unknown) {
    // The issuing command creates a 32-byte token encoded as unpadded base64url.
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new NotFoundException('Invitation unavailable');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const invitation = await this.prisma.invitation.findFirst({
      where: { tokenHash, revokedAt: null },
      select: {
        guestName: true,
        event: {
          select: { name: true, venue: true, startsAt: true },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation unavailable');
    }

    return invitation;
  }
}
