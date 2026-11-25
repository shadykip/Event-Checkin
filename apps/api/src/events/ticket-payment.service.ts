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
import {
  canEditQuantity,
  checkoutKey,
  findBooking,
  lockedBooking,
  maximumQuantity,
  type PaymentBooking,
} from './payment-booking';
import { changeTicketQuantity } from './change-ticket-quantity';

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

  private readBooking(id: string, key?: string) {
    return this.db.$transaction((tx) => findBooking(tx, id, key), {
      isolationLevel: 'RepeatableRead',
    });
  }

  private async owned(id: string, key: string) {
    const booking = await this.readBooking(id, key);
    if (!booking) throw new NotFoundException('Order unavailable.');
    return booking;
  }

  async changeQuantity(
    id: string,
    rawKey: unknown,
    previous: unknown,
    quantity: unknown,
    added: unknown,
  ) {
    const key = checkoutKey(rawKey);
    const initial = await this.owned(id, key);
    await this.db.$transaction(async (tx) => {
      await lockTicketTier(tx, initial.tier.eventId, initial.tierId);
      const booking = await lockedBooking(tx, id, key);
      await changeTicketQuantity(tx, booking, key, previous, quantity, added);
    });
    return this.status(id, key, false);
  }

  private async updatePayment(
    tx: Tx,
    booking: PaymentBooking,
    data: {
      paymentStartedAt?: Date;
      checkoutUrl?: string;
      paidAt?: Date;
      paymentReview?: string;
      providerFeeMinor?: number | null;
    },
  ) {
    const where = { id: booking.id };
    if (booking.kind === 'purchase')
      await tx.ticketPurchase.update({ where, data });
    else await tx.ticketOrder.update({ where, data });
  }

  async start(id: string, rawKey: unknown, expectedAmount?: unknown) {
    const key = checkoutKey(rawKey);
    await this.owned(id, key);
    this.token(id);

    // Commit the frozen amount and enqueue recovery before contacting the provider.
    await this.db.$transaction(async (tx) => {
      const booking = await lockedBooking(tx, id, key);
      const now = await inventoryTime(tx);
      if (booking.paidAt || booking.paymentReview)
        throw new ConflictException(
          'Check the payment status for this booking.',
        );
      if (booking.expiresAt <= now)
        throw new ConflictException('Reservation expired. Reserve again.');
      if (
        (expectedAmount !== undefined || booking.quantity > 1) &&
        expectedAmount !== booking.amountMinor
      ) {
        throw new ConflictException(
          'Your booking total changed. Refresh checkout before paying.',
        );
      }
      if (booking.paymentStartedAt) return;
      await this.updatePayment(tx, booking, { paymentStartedAt: now });
      await tx.ticketOrder.update({
        where: { id: booking.tickets[0].id },
        data: { recoveryAfter: new Date(now.getTime() + 60_000) },
      });
    });

    return this.db.$transaction(
      async (tx) => {
        const booking = await lockedBooking(tx, id, key);
        if (booking.paidAt || booking.paymentReview)
          throw new ConflictException(
            'Check the payment status for this booking.',
          );
        if (booking.expiresAt <= (await inventoryTime(tx)))
          throw new ConflictException('Reservation expired. Reserve again.');
        if (booking.checkoutUrl) return { url: booking.checkoutUrl };
        const url = await this.paystack.initialize({
          id: booking.id,
          guestEmail: booking.buyerEmail,
          amountMinor: booking.amountMinor,
          currency: booking.currency,
        });
        await this.updatePayment(tx, booking, { checkoutUrl: url });
        return { url };
      },
      { timeout: 15_000 },
    );
  }

  async reconcile(id: string) {
    const initial = await this.readBooking(id);
    if (
      !initial ||
      initial.paidAt ||
      initial.paymentReview ||
      (!initial.paymentStartedAt && !initial.checkoutUrl)
    )
      return;
    const payment = await this.paystack.verify(id);
    if (payment.status !== 'success') return;

    await this.db.$transaction(async (tx) => {
      await lockTicketTier(tx, initial.tier.eventId, initial.tierId);
      const booking = await lockedBooking(tx, id);
      if (booking.paidAt || booking.paymentReview) return;
      const now = await inventoryTime(tx);
      const paidAt = new Date(payment.paid_at ?? '');
      const providerFeeMinor =
        typeof payment.fees === 'number' &&
        Number.isSafeInteger(payment.fees) &&
        payment.fees >= 0
          ? payment.fees
          : null;
      let review: string | undefined;
      if (
        payment.reference !== `ticket-${id}` ||
        payment.domain !== 'test' ||
        payment.currency !== booking.currency ||
        payment.amount !== booking.amountMinor ||
        !Number.isFinite(paidAt.getTime())
      ) {
        review = 'Provider transaction did not match the order.';
      } else if (paidAt >= booking.expiresAt) {
        review = 'Payment received after reservation expiry.';
      } else if (now >= booking.expiresAt) {
        const used = await committedTickets(tx, booking.tierId, now);
        if (used + booking.quantity > booking.tier.capacity)
          review = 'Seats reallocated before confirmation.';
      }

      if (!review) {
        const tickets = booking.tickets.map((ticket) => ({
          ...ticket,
          tokenHash: createHash('sha256')
            .update(this.token(ticket.id))
            .digest('hex'),
        }));
        const inserted = await tx.invitation.createManyAndReturn({
          data: tickets.map(({ guestName, guestEmail, tokenHash }) => ({
            guestName,
            guestEmail,
            tokenHash,
            eventId: booking.tier.eventId,
            isPublicTicket: false,
          })),
          select: { id: true, tokenHash: true },
          skipDuplicates: true,
        });
        if (inserted.length === tickets.length) {
          const invitations = new Map(
            inserted.map((invite) => [invite.tokenHash, invite.id]),
          );
          for (const ticket of tickets) {
            await tx.ticketOrder.update({
              where: { id: ticket.id },
              data: {
                paidAt,
                invitationId: invitations.get(ticket.tokenHash)!,
                recoveryAttempts: 0,
                ...(booking.kind === 'order' ? { providerFeeMinor } : {}),
              },
            });
          }
          await tx.ticketOrder.updateMany({
            where: {
              id: { in: tickets.map((ticket) => ticket.id) },
              recoveryLease: null,
            },
            data: { recoveryAfter: now },
          });
          if (booking.kind === 'purchase')
            await this.updatePayment(tx, booking, { paidAt, providerFeeMinor });
          return;
        }
        // Remove only the rows this transaction inserted. No partial set of passes becomes visible.
        await tx.invitation.deleteMany({
          where: { id: { in: inserted.map((invite) => invite.id) } },
        });
        review = 'An attendee already has an event invitation.';
      }
      await this.updatePayment(tx, booking, { paymentReview: review });
      if (booking.kind === 'purchase') {
        await tx.ticketOrder.updateMany({
          where: { purchaseId: id },
          data: { paymentReview: review },
        });
      }
    });
  }

  async deliverPendingPass(id: string) {
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

  async status(id: string, rawKey: unknown, verify: boolean) {
    const key = checkoutKey(rawKey);
    let booking = await this.owned(id, key);
    if (
      verify &&
      !booking.paidAt &&
      !booking.paymentReview &&
      (booking.paymentStartedAt || booking.checkoutUrl)
    ) {
      await this.reconcile(id);
      booking = await this.owned(id, key);
    }
    const common = {
      tierName: booking.tierName,
      eventSlug: booking.tier.event.slug,
      quantity: booking.quantity,
      peoplePerTicket: booking.peoplePerTicket,
      unitAmountMinor: booking.unitAmountMinor,
      amountMinor: booking.amountMinor,
      currency: booking.currency,
      expiresAt: booking.expiresAt,
    };
    if (
      booking.paymentReview &&
      booking.reviewResolution === 'PROVIDER_REFUND_PROCESSED'
    ) {
      return { ...common, state: 'refunded' };
    }
    if (
      booking.paymentReview &&
      booking.reviewResolution === 'PROVIDER_REVERSED'
    ) {
      return { ...common, state: 'reversed' };
    }
    if (booking.paymentReview) return { ...common, state: 'review' };
    if (booking.paidAt) {
      const passes = booking.tickets.map((ticket, index) => {
        const token = this.token(ticket.id);
        const current =
          ticket.invitation &&
          !ticket.invitation.revokedAt &&
          ticket.invitation.tokenHash ===
            createHash('sha256').update(token).digest('hex');
        return {
          ticketNumber: index + 1,
          guestName: ticket.guestName,
          passPath: current ? `/pass#${token}` : undefined,
        };
      });
      return {
        ...common,
        state: passes.some((pass) => pass.passPath) ? 'paid' : 'pass_changed',
        passPath: passes.length === 1 ? passes[0].passPath : undefined,
        passes: passes.length > 1 ? passes : undefined,
      };
    }
    const now = new Date();
    if (booking.expiresAt <= now) return { ...common, state: 'expired' };
    return {
      ...common,
      state: 'reserved',
      maxQuantity: canEditQuantity(booking, now)
        ? await maximumQuantity(this.db, booking, now)
        : undefined,
    };
  }

  async resendCurrentPass(id: string) {
    const order = await this.db.ticketOrder.findUnique({
      where: { id },
      include: { invitation: { include: { event: true } } },
    });
    if (!order?.paidAt || !order.invitation || order.invitation.revokedAt) {
      throw new NotFoundException('Paid pass unavailable.');
    }
    const token = this.token(id);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (order.invitation.tokenHash !== tokenHash) {
      throw new ConflictException(
        'This pass was replaced. Email its replacement link, or replace it again.',
      );
    }
    await sendInvitationEmail(order.invitation, token);
    return { accepted: true };
  }

  async inspectProviderPayment(id: string) {
    const { transaction, refunds } =
      await this.paystack.listRefundsForOrder(id);

    return {
      status: transaction.status,
      reference: transaction.reference,
      amountMinor: transaction.amount,
      currency: transaction.currency,
      domain: transaction.domain,
      paidAt: transaction.paid_at ?? null,
      refunds: refunds.map((refund) => ({
        id: refund.id,
        status: refund.status,
        amountMinor: refund.amount,
        currency: refund.currency,
        refundedAt: refund.refunded_at,
      })),
    };
  }
}
