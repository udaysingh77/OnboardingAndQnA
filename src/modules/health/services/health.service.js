// ==================================================================
// Health service - DB connectivity + runtime info.
// ==================================================================
import { prisma } from '../../../shared/prisma.js';

export async function healthReport() {
  const startedAt = Date.now();
  let dbStatus = 'up';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'down';
  }

  return {
    status: dbStatus === 'up' ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: dbStatus,
    latencyMs: Date.now() - startedAt,
  };
}
