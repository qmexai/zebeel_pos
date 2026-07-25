import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getPrismaClient(databaseUrl?: string, forceReinit = false): PrismaClient {
  if (prisma && !forceReinit) {
    return prisma;
  }

  if (prisma && forceReinit) {
    prisma.$disconnect().catch((err) => {
      console.error('Error disconnecting old Prisma Client:', err);
    });
    prisma = null;
  }

  // Use the supplied database URL, or fall back to environmental variable
  const url = databaseUrl || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zabeel_pos';
  
  prisma = new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
  });

  return prisma;
}

