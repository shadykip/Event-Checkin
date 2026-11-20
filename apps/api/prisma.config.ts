import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

config({ path: resolve(__dirname, '../../.env'), quiet: true });

const password = encodeURIComponent(env('POSTGRES_PASSWORD'));
const port = process.env.POSTGRES_PORT || '5433';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: `postgresql://event_app:${password}@127.0.0.1:${port}/event_checkin`,
  },
});
