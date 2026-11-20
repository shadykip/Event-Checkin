import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
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
    @Body('token') token: unknown,
  ) {
    return this.staff.checkIn(request.cookies?.[cookieName], slug, token);
  }
}
