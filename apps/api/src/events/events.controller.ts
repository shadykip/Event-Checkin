import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const eventFields = {
  id: true,
  name: true,
  slug: true,
  venue: true,
  startsAt: true,
} as const;

@Controller('events')
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.event.findMany({
      select: eventFields,
      orderBy: [{ startsAt: 'asc' }, { slug: 'asc' }],
    });
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: eventFields,
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }
}
