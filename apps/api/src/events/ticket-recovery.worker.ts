import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { TicketPaymentService } from './ticket-payment.service';
import { TicketRecoveryRepository } from './ticket-recovery.repository';

@Injectable()
export class TicketRecoveryWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TicketRecoveryWorker.name);
  private timer?: ReturnType<typeof setTimeout>;
  private stopping = false;
  private current?: Promise<void>;

  constructor(
    private readonly repository: TicketRecoveryRepository,
    private readonly payments: TicketPaymentService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.TICKET_RECOVERY_ENABLED === 'false') return;
    this.schedule(1000);
  }

  async onApplicationShutdown() {
    this.stopping = true;
    clearTimeout(this.timer);
    await this.current;
  }

  private schedule(delay: number) {
    if (this.stopping) return;

    this.timer = setTimeout(() => {
      this.current = this.run();
    }, delay);
    this.timer.unref();
  }

  private async run() {
    let nextDelay = 10_000;

    try {
      const job = await this.repository.claim();
      if (!job) return;

      nextDelay = 250;

      try {
        let order = await this.repository.read(job.id);

        if (!order.paymentReview && !order.invitationId) {
          await this.payments.reconcile(order.purchaseId ?? job.id);
          order = await this.repository.read(job.id);
        }

        if (
          order.paymentReview ||
          order.emailSentAt ||
          order.invitation?.revokedAt
        ) {
          await this.repository.finish(job.id, job.lease);
          return;
        }

        if (!order.invitationId) {
          await this.repository.retry(job.id, job.lease, job.attempts);
          return;
        }

        await this.payments.deliverPendingPass(job.id);
        await this.repository.finish(job.id, job.lease);
      } catch {
        this.logger.warn(`Ticket recovery will retry order ${job.id}`);
        await this.repository.retry(job.id, job.lease, job.attempts);
      }
    } catch {
      nextDelay = 10_000;
      this.logger.warn(
        'Ticket recovery database unavailable; retrying shortly.',
      );
    } finally {
      this.schedule(nextDelay);
    }
  }
}
