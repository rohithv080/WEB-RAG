import { prisma } from "../src/lib/db";
import { Prisma } from "@prisma/client";
import { streamAnswer } from "../src/lib/groq";

async function main() {
  console.log("1. Finding site Barbequenation...");
  const site = await prisma.site.findUnique({ where: { id: "cmtpo94ws00051mhou9h7w090" } });
  if (!site) {
    console.log("No sites found in DB. Seed or scrape one first.");
    return;
  }
  console.log(`Testing with site: "${site.name}" (${site.id})`);

  // 2. Test updating site customization fields via Prisma
  console.log("2. Updating customization fields...");
  const updated = await prisma.site.update({
    where: { id: site.id },
    data: {
      systemPrompt: "You are a witty, cheerful AI guide named Sparky. Always add a spark emoji ⚡ to your greeting.",
      starterQuestions: ["Tell me about this topic", "What are 3 key highlights?"],
      tone: "concise",
    },
  });
  console.log("Updated site fields:", {
    systemPrompt: updated.systemPrompt,
    starterQuestions: updated.starterQuestions,
    tone: updated.tone,
  });

  // 3. Test that Groq prompt builder generates the customized prompt
  console.log("3. Testing streamAnswer with custom prompt and tone...");
  const stream = await streamAnswer(
    "Hello! What is this site about?",
    "<document id=\"1\">\nThis site is an encyclopedia entry about Vijay, an Indian actor and politician who works in Tamil cinema.\n</document>",
    "English",
    [],
    updated.systemPrompt,
    updated.tone
  );

  let response = "";
  for await (const chunk of stream) {
    response += chunk.choices[0]?.delta?.content ?? "";
  }
  console.log("LLM Answer output:\n---\n" + response + "\n---");

  console.log("\nResetting test site back to defaults...");
  await prisma.site.update({
    where: { id: site.id },
    data: {
      systemPrompt: null,
      starterQuestions: Prisma.DbNull,
      tone: "balanced",
    },
  });

  console.log("Customization test completed successfully!");
}

main()
  .catch((e) => {
    console.error("Test error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
