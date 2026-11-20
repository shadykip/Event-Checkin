import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '../generated/prisma/client';

function getDatabaseUrl(): string {
  // npm runs workspace scripts from apps/api.
  config({ path: resolve(process.cwd(), '../../.env'), quiet: true });

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const password = process.env.POSTGRES_PASSWORD;
  if (!password) {
    throw new Error('Set POSTGRES_PASSWORD in the root .env or provide DATABASE_URL.');
  }

  const port = process.env.POSTGRES_PORT || '5433';
  return `postgresql://event_app:${encodeURIComponent(password)}@127.0.0.1:${port}/event_checkin`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
