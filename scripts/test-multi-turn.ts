import "dotenv/config";
import { condenseQuery, getAnswer, ChatHistoryItem } from "../src/lib/groq";
import { prisma } from "../src/lib/db";
import { searchChunks, formatContext } from "../src/lib/retrieval/search";

async function main() {
  const site = await prisma.site.findFirst({
    where: { name: { contains: "HOKGG", mode: "insensitive" } },
  });
  if (!site) {
    console.error("HOKGG site not found");
    return;
  }

  console.log("=== Turn 1: 'Who is Daji in HOK?' ===");
  const history: ChatHistoryItem[] = [];
  const q1 = "Who is Daji in HOK?";
  const c1 = await condenseQuery(q1, history);
  console.log("Turn 1 condensed:", c1);

  const chunks1 = await searchChunks(site.id, c1, 6);
  const context1 = formatContext(chunks1);
  const a1 = await getAnswer(q1, context1, null, history);
  console.log("Turn 1 Answer:\n", a1.slice(0, 200), "...\n");

  // Add Turn 1 to history
  history.push({ role: "user", content: q1 });
  history.push({ role: "assistant", content: a1 });

  console.log("=== Turn 2: 'What are her counters?' ===");
  const q2 = "What are her counters?";
  const c2 = await condenseQuery(q2, history);
  console.log("Turn 2 condensed (replaces 'her' with Daji):", c2);

  const chunks2 = await searchChunks(site.id, c2, 6);
  const context2 = formatContext(chunks2);
  const a2 = await getAnswer(q2, context2, null, history);
  console.log("Turn 2 Answer:\n", a2.slice(0, 200), "...\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
