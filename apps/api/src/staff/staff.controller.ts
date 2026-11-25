import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { StaffService } from './staff.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { maxEventBannerBytes } from './event-banner';
import type { TicketTierInput } from './ticket-tier-input';

const cookieName = 'staff_session';

const EventFormUpload = FileInterceptor('banner', {
  limits: {
    fileSize: maxEventBannerBytes,
    files: 1,
    fields: 5,
    fieldSize: 32 * 1024,
    parts: 7,
  },
});

@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body('email') email: unknown,
    @Body('password') password: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.staff.login(email, password);

    response.cookie(cookieName, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires: session.expiresAt,
    });

    return { name: session.name };
  }

  @Get('events')
  @Header('Cache-Control', 'no-store')
  events(@Req() request: Request, @Query('view') view?: string) {
    const session = request.cookies?.[cookieName];

    if (view === 'dashboard') {
      return this.staff.getDashboard(session);
    }

    return this.staff.listEvents(session);
  }

  @Post('events')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(EventFormUpload)
  createEvent(
    @Req() request: Request,
    @Body('name') name: unknown,
    @Body('venue') venue: unknown,
    @Body('startsAt') startsAt: unknown,
    @Body('description') description: unknown,
    @Body('descriptionHtml') descriptionHtml: unknown,
    @UploadedFile() banner?: Express.Multer.File,
  ) {
    return this.staff.createEvent(
      request.cookies?.[cookieName],
      name,
      venue,
      startsAt,
      description,
      banner,
      descriptionHtml,
    );
  }

  @Put('events/:slug')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(EventFormUpload)
  updateEvent(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body('name') name: unknown,
    @Body('venue') venue: unknown,
    @Body('startsAt') startsAt: unknown,
    @Body('description') description: unknown,
    @Body('descriptionHtml') descriptionHtml: unknown,
    @UploadedFile() banner?: Express.Multer.File,
  ) {
    return this.staff.updateEvent(
      request.cookies?.[cookieName],
      slug,
      name,
      venue,
      startsAt,
      description,
      banner,
      descriptionHtml,
    );
  }

  @Get('events/:slug/banner')
  @Header('Cache-Control', 'private, no-store')
  async eventBanner(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Res() response: Response,
  ) {
    const image = await this.staff.getEventBanner(
      request.cookies?.[cookieName],
      slug,
    );

    response.type('image/webp').send(image);
  }

  @Post('events/:slug/check-ins')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  checkIn(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body('token') token: unknown,
    @Body('action') action: unknown,
    @Body('quantity') quantity: unknown,
    @Body('requestId') requestId: unknown,
  ) {
    return this.staff.checkIn(
      request.cookies?.[cookieName],
      slug,
      token,
      action,
      quantity,
      requestId,
    );
  }

  @Get('events/:slug/attendance')
  @Header('Cache-Control', 'no-store')
  attendance(@Req() request: Request, @Param('slug') slug: string) {
    return this.staff.getAttendance(request.cookies?.[cookieName], slug);
  }

  @Get('events/:slug/invitations')
  @Header('Cache-Control', 'no-store')
  async listInvitations(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('slug') slug: string,
    @Query('page') page: unknown,
    @Query('q') query: unknown,
    @Query('rsvp') rsvp?: unknown,
    @Query('format') format?: unknown,
  ) {
    const session = request.cookies?.[cookieName];

    if (format === 'csv') {
      const csv = await this.staff.exportInvitations(
        session,
        slug,
        query,
        rsvp,
      );
      const filename = `${slug.replace(/[^a-zA-Z0-9_-]/g, '_')}-guests.csv`;

      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      return csv;
    }

    return this.staff.listInvitations(session, slug, page, query, rsvp);
  }

  @Post('events/:slug/invitations')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  issueInvitation(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body('guestName') guestName: unknown,
    @Body('guestEmail') guestEmail: unknown,
  ) {
    return this.staff.issueInvitation(
      request.cookies?.[cookieName],
      slug,
      guestName,
      guestEmail,
    );
  }

  @Post('events/:slug/invitations/:invitationId/revoke')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  revokeInvitation(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.staff.revokeInvitation(
      request.cookies?.[cookieName],
      slug,
      invitationId,
    );
  }

  @Post('events/:slug/invitations/preview')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  previewGuestImport(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body('csv') csv: unknown,
  ) {
    return this.staff.previewGuestImport(
      request.cookies?.[cookieName],
      slug,
      csv,
    );
  }

  @Post('events/:slug/invitations/:invitationId/replace-pass')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  replacePass(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.staff.replacePass(
      request.cookies?.[cookieName],
      slug,
      invitationId,
    );
  }

  @Post('events/:slug/invitations/email')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  emailInvitation(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body('token') token: unknown,
  ) {
    return this.staff.emailInvitation(
      request.cookies?.[cookieName],
      slug,
      token,
    );
  }

  @Get('events/:slug/team')
  @Header('Cache-Control', 'no-store')
  getEventTeam(@Req() request: Request, @Param('slug') slug: string) {
    return this.staff.getEventTeam(request.cookies?.[cookieName], slug);
  }

  @Post('events/:slug/team')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  assignDoorStaff(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body('email') email: unknown,
  ) {
    return this.staff.assignDoorStaff(
      request.cookies?.[cookieName],
      slug,
      email,
    );
  }

  @Delete('events/:slug/team/:staffId')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  removeDoorStaff(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ) {
    return this.staff.removeDoorStaff(
      request.cookies?.[cookieName],
      slug,
      staffId,
    );
  }

  @Post('events/:slug/team/:staffId/resend-setup')
  @Header('Cache-Control', 'no-store')
  resendDoorStaffSetup(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Param('staffId') staffId: string,
  ) {
    return this.staff.resendDoorStaffSetup(
      request.cookies?.[cookieName],
      slug,
      staffId,
    );
  }

  @Get('events/:slug/ticket-allocation')
  @Header('Cache-Control', 'no-store')
  getTicketAllocation(@Req() request: Request, @Param('slug') slug: string) {
    return this.staff.getTicketAllocation(request.cookies?.[cookieName], slug);
  }

  @Put('events/:slug/ticket-allocation')
  @Header('Cache-Control', 'no-store')
  saveTicketAllocation(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body('capacity') capacity: unknown,
  ) {
    return this.staff.saveTicketAllocation(
      request.cookies?.[cookieName],
      slug,
      capacity,
    );
  }

  @Get('events/:slug/ticket-tiers')
  @Header('Cache-Control', 'no-store')
  listTicketTiers(@Req() request: Request, @Param('slug') slug: string) {
    return this.staff.listTicketTiers(request.cookies?.[cookieName], slug);
  }

  @Post('events/:slug/ticket-tiers')
  @Header('Cache-Control', 'no-store')
  createTicketTier(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body() input: TicketTierInput,
  ) {
    return this.staff.saveTicketTier(
      request.cookies?.[cookieName],
      slug,
      input,
    );
  }

  @Put('events/:slug/ticket-tiers/:tierId')
  @Header('Cache-Control', 'no-store')
  updateTicketTier(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Body() input: TicketTierInput,
  ) {
    return this.staff.saveTicketTier(
      request.cookies?.[cookieName],
      slug,
      input,
      tierId,
    );
  }

  @Post('password/forgot')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  requestPasswordReset(@Body('email') email: unknown) {
    return this.staff.requestPasswordReset(email);
  }

  @Post('password/reset')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resetPassword(
    @Body('token') token: unknown,
    @Body('password') password: unknown,
  ) {
    return this.staff.resetPassword(token, password);
  }

  @Post('events/:slug/invitations/:invitationId/resend-paid-pass')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resendPaidPass(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.staff.resendPaidPass(
      request.cookies?.[cookieName],
      slug,
      invitationId,
    );
  }

  @Get('events/:slug/payment-reviews')
  @Header('Cache-Control', 'no-store')
  listPaymentReviews(@Req() request: Request, @Param('slug') slug: string) {
    return this.staff.listPaymentReviews(request.cookies?.[cookieName], slug);
  }

  @Get('events/:slug/payment-reviews/:kind/:id/provider')
  @Header('Cache-Control', 'no-store')
  inspectPaymentReview(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (kind !== 'purchase' && kind !== 'individual') {
      throw new BadRequestException('Invalid payment review type.');
    }

    return this.staff.inspectPaymentReview(
      request.cookies?.[cookieName],
      slug,
      kind,
      id,
    );
  }

  @Post('events/:slug/payment-reviews/:kind/:id/resolve-reversed')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resolveReversedPaymentReview(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (kind !== 'purchase' && kind !== 'individual') {
      throw new BadRequestException('Invalid payment review type.');
    }

    return this.staff.resolveReversedPaymentReview(
      request.cookies?.[cookieName],
      slug,
      kind,
      id,
    );
  }
  @Get('events/:slug/payment-reviews/resolved')
  @Header('Cache-Control', 'no-store')
  listResolvedPaymentReviews(
    @Req() request: Request,
    @Param('slug') slug: string,
  ) {
    return this.staff.listResolvedPaymentReviews(
      request.cookies?.[cookieName],
      slug,
    );
  }
  @Get('events/:slug/ticket-sales')
  @Header('Cache-Control', 'no-store')
  ticketSales(@Req() request: Request, @Param('slug') slug: string) {
    return this.staff.getTicketSalesSummary(
      request.cookies?.[cookieName],
      slug,
    );
  }
  @Get('overview/ticket-sales')
  @Header('Cache-Control', 'no-store')
  overviewTicketSales(@Req() request: Request) {
    return this.staff.getOverviewTicketSales(request.cookies?.[cookieName]);
  }
  @Post('events/:slug/team/invite')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  inviteDoorStaff(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body('name') name: unknown,
    @Body('email') email: unknown,
  ) {
    return this.staff.inviteDoorStaff(
      request.cookies?.[cookieName],
      slug,
      name,
      email,
    );
  }
  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.staff.logout(request.cookies?.[cookieName]);

    response.clearCookie(cookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }
}
