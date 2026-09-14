async function main() {
  const secret = "admin-secret-change-me";
  const baseUrl = "http://localhost:3000";

  console.log("=== 1. Testing /api/crawl URL Queue Discovery ===");
  const t0 = Date.now();
  const crawlRes = await fetch(`${baseUrl}/api/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": secret,
    },
    body: JSON.stringify({
      url: "https://redtaxi.co.in",
      maxPages: 10,
    }),
  });

  const crawlData = await crawlRes.json();
  const crawlElapsed = Date.now() - t0;
  console.log(`Crawl status: ${crawlRes.status} in ${crawlElapsed}ms`);
  console.log(`Discovered URLs: ${crawlData.urls?.length || 0}`);
  if (crawlData.urls) {
    console.log("Sample URLs:", crawlData.urls.slice(0, 5));
  }

  console.log("\n=== 2. Testing /api/scrape Batch Ingestion ===");
  const batchUrls = (crawlData.urls && crawlData.urls.length >= 2)
    ? crawlData.urls.slice(0, 2)
    : ["https://redtaxi.co.in"];

  const t1 = Date.now();
  const scrapeRes = await fetch(`${baseUrl}/api/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": secret,
    },
    body: JSON.stringify({
      urls: batchUrls,
      name: "Test Batch Bot",
      description: "Testing client-driven chunked batching",
    }),
  });

  const scrapeData = await scrapeRes.json();
  const scrapeElapsed = Date.now() - t1;
  console.log(`Scrape status: ${scrapeRes.status} in ${scrapeElapsed}ms`);
  console.log(`Processed count: ${scrapeData.processedCount}, chunks: ${scrapeData.chunkCount}`);
  console.log(`Site ID: ${scrapeData.siteId}`);

  console.log("\n=== 3. Testing /api/upload Chunk Batch Ingestion ===");
  const t2 = Date.now();
  const uploadBatchRes = await fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": secret,
    },
    body: JSON.stringify({
      action: "embed-batch",
      pageId: scrapeData.pageId,
      siteId: scrapeData.siteId,
      chunks: [
        {
          content: "Red Taxi provides reliable 24/7 outstation and local cabs in Tamil Nadu.",
          heading: "Red Taxi Overview",
          order: 999,
          isBoilerplate: false,
        },
      ],
    }),
  });

  const uploadBatchData = await uploadBatchRes.json();
  const uploadElapsed = Date.now() - t2;
  console.log(`Upload batch status: ${uploadBatchRes.status} in ${uploadElapsed}ms`);
  console.log("Upload batch result:", uploadBatchData);
}

main().catch(console.error);
