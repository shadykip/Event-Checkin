import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sendCheckoutRecoveryEmail } from '../staff/invitation-mailer';

type Recovery = {
  id: string;
  checkoutKey: string;
  buyerName: string;
  buyerEmail: string;
  requestedAt: Date;
  source: 'ticket_purchases' | 'ticket_orders';
};

const orderIdPattern =
  /^(?:ticket-)?([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const acceptedMessage =
  'If that order and purchase email match, a checkout link will arrive shortly.';

@Injectable()
export class TicketCheckoutRecoveryService {
  private readonly logger = new Logger(TicketCheckoutRecoveryService.name);

  constructor(private readonly db: PrismaService) {}

  async request(rawId: unknown, rawEmail: unknown) {
    // Invalid and unknown references receive the same public response.
    const id = typeof rawId === 'string' ? orderIdPattern.exec(rawId.trim())?.[1] : undefined;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!id || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { message: acceptedMessage };
    }

    const purchase = await this.db.$queryRaw<Omit<Recovery, 'source'>[]>`
      UPDATE ticket_purchases
      SET recovery_requested_at = clock_timestamp()
      WHERE id = ${id}::uuid
        AND lower(buyer_email) = ${email}
        AND (
          paid_at IS NOT NULL
          OR expires_at > clock_timestamp()
          OR payment_started_at IS NOT NULL
          OR payment_review IS NOT NULL
        )
        AND (
          recovery_requested_at IS NULL
          OR recovery_requested_at < clock_timestamp() - INTERVAL '2 minutes'
        )
      RETURNING id, checkout_key AS "checkoutKey",
        buyer_name AS "buyerName", buyer_email AS "buyerEmail",
        recovery_requested_at AS "requestedAt"
    `;

    const order = purchase.length
      ? []
      : await this.db.$queryRaw<Omit<Recovery, 'source'>[]>`
          UPDATE ticket_orders
          SET recovery_requested_at = clock_timestamp()
          WHERE id = ${id}::uuid
            AND purchase_id IS NULL
            AND lower(guest_email) = ${email}
            AND (
              paid_at IS NOT NULL
              OR expires_at > clock_timestamp()
              OR payment_started_at IS NOT NULL
              OR payment_review IS NOT NULL
            )
            AND (
              recovery_requested_at IS NULL
              OR recovery_requested_at < clock_timestamp() - INTERVAL '2 minutes'
            )
          RETURNING id, checkout_key AS "checkoutKey",
            guest_name AS "buyerName", guest_email AS "buyerEmail",
            recovery_requested_at AS "requestedAt"
        `;

    const selected = purchase[0]
      ? { ...purchase[0], source: 'ticket_purchases' as const }
      : order[0]
        ? { ...order[0], source: 'ticket_orders' as const }
        : null;

    if (selected) {
      try {
        await sendCheckoutRecoveryEmail(selected);
      } catch {
        // Let the buyer retry immediately after a mail failure. Another
        // request may have succeeded in the meantime, so match the claim.
        try {
          if (selected.source === 'ticket_purchases') {
            await this.db.$executeRaw`
              UPDATE ticket_purchases
              SET recovery_requested_at = NULL
              WHERE id = ${selected.id}::uuid
                AND recovery_requested_at = ${selected.requestedAt}
            `;
          } else {
            await this.db.$executeRaw`
              UPDATE ticket_orders
              SET recovery_requested_at = NULL
              WHERE id = ${selected.id}::uuid
                AND recovery_requested_at = ${selected.requestedAt}
            `;
          }
        } catch {
          this.logger.warn('Could not release a failed checkout email claim.');
        }
        this.logger.warn('Checkout recovery email failed; buyer can retry.');
      }
    }

    return { message: acceptedMessage };
  }
}
