import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect().catch((err) => {
      console.error('Error disconnecting Prisma Client:', err);
    });
    prisma = null;
  }
}

export function getPrismaClient(databaseUrl?: string, forceReinit = false): PrismaClient {
  if (prisma && !forceReinit) {
    return prisma;
  }

  if (prisma && forceReinit) {
    // Properly disconnect old client before creating new one
    const oldPrisma = prisma;
    prisma = null;
    oldPrisma.$disconnect().catch((err) => {
      console.error('Error disconnecting old Prisma Client:', err);
    });
  }

  // Use the supplied database URL, or fall back to environmental variable
  let url = databaseUrl || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zabeel_pos';
  
  // Add connection timeout parameters to fail fast rather than hang (5 second timeout)
  if (url.includes('postgresql://') && !url.includes('connect_timeout')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}connect_timeout=5&connection_limit=5`;
  }

  prisma = new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return prisma;
}
