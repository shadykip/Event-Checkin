import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsController } from './events/events.controller';
import { PrismaService } from './prisma/prisma.service';
import { InvitationsController } from './invitations/invitations.controller';
import { StaffController } from './staff/staff.controller';
import { StaffRepository } from './staff/staff.repository';
import { StaffService } from './staff/staff.service';
import { InvitationsRepository } from './invitations/invitations.repository';
import { InvitationsService } from './invitations/invitations.service';
import { EventsRepository } from './events/events.repository';
import { EventsService } from './events/events.service';
import { TicketCheckoutController } from './events/ticket-checkout.controller';
import { TicketCheckoutRepository } from './events/ticket-checkout.repository';
import { TicketPaymentController } from './events/ticket-payment.controller';
import { PaystackService } from './events/paystack.service';
import { TicketPaymentService } from './events/ticket-payment.service';
import 'dotenv/config';
import { TicketRecoveryRepository } from './events/ticket-recovery.repository';
import { TicketRecoveryWorker } from './events/ticket-recovery.worker';
import { TicketCheckoutRecoveryService } from './events/ticket-checkout-recovery.service';

@Module({
  controllers: [
    AppController,
    EventsController,
    InvitationsController,
    StaffController,
    TicketCheckoutController,
    TicketPaymentController,
  ],
  providers: [
    AppService,
    PrismaService,
    StaffRepository,
    StaffService,
    InvitationsRepository,
    InvitationsService,
    EventsRepository,
    EventsService,
    TicketCheckoutRepository,
    PaystackService,
    TicketPaymentService,
    TicketRecoveryRepository,
    TicketRecoveryWorker,
    TicketCheckoutRecoveryService,
  ],
})
export class AppModule {}
