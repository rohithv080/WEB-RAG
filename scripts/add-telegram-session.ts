import { prisma } from "../src/lib/db";

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TelegramState" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
  `);
  console.log("Verified TelegramState.sessionId column exists.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
