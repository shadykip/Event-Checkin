import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsController } from './events/events.controller';
import { PrismaService } from './prisma/prisma.service';

@Module({
  controllers: [AppController, EventsController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
