import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  StreamableFile,
} from '@nestjs/common';
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

  @Get(':slug/banner')
  @Header('Cache-Control', 'no-store')
  async banner(@Param('slug') slug: string) {
    return new StreamableFile(await this.events.banner(slug), {
      type: 'image/webp',
    });
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
