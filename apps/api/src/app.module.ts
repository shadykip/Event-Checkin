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

@Module({
  controllers: [
    AppController,
    EventsController,
    InvitationsController,
    StaffController,
  ],
  providers: [
    AppService,
    PrismaService,
    StaffRepository,
    StaffService,
    InvitationsRepository,
    InvitationsService,
  ],
})
export class AppModule {}
