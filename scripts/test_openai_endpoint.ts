import { prisma } from "../src/lib/db";
import { generateApiKey } from "../src/lib/apiKey";

async function runTest() {
  console.log("=== Testing Developer API Key & OpenAI Endpoint ===");

  const site = await prisma.site.findFirst({
    where: { pages: { some: {} } },
    include: { pages: true },
  });

  const targetSite = site || (await prisma.site.findFirst());
  if (!targetSite) {
    console.error("No site found in DB to test with.");
    return;
  }

  const testUserId = targetSite.userId || "test-user-system";
  const testKey = generateApiKey();

  console.log(`Creating test API key: ${testKey} for user: ${testUserId}`);
  const keyRecord = await prisma.apiKey.create({
    data: {
      key: testKey,
      name: "Automated Verification Key",
      userId: testUserId,
      siteId: targetSite.id,
    },
  });

  try {
    const baseUrl = "http://localhost:3000";

    // 1. Test GET /v1/models
    console.log("\n[Test 1] GET /v1/models");
    const modelsRes = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        Authorization: `Bearer ${testKey}`,
      },
    });
    console.log("Status:", modelsRes.status);
    const modelsData = await modelsRes.json();
    console.log("Models returned:", modelsData.data?.length, "first model ID:", modelsData.data?.[0]?.id);
    if (modelsRes.status !== 200) throw new Error("Models endpoint failed");

    // 2. Test POST /v1/chat/completions non-streaming
    console.log("\n[Test 2] POST /v1/chat/completions (stream=false)");
    const chatRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testKey}`,
      },
      body: JSON.stringify({
        model: targetSite.id,
        messages: [{ role: "user", content: "Hello! What can you help with?" }],
        stream: false,
      }),
    });
    console.log("Status:", chatRes.status);
    const chatData = await chatRes.json();
    console.log("Completion ID:", chatData.id);
    console.log("Choices length:", chatData.choices?.length);
    console.log("Content snippet:", chatData.choices?.[0]?.message?.content?.slice(0, 100));
    console.log("Usage:", chatData.usage);
    if (chatRes.status !== 200) throw new Error("Chat completions non-streaming failed");

    // 3. Test POST /v1/chat/completions streaming (SSE)
    console.log("\n[Test 3] POST /v1/chat/completions (stream=true)");
    const streamRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testKey}`,
      },
      body: JSON.stringify({
        model: targetSite.id,
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      }),
    });
    console.log("Status:", streamRes.status);
    console.log("Content-Type:", streamRes.headers.get("content-type"));
    const text = await streamRes.text();
    const hasChunks = text.includes("chat.completion.chunk");
    const hasDone = text.includes("[DONE]");
    console.log("Stream output length:", text.length);
    console.log("Has OpenAI chunks:", hasChunks, "Has [DONE]:", hasDone);
    if (!hasChunks || !hasDone) throw new Error("Streaming SSE output missing chunks or [DONE]");

    // 4. Test Invalid Key Authentication
    console.log("\n[Test 4] Invalid Key Authentication Check");
    const invalidRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer wr_live_invalid_key_12345`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Test" }],
      }),
    });
    console.log("Invalid key status:", invalidRes.status);
    const invalidData = await invalidRes.json();
    console.log("Error code:", invalidData.error?.code);
    if (invalidRes.status !== 401) throw new Error("Expected 401 for invalid key");

    console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY!");
  } finally {
    console.log("\nCleaning up test API key...");
    await prisma.apiKey.delete({ where: { id: keyRecord.id } });
    await prisma.$disconnect();
  }
}

runTest().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
