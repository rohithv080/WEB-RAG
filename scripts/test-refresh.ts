import "dotenv/config";
import { prisma } from "../src/lib/db";
import { PATCH } from "../src/app/api/scrape/route";
import { NextRequest } from "next/server";

async function main() {
  const pageId = process.argv[2];
  if (!pageId) throw new Error("pageId required");

  const before = await prisma.chunk.count({ where: { pageId } });
  console.log("chunks before", before);

  const req = new NextRequest("http://localhost/api/scrape", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageId }),
  });
  const res = await PATCH(req);
  const data = await res.json();
  console.log("status", res.status, data);

  const after = await prisma.chunk.count({ where: { pageId } });
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  console.log("chunks after", after, "scrapedAt", page?.scrapedAt);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
