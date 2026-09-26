import "dotenv/config";
import { condenseQuery } from "../src/lib/groq";

async function runTestSuite() {
  const tests = [
    {
      name: "Greeting history (should NOT rewrite)",
      history: [
        { role: "user" as const, content: "hello" },
        { role: "assistant" as const, content: "Hello! How can I help you today?" },
      ],
      query: "erode to tirunelveli",
    },
    {
      name: "Pronoun resolution ('it')",
      history: [
        { role: "user" as const, content: "What is Docker?" },
        {
          role: "assistant" as const,
          content: "Docker is an open-source platform for containerization.",
        },
      ],
      query: "How do I install it on Ubuntu?",
    },
    {
      name: "Possessive pronoun ('her')",
      history: [
        { role: "user" as const, content: "Who is Daji in Honor of Kings?" },
        {
          role: "assistant" as const,
          content: "Daji is a burst mage in Honor of Kings known for heart stun.",
        },
      ],
      query: "What are her best counters?",
    },
    {
      name: "Topic switch (already standalone)",
      history: [
        { role: "user" as const, content: "Tell me about Redis caching." },
        {
          role: "assistant" as const,
          content: "Redis is an in-memory data store used as a cache.",
        },
      ],
      query: "What is the capital of Japan?",
    },
    {
      name: "Implicit entity context",
      history: [
        { role: "user" as const, content: "I am configuring Nginx for my website." },
        {
          role: "assistant" as const,
          content: "Nginx handles reverse proxying and HTTP requests.",
        },
      ],
      query: "How do I enable gzip compression?",
    },
  ];

  console.log("=== RUNNING MULTI-TURN QUERY REWRITING TEST SUITE ===");
  for (const t of tests) {
    const t0 = Date.now();
    const result = await condenseQuery(t.query, t.history);
    const ms = Date.now() - t0;
    console.log(`[${t.name}]`);
    console.log(`  Input: "${t.query}"`);
    console.log(`  Rewritten: "${result}"`);
    console.log(`  Latency: ${ms}ms\n`);
  }
}

runTestSuite().catch(console.error);
