import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
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
  listInvitations(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Query('page') page: unknown,
    @Query('q') query: unknown,
  ) {
    return this.staff.listInvitations(
      request.cookies?.[cookieName],
      slug,
      page,
      query,
    );
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
