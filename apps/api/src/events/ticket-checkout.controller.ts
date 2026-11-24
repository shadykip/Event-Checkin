import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { validateGuest } from '../staff/guest-import';
import { TicketCheckoutRepository } from './ticket-checkout.repository';
import { reservationAttendees } from './ticket-purchase-reservation';

@Controller('events/:slug/ticket-tiers')
export class TicketCheckoutController {
  constructor(private readonly checkout: TicketCheckoutRepository) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Param('slug') slug: string) {
    return this.checkout.list(slug);
  }

  @Post(':tierId/reservations')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  reserve(
    @Param('slug') slug: string,
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Body('checkoutKey', new ParseUUIDPipe({ version: '4' }))
    checkoutKey: string,
    @Body('guestName') rawName: unknown,
    @Body('guestEmail') rawEmail: unknown,
    @Body('quantity') quantity?: unknown,
    @Body('attendees') attendees?: unknown,
  ) {
    const { guestName, guestEmail, error } = validateGuest(rawName, rawEmail);
    if (error) throw new BadRequestException(error);
    return this.checkout.reserve({
      slug,
      tierId,
      checkoutKey,
      guestName,
      guestEmail,
      attendees: reservationAttendees(quantity, attendees),
    });
  }
}
