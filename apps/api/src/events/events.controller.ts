import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list() {
    return this.events.list();
  }

  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  findBySlug(@Param('slug') slug: string) {
    return this.events.findBySlug(slug);
  }

  @Post(':slug/tickets')
  @Header('Cache-Control', 'no-store')
  claim(
    @Param('slug') slug: string,
    @Body('guestName') name: unknown,
    @Body('guestEmail') email: unknown,
  ) {
    return this.events.claim(slug, name, email);
  }
}
