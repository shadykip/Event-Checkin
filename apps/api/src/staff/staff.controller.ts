import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const cookieName = 'staff_session';
const sessionDurationMs = 8 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Controller('staff')
export class StaffController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body('email') email: unknown,
    @Body('password') password: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (typeof email !== 'string' || typeof password !== 'string' || !password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const staff = await this.prisma.staffAccount.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, isActive: true, passwordHash: true },
    });

    if (!staff?.isActive || !(await argon2.verify(staff.passwordHash, password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = randomBytes(32).toString('base64url');
    await this.prisma.staffSession.create({
      data: {
        staffId: staff.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + sessionDurationMs),
      },
    });

    response.cookie(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: sessionDurationMs,
    });

    return { name: staff.name };
  }

  @Get('events')
  @Header('Cache-Control', 'no-store')
  async events(@Req() request: Request) {
    const token: unknown = request.cookies?.[cookieName];
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new UnauthorizedException('Sign in required');
    }

    const session = await this.prisma.staffSession.findFirst({
      where: {
        tokenHash: hashToken(token),
        expiresAt: { gt: new Date() },
        staff: { isActive: true },
      },
      select: { staffId: true },
    });

    if (!session) throw new UnauthorizedException('Sign in required');

    return this.prisma.event.findMany({
      where: { staffAssignments: { some: { staffId: session.staffId } } },
      select: { name: true, slug: true, venue: true, startsAt: true },
      orderBy: [{ startsAt: 'asc' }, { slug: 'asc' }],
    });
  }
}
