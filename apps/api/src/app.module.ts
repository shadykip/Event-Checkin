import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsController } from './events/events.controller';
import { PrismaService } from './prisma/prisma.service';
import { InvitationsController } from './invitations/invitations.controller';

@Module({
  controllers: [AppController, EventsController, InvitationsController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
