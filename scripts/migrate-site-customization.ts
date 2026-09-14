import { prisma } from "../src/lib/db";

async function main() {
  console.log("Checking Site table columns...");
  const existingCols: any = await prisma.$queryRawUnsafe(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'Site';
  `);
  const colNames = existingCols.map((c: any) => c.column_name);
  console.log("Existing columns on Site:", colNames);

  console.log("Applying column additions individually...");
  await prisma.$executeRawUnsafe(`ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "systemPrompt" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "starterQuestions" JSONB;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "tone" TEXT DEFAULT 'balanced';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "userId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN DEFAULT true;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Site_userId_idx" ON "Site"("userId");`);

  const updatedCols: any = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Site';
  `);
  console.log("Updated columns on Site:", updatedCols);
  console.log("Migration finished successfully!");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
