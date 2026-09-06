# Web RAG

Scrape a web page, chunk + embed with Transformers.js, store vectors in Postgres (pgvector), and stream grounded answers via Groq.

## Setup

1. **Postgres with pgvector**

```bash
# Docker example
docker run -d --name web-rag-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=web_rag -p 5432:5432 pgvector/pgvector:pg16
```

2. **Env**

```bash
cp .env.example .env
# set GROQ_API_KEY and DATABASE_URL
```

3. **Install & migrate**

```bash
npm install
npm run db:setup   # enable vector → prisma db push → IVFFlat index
```

> On Windows, port 5432 is often blocked by Hyper-V exclusions — map Docker to `55432` (see `.env.example`).

4. **Dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Flow

1. `POST /api/scrape` — fetch URL → Readability → heading-aware chunks → nomic embeddings (768-d) → `Site` + `Chunk`
2. `PATCH /api/scrape` — `{ siteId }` refresh: delete chunks, re-scrape, re-embed, bump `scrapedAt`
3. `POST /api/chat` — embed question → pgvector cosine search → Groq stream with `[n]` citations
4. `GET /api/sites` — list indexed sites / sessions

## Notes

- First scrape downloads the embedding model (~tens of MB) into `.cache/transformers`.
- Groq free tier is rate-limited; the client retries with backoff and surfaces a clear error if limits are hit.
- Default model is `openai/gpt-oss-20b` (`GROQ_MODEL`); `llama-3.3-70b-versatile` may be unavailable on your account.
- Pages with no Readability article or under ~200 characters of text return a clear 422 instead of indexing junk.

## Verification scripts

```bash
npm run probe:embed          # confirm nomic output is 768-d
npm run test:scrapes         # empty / SPA / short-page failures
npx tsx scripts/seed-sites.ts
npm run test:explain -- <siteId>
npm run test:no-answer -- <siteId>
npm run test:groq-stress     # STRESS_N=50 to force 429s
```
