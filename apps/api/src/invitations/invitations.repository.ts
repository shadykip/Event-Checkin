import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type GuestRsvp = 'ACCEPTED' | 'DECLINED';

type SavedRsvp = {
  rsvpStatus: GuestRsvp;
  rsvpRespondedAt: Date;
};

@Injectable()
export class InvitationsRepository {
  constructor(private readonly db: PrismaService) {}

  findActivePass(tokenHash: string) {
    return this.db.invitation.findFirst({
      where: { tokenHash, revokedAt: null },
      select: {
        guestName: true,
        rsvpStatus: true,
        rsvpRespondedAt: true,
        event: {
          select: {
            name: true,
            venue: true,
            startsAt: true,
          },
        },
      },
    });
  }

  async saveRsvp(tokenHash: string, status: GuestRsvp) {
    const [invitation] = await this.db.$queryRaw<SavedRsvp[]>`
      UPDATE invitations
      SET
        rsvp_responded_at = CASE
          WHEN rsvp_status = ${status}::"RsvpStatus"
            THEN COALESCE(rsvp_responded_at, clock_timestamp())
          ELSE clock_timestamp()
        END,
        rsvp_status = ${status}::"RsvpStatus"
      WHERE token_hash = ${tokenHash}
        AND revoked_at IS NULL
      RETURNING
        rsvp_status::text AS "rsvpStatus",
        rsvp_responded_at AS "rsvpRespondedAt"
    `;

    return invitation;
  }
}
