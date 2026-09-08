import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "TelegramState" ADD COLUMN IF NOT EXISTS "language" TEXT;');
  console.log("Done");
}
main().catch(console.error).finally(() => prisma.$disconnect());
