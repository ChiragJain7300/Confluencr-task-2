import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 7+ connection setup using the official driver adapter.
 *
 * - `@prisma/adapter-pg` wraps the native `pg` driver.
 * - The adapter is passed directly to PrismaClient; no `url` in schema.prisma needed.
 * - The DATABASE_URL is read from the .env file at runtime.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
