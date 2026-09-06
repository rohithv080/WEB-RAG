import { prisma } from "../src/lib/db";

async function main() {
  const site = await prisma.site.findFirst({ where: { name: 'cookbook' } });
  if (!site) return;
  
  const pages = await prisma.page.findMany({ where: { siteId: site.id } });
  console.log(`Site: ${site.name} has ${pages.length} pages`);
  for (const p of pages.slice(0, 20)) { // limit to 20 to not clutter
    console.log(p.url);
  }
}

main().catch(console.error);
