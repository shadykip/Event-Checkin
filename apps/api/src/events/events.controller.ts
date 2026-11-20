import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('events')
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.event.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        venue: true,
        startsAt: true,
      },
      orderBy: [{ startsAt: 'asc' }, { slug: 'asc' }],
    });
  }
}
