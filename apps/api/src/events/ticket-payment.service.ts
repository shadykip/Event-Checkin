import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sendInvitationEmail } from '../staff/invitation-mailer';
import {
  committedTickets,
  inventoryTime,
  lockTicketTier,
} from './ticket-inventory';
import { PaystackService } from './paystack.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class TicketPaymentService {
  constructor(
    private readonly db: PrismaService,
    private readonly paystack: PaystackService,
  ) {}

  private token(orderId: string) {
    const secret = process.env.PAYMENT_PASS_SECRET;
    if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
      throw new ServiceUnavailableException(
        'Payment pass secret is not configured.',
      );
    }

    return createHmac('sha256', Buffer.from(secret, 'hex'))
      .update(`ticket-pass-v1:${orderId}`)
      .digest('base64url');
  }

  private async owned(id: string, checkoutKey: unknown) {
    if (
      typeof checkoutKey !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        checkoutKey,
      )
    ) {
      throw new NotFoundException('Order unavailable.');
    }

    const order = await this.db.ticketOrder.findFirst({
      where: { id, checkoutKey },
    });
    if (!order) throw new NotFoundException('Order unavailable.');
    return order;
  }

  private async lockOrder(tx: Tx, id: string) {
    await tx.$queryRaw`
      SELECT id FROM ticket_orders WHERE id = ${id}::uuid FOR UPDATE
    `;
    return tx.ticketOrder.findUniqueOrThrow({
      where: { id },
      include: { tier: { include: { event: true } } },
    });
  }

  async start(id: string, key: unknown) {
    const owner = await this.owned(id, key);
    this.token(id); // Validate fulfillment configuration before opening checkout.

    // Serialize initialization per order. The provider call has a bounded timeout.
    return this.db.$transaction(
      async (tx) => {
        const order = await this.lockOrder(tx, owner.id);
        if (order.paidAt || order.paymentReview) {
          throw new ConflictException(
            'Payment already received. Check your order.',
          );
        }

        if (order.expiresAt <= (await inventoryTime(tx))) {
          throw new ConflictException('Reservation expired. Reserve again.');
        }

        if (order.checkoutUrl) return { url: order.checkoutUrl };

        const url = await this.paystack.initialize(order);
        await tx.ticketOrder.update({
          where: { id },
          data: { checkoutUrl: url },
        });
        return { url };
      },
      { timeout: 15_000 },
    );
  }

  async reconcile(id: string) {
    const initial = await this.db.ticketOrder.findUnique({ where: { id } });
    if (!initial || initial.paymentReview) return;
    if (initial.invitationId) {
      await this.deliver(id);
      return;
    }

    const payment = await this.paystack.verify(id);
    if (payment.status !== 'success') return;

    const token = this.token(id);
    const hash = createHash('sha256').update(token).digest('hex');

    await this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, id);
      if (order.invitationId || order.paymentReview) return;

      let review: string | undefined;
      const paidAt = payment.paid_at ? new Date(payment.paid_at) : null;

      if (
        payment.reference !== `ticket-${id}` ||
        payment.domain !== 'test' ||
        payment.currency !== order.currency ||
        payment.amount !== order.amountMinor ||
        !paidAt ||
        !Number.isFinite(paidAt.getTime())
      ) {
        review = 'Provider transaction did not match the order.';
      }

      await lockTicketTier(tx, order.tier.eventId, order.tierId);
      const now = await inventoryTime(tx);
      const tier = await tx.ticketTier.findUniqueOrThrow({
        where: { id: order.tierId },
      });

      if (!review && paidAt) {
        if (paidAt >= order.expiresAt) {
          review = 'Payment received after reservation expiry.';
        } else if (now >= order.expiresAt) {
          // A delayed notification can arrive after another buyer acquired the seat.
          const used = await committedTickets(tx, tier.id, now);
          if (used >= tier.capacity)
            review = 'Seat reallocated before confirmation.';
        }
      }

      if (!review) {
        const inserted = await tx.invitation.createMany({
          data: [
            {
              eventId: tier.eventId,
              guestName: order.guestName,
              guestEmail: order.guestEmail,
              tokenHash: hash,
              isPublicTicket: false,
            },
          ],
          skipDuplicates: true,
        });
        if (inserted.count !== 1)
          review = 'Guest already has an event invitation.';
      }

      if (review) {
        await tx.ticketOrder.update({
          where: { id },
          data: { paymentReview: review },
        });
        return;
      }

      const invitation = await tx.invitation.findUniqueOrThrow({
        where: { tokenHash: hash },
        select: { id: true },
      });

      await tx.ticketOrder.update({
        where: { id },
        data: { paidAt, invitationId: invitation.id },
      });
    });

    await this.deliver(id);
  }

  private async deliver(id: string) {
    const order = await this.db.ticketOrder.findUniqueOrThrow({
      where: { id },
      include: { invitation: { include: { event: true } } },
    });
    const invite = order.invitation;
    if (!invite || invite.revokedAt || order.emailSentAt) return;

    const token = this.token(id);
    if (createHash('sha256').update(token).digest('hex') !== invite.tokenHash)
      return;

    await sendInvitationEmail(invite, token);
    await this.db.ticketOrder.update({
      where: { id },
      data: { emailSentAt: new Date() },
    });
  }

  async status(id: string, key: unknown, verify: boolean) {
    const owner = await this.owned(id, key);

    if (verify && !owner.paymentReview && !owner.invitationId) {
      await this.reconcile(id);
    }

    const order = await this.db.ticketOrder.findUniqueOrThrow({
      where: { id },
      include: { invitation: true },
    });

    const common = {
      tierName: order.tierName,
      amountMinor: order.amountMinor,
      currency: order.currency,
      expiresAt: order.expiresAt,
    };

    if (order.paymentReview) return { ...common, state: 'review' };
    if (order.invitation) {
      const token = this.token(id);
      const current =
        !order.invitation.revokedAt &&
        order.invitation.tokenHash ===
          createHash('sha256').update(token).digest('hex');

      return {
        ...common,
        state: current ? 'paid' : 'pass_changed',
        passPath: current ? `/pass#${token}` : undefined,
      };
    }

    return {
      ...common,
      state: order.expiresAt <= new Date() ? 'expired' : 'reserved',
    };
  }
}
