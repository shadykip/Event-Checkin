import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { StaffService } from './staff.service';

const cookieName = 'staff_session';

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
  events(@Req() request: Request) {
    return this.staff.listEvents(request.cookies?.[cookieName]);
  }

  @Post('events/:slug/check-ins')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  checkIn(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body('token') token: string,
  ) {
    return this.staff.checkIn(request.cookies?.[cookieName], slug, token);
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
