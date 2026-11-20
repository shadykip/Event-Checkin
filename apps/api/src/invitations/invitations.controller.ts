import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('lookup')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  lookup(@Body('token') token: unknown) {
    return this.invitations.lookup(token);
  }

  @Post('rsvp')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  respond(@Body('token') token: unknown, @Body('status') status: unknown) {
    return this.invitations.respond(token, status);
  }
}
