import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type Job = {
  id: string;
  lease: string;
  attempts: number;
};

@Injectable()
export class TicketRecoveryRepository {
  constructor(private readonly db: PrismaService) {}

  async claim(): Promise<Job | null> {
    const lease = randomUUID();

    const rows = await this.db.$queryRaw<Job[]>`
      WITH candidate AS (
        SELECT id
        FROM ticket_orders
        WHERE recovery_after <= clock_timestamp()
        ORDER BY recovery_after, id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ticket_orders AS o
      SET recovery_lease = ${lease}::uuid,
          recovery_after = clock_timestamp() + INTERVAL '2 minutes'
      FROM candidate
      WHERE o.id = candidate.id
      RETURNING o.id,
                o.recovery_lease AS lease,
                o.recovery_attempts AS attempts
    `;

    return rows[0] ?? null;
  }

  read(id: string) {
    return this.db.ticketOrder.findUniqueOrThrow({
      where: { id },
      select: {
        invitationId: true,
        emailSentAt: true,
        paymentReview: true,
        invitation: { select: { revokedAt: true } },
      },
    });
  }

  finish(id: string, lease: string) {
    return this.db.ticketOrder.updateMany({
      where: { id, recoveryLease: lease },
      data: {
        recoveryLease: null,
        recoveryAfter: null,
        recoveryAttempts: 0,
      },
    });
  }

  retry(id: string, lease: string, attempts: number) {
    const delaySeconds = Math.min(60 * 2 ** Math.min(attempts, 8), 6 * 3600);

    return this.db.ticketOrder.updateMany({
      where: { id, recoveryLease: lease },
      data: {
        recoveryLease: null,
        recoveryAfter: new Date(Date.now() + delaySeconds * 1000),
        recoveryAttempts: { increment: 1 },
      },
    });
  }
}
