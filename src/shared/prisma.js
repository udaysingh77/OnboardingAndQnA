// ==================================================================
// Shared Prisma client singleton.
// A single client instance is reused across the whole process.
// ==================================================================
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('warn', (e) => logger.warn(e));
prisma.$on('error', (e) => logger.error(e));

export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}
