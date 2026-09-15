# Complete Technical Architecture Breakdown: Web RAG Platform

---

## 1. Project Overview

**Web RAG** is an enterprise-grade, multi-tenant Retrieval-Augmented Generation (RAG) platform that converts any website URL, documentation repository, or uploaded document (PDF, TXT, Markdown, CSV) into an autonomous, fact-grounded conversational AI chatbot. It solves the dual challenges of LLM hallucinations and stale static knowledge by grounding Groq-accelerated open-weights models (`openai/gpt-oss-20b`) in verified site content using a decoupled hybrid search engine (dense vector embeddings + PostgreSQL BM25 full-text search fused via Reciprocal Rank Fusion and reranked by a multilingual cross-encoder). Its core value proposition is delivering sub-second, multi-turn, citation-verified conversational intelligence that can be deployed across a web dashboard, an embeddable customer-facing widget (`widget.js`), or a bi-directional voice-capable Telegram bot—running entirely within the free tiers of Vercel, Neon, Groq, Jina, and Clerk.

---

## 2. Full Tech Stack

### Core Languages & Runtime
- **TypeScript** `v5.7.0`: Strict-mode type safety throughout all API routes, database clients, retrieval algorithms, and React UI components.
- **Node.js** (Node 20+ runtime target): Primary serverless execution environment configured via `export const runtime = "nodejs"` on API routes.

### Web Framework & Frontend
- **Next.js** `v15.2.0` (compiled with Next.js `15.5.25` in build): App Router architecture with React Server Components, serverless route handlers, and middleware.
- **React** `v19.0.0` & **React DOM** `v19.0.0`: Modern React with concurrent streaming (`ReadableStream`, Server-Sent Events).
- **React Markdown** `v10.1.0` & **Remark GFM** `v4.0.1`: Renders formatted AI responses, GitHub-flavored markdown tables, lists, and inline links.
- **Styling**: Handcrafted, zero-dependency Vanilla CSS (`globals.css` and scoped `<style jsx>`) designed around an obsidian monochrome palette with violet accent tokens (`#7c7cff`, `#a78bfa`).

### Ingestion, Scraping & Document Parsing
- **JSDOM** `v26.0.0`: In-memory DOM construction for extracting semantic main nodes (`<main>`, `<article>`, `#content`), stripping navigation/headers/footers, and extracting links.
- **Turndown** `v7.2.4` & **Turndown Plugin GFM** `v1.0.2`: Converts sanitized HTML DOM trees into clean, normalized ATX-style Markdown with fenced code blocks and table support.
- **unpdf** `v1.8.1`: High-speed serverless PDF extraction engine extracting raw and array text buffers from binary uploads without native C++ binary dependencies.
- **@mozilla/readability** `v0.6.0`: Mozilla's algorithmic article extractor (installed in `package.json`, complemented by custom DOM stripping in `fetchPage.ts`).

### Database & Vector Infrastructure
- **Neon PostgreSQL**: Serverless PostgreSQL with pooled TCP connections (`DATABASE_URL`).
- **pgvector Extension**: Native PostgreSQL vector storage using `vector(768)` dimensions.
- **Prisma ORM** `v6.5.0` (`@prisma/client` & `prisma` CLI): Object-relational mapping, migrations, and raw SQL execution (`$executeRawUnsafe`, `$queryRawUnsafe`).
- **PostgreSQL Full-Text Search**: Native `tsvector` with generated stored column (`tsv`), `websearch_to_tsquery`, and GIN indexing for BM25-style keyword matching.

### Machine Learning, Embeddings & Reranking
- **Jina AI Embeddings API (`jina-embeddings-v3`)**: 768-dimensional dense vector embeddings with task-specific adapters (`retrieval.passage` for document chunks and `retrieval.query` for search questions).
- **Jina AI Reranker API (`jina-reranker-v2-base-multilingual`)**: State-of-the-art multilingual Cross-Encoder reranking computing fine-grained token-level cross-attention relevance scores (0.0 to 1.0).
- **Groq SDK** `v0.15.0`: High-speed LPU inference interface running `openai/gpt-oss-20b` (with low reasoning effort for query condensing and generation), `llama-3.2-11b-vision-preview` (multimodal image analysis), and `whisper-large-v3-turbo` (speech-to-text transcription).

### Authentication, Security & Utilities
- **@clerk/nextjs** `v7.9.2`: Multi-tenant session management, edge middleware route protection, user identity verification, and role-based Super Admin gating.
- **Upstash Redis REST Pipeline** (Optional, supported in `rateLimit.ts`): Distributed sliding-window rate limiting over HTTP.
- **tsx** `v4.23.13`: Fast TypeScript script executor for diagnostic benchmarks and seed tasks.
- **dotenv** `v17.4.2`: Environment variable configuration for CLI scripts.

---

## 3. Architecture & End-to-End Data Flow

```
                                  USER INTERFACES
      [ Dashboard (React 19) ]    [ Embed Widget (iframe) ]    [ Telegram Bot (Audio/Text) ]
                 │                            │                              │
                 └────────────────────────────┼──────────────────────────────┘
                                              ▼
                                 [ Next.js Middleware ]
                      (Clerk Session Check & x-admin-secret Bypass)
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
             [ INGESTION PIPELINE ]                          [ QUERY PIPELINE ]
          (/api/crawl, /api/scrape, /api/upload)                 (/api/chat, /api/telegram)
                      │                                               │
        ┌─────────────┴─────────────┐                                 ├─► 1. Rate Limiting Check
        ▼                           ▼                                 ├─► 2. Greeting Fast-Path
 [ Web Crawler / BFS ]      [ PDF/Doc Parser ]                        ├─► 3. Multi-Turn Query Rewriting
   - Fast sitemap.xml         - unpdf buffer                            │    (Groq gpt-oss-20b condense)
   - Regex link queue         - Text chunking (1500 chars)            ├─► 4. Query Term Expansion
        │                           │                                 │    (Groq gpt-oss-20b expand)
        ▼                           ▼                                 │
 [ Client-Driven Batching ] [ 25-Chunk Streaming ]                    ▼
        │                           │                       [ DECOUPLED HYBRID RETRIEVAL ]
        └─────────────┬─────────────┘                                 │
                      ▼                                               ├─► Dense Vector Search (pgvector)
          [ Jina AI Embeddings ]                                      │    (Cosine distance on standalone query)
          (jina-embeddings-v3 / 768d)                                 ├─► Sparse BM25 Search (Postgres tsv)
                      │                                               │    (GIN index on expanded terms)
                      ▼                                               │
      [ Neon PostgreSQL Bulk Insert ]                                 ▼
   (Parameterized 25-chunk multi-row SQL)                   [ Reciprocal Rank Fusion (RRF) ]
                                                                      │
                                                                      ▼
                                                            [ Jina Cross-Encoder Reranker ]
                                                             (jina-reranker-v2-base-multilingual)
                                                                      │ (Filter score >= 0.08)
                                                                      ▼
                                                            [ Context Formatter & XML ]
                                                            (<document id="X" heading="...">)
                                                                      │
                                                                      ▼
                                                            [ Groq LLM Inference ]
                                                             (openai/gpt-oss-20b Streaming)
                                                                      │
                                                                      ▼
                                                            [ SSE Stream to Client ]
                                                            (data: tokens + citations + metrics)
```

### End-to-End Ingestion Flow
1. **Discovery**: User provides a URL and scope (1, 5, 15, 30, or 100 pages). Client calls `POST /api/crawl`. The server probes `/sitemap.xml` (extracting links in `<300ms`) and falls back to regex BFS HTML crawling with an 8.5s hard deadline. The complete URL queue is returned to the client.
2. **Chunked Scraping**: The client iterates through the queue in sequential batches of 3–5 URLs, posting to `POST /api/scrape`. For each batch:
   - Pages are fetched concurrently (`fetchPage.ts`).
   - Unwanted tags (`<nav>`, `<header>`, `<footer>`, `<aside>`, `<script>`) are pruned via JSDOM.
   - HTML is converted to ATX Markdown via Turndown.
   - Markdown is partitioned into chunks of up to 1,500 characters with 200-character overlaps, preserving nearest `#`, `##`, `###` headings and filtering boilerplate paragraphs.
   - Chunks across the batch are sent in **one unified HTTP request** to Jina AI Embeddings API (`jina-embeddings-v3`).
   - Chunks and 768-dim vectors are committed to Neon PostgreSQL using parameterized multi-row SQL statements (`INSERT INTO "Chunk" VALUES ($1..$7), ($8..$14)...`).
   - The client updates its live animated progress bar: `Indexing page 14 of 30... (45%)`.
3. **Document Ingestion**: For PDFs uploaded via `POST /api/upload`, `unpdf` extracts text. If chunks exceed 25, the initial 25 are inserted immediately and the remainder are streamed sequentially by the client in 25-chunk slices via `POST /api/upload` (`action: "embed-batch"`), eliminating Vercel 15s execution timeouts.

### End-to-End Chat & Query Flow
1. **Authentication & Rate Limiting**: `POST /api/chat` extracts user ID (or client IP via `x-forwarded-for`) and checks the sliding-window rate limit (30 requests/10 min for anonymous, 60 requests/10 min for authenticated users).
2. **Greeting Filter**: A regex scanner detects conversational pleasantries (*"hi"*, *"hello"*, *"how are you"*). Greetings bypass the search pipeline and respond immediately.
3. **Multi-Turn Query Rewriting**: If previous conversational turns exist, `condenseQuery` sends the last 4 messages to Groq's `openai/gpt-oss-20b` (`reasoning_effort: "low"`, ~400ms latency). Pronouns and contextual references (*"how much does it cost?"* → *"how much does Red Taxi one-way outstation cab cost?"*) are resolved into an autonomous standalone search query.
4. **Query Expansion**: Short queries are passed to `expandQuery`, generating synonyms and sub-topics for keyword matching.
5. **Decoupled Hybrid Search**:
   - **Dense Semantic Retrieval**: The natural `standaloneQuery` is embedded via Jina (`retrieval.query`) and queried against `Chunk.embedding` using cosine distance `<=>` in Neon PostgreSQL (retrieving top 40 candidates).
   - **Sparse BM25 Keyword Search**: The `expandedQuery` is queried against `Chunk.tsv` using PostgreSQL's `websearch_to_tsquery('simple', $1)` (retrieving top 40 candidates).
6. **Reciprocal Rank Fusion (RRF)**: Merges vector and BM25 candidate lists into a unified score using standard RRF ($RRF(d) = \sum \frac{1}{60 + rank}$).
7. **Cross-Encoder Reranker**: The top 30 candidates pass to `jina-reranker-v2-base-multilingual`. Token-level cross-attention calculates semantic relevance scores. Chunks scoring below `0.08` are pruned.
8. **Context Assembly & Generation**: Surviving chunks are formatted into `<document id="X" heading="...">` XML blocks. The prompt instructs the model to reason step-by-step in a `<thinking>` tag, cite inline `[1]`, synthesize partial sources if exact answers are missing, or output `"I couldn't find that in the source."` if completely unrelated.
9. **Streaming Delivery**: Streamed to the client via Server-Sent Events (`text/event-stream`). The client receives a `meta` frame (citations, standalone query), real-time `token` deltas, and a final `done` frame logging assistant message latency to the database.

---

## 4. Database Schema

All database structures are defined in `prisma/schema.prisma` and extended via raw PostgreSQL DDL scripts in `prisma/sql/`.

```
┌────────────────────────────────────────────────────────┐
│                          Site                          │
├────────────────────────────────────────────────────────┤
│ id: String (cuid, PK)                                  │
│ name: String?                                          │
│ description: String?                                   │
│ systemPrompt: String?                                  │
│ starterQuestions: Json?                                │
│ tone: String? ("concise" | "balanced" | "detailed")    │
│ userId: String? (Clerk User ID, indexed)               │
│ isPublic: Boolean (default: true)                      │
│ scrapedAt: DateTime (default: now)                     │
└──────────────┬──────────────────────────┬──────────────┘
               │ 1:N                      │ 1:N
               ▼                          ▼
┌─────────────────────────────┐  ┌───────────────────────────┐
│            Page             │  │        ChatSession        │
├─────────────────────────────┤  ├───────────────────────────┤
│ id: String (cuid, PK)       │  │ id: String (cuid, PK)     │
│ siteId: String (FK, indexed)│  │ siteId: String (FK, indx) │
│ url: String                 │  │ createdAt: DateTime       │
│ title: String?              │  └─────────────┬─────────────┘
│ scrapedAt: DateTime         │                │ 1:N
└──────────────┬──────────────┘                ▼
               │ 1:N             ┌───────────────────────────┐
               ▼                 │          Message          │
┌─────────────────────────────┐  ├───────────────────────────┤
│            Chunk            │  │ id: String (cuid, PK)     │
├─────────────────────────────┤  │ sessionId: String (FK)    │
│ id: String (cuid, PK)       │  │ role: String ("user"|...) │
│ pageId: String (FK, indexed)│  │ content: String           │
│ content: String             │  │ citations: Json?          │
│ heading: String?            │  │ rating: String? ("up"|...)│
│ order: Int                  │  │ feedback: String?         │
│ isBoilerplate: Boolean      │  │ latencyMs: Int?           │
│ embedding: vector(768)      │  │ createdAt: DateTime       │
│ tsv: tsvector (generated)   │  └───────────────────────────┘
└─────────────────────────────┘

┌─────────────────────────────┐
│        TelegramState        │
├─────────────────────────────┤
│ chatId: BigInt (PK)         │
│ siteId: String?             │
│ sessionId: String?          │
│ language: String?           │
└─────────────────────────────┘
```

### Table & Column Details
1. **`Site` Table**:
   - `id`: Unique cuid primary key.
   - `name`, `description`: Bot metadata displayed on dashboard and embed cards.
   - `systemPrompt`: Custom persona injected into LLM system prompts.
   - `starterQuestions`: JSON array of clickable starter prompts (`["What are the fares?", "How to book?"]`).
   - `tone`: Personality tuning (`concise`, `balanced`, `detailed`).
   - `userId`: Owner Clerk ID. Indexed (`@@index([userId])`) for tenant filtering.
   - `isPublic`: Controls visibility for unauthenticated public viewers.
   - `autoSync`: Boolean flag enabling automated background re-sync (Vercel Cron).
   - `syncFrequency`: Schedule interval (`daily` or `weekly`, defaults to `daily`).
   - `lastSyncedAt`: Timestamp of the most recent automated or on-demand re-sync execution.
   - `sourceUrl`: Seed root or sitemap URL used for incremental article and page discovery.
   - Cascades delete to `Page` and `ChatSession`.

2. **`Page` Table**:
   - Represents an ingested web URL or file (`file://filename.pdf`).
   - `siteId`: Foreign key to `Site`. Indexed (`@@index([siteId])`).
   - `url`: Canonical source URL.
   - `title`: Extracted document/page title.
   - Cascades delete to `Chunk`.

3. **`Chunk` Table**:
   - `id`: Unique cuid primary key.
   - `pageId`: Foreign key to `Page`. Indexed (`@@index([pageId])`).
   - `content`: Extracted plain-text markdown chunk.
   - `heading`: Nearest H1/H2/H3 header for citation tracking.
   - `order`: 0-indexed integer ordering within document.
   - `isBoilerplate`: Boolean flag identifying cookie notices, donation prompts, or newsletter forms.
   - `embedding`: Unsupported `vector(768)` managed by `pgvector`.
   - `tsv`: Unsupported `tsvector` generated column (`to_tsvector('english', coalesce(heading, '') || ' ' || content)`).

4. **`ChatSession` Table**:
   - Session container for multi-turn threads.
   - `siteId`: Foreign key to `Site`. Indexed (`@@index([siteId])`).
   - Cascades delete to `Message`.

5. **`Message` Table**:
   - `sessionId`: Foreign key to `ChatSession`. Indexed (`@@index([sessionId])`).
   - `role`: `"user"` or `"assistant"`. Indexed (`@@index([role])`).
   - `citations`: JSON array storing citation objects (`[{ index, chunkId, heading, snippet, score, pageUrl }]`).
   - `rating`: User feedback (`"up"` or `"down"`).
   - `feedback`: User comments.
   - `latencyMs`: Generation latency in milliseconds.

6. **`TelegramState` Table**:
   - `chatId`: Telegram user chat ID (`BigInt`, primary key).
   - `siteId`, `sessionId`, `language`: Maintains persistent conversation state and language preferences across Telegram sessions.

### Key Indexes & SQL Enhancements
- **Vector Cosine Index** (`prisma/sql/02_chunk_index.sql`):
  Uses modern Hierarchical Navigable Small World (**HNSW**) indexing for sub-10ms approximate nearest neighbor search that scales past 1,000,000 vectors without requiring training phases:
  ```sql
  CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx
    ON "Chunk" USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  ```
  *(With legacy fallback to IVFFlat `WITH (lists = 100)` on pgvector versions < 0.5.0)*.
- **Full-Text GIN Index** (`prisma/add_fulltext_search.sql`):
  ```sql
  ALTER TABLE "Chunk" ADD COLUMN IF NOT EXISTS "tsv" tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(heading, '') || ' ' || content)) STORED;
  CREATE INDEX IF NOT EXISTS "Chunk_tsv_idx" ON "Chunk" USING GIN ("tsv");
  ```
- **Analytics Indexes** (`prisma/sql/03_add_message_analytics.sql`):
  Indexes on `Message(sessionId)`, `Message(role)`, and `ChatSession(siteId)` for aggregated analytics queries.

---

## 5. API Surface

| Endpoint | Method | Purpose | Request Shape | Response Shape | Auth Requirements |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/chat` | `POST` | Primary RAG chat completions stream | `{ question: string, siteId: string, sessionId?: string, language?: string }` | SSE Stream (`text/event-stream`) delivering `meta`, `token`, `done`, or `error` JSON events | Public (Protected by IP/User Rate Limit: 30/10m anon, 60/10m auth) |
| `/api/chat` | `OPTIONS` | CORS preflight handler | None | Status 204 with permissive CORS headers | Public |
| `/api/crawl` | `POST` | Sitemap & BFS link discovery | `{ url: string, maxPages?: number, depth?: number }` | `{ urls: string[], total: number, sitemapFound: boolean, elapsedMs: number }` | Clerk Auth OR `x-admin-secret` |
| `/api/scrape` | `POST` | Single or chunked batch page ingestion | `{ url?: string, urls?: string[], siteId?: string, name?: string, description?: string, autoSync?: boolean }` | `{ siteId, pageId, sessionId, siteName, processedCount, chunkCount, pageIds, ... }` | Clerk Auth OR `x-admin-secret` (Tenant Ownership Verified) |
| `/api/scrape` | `PATCH` | Re-scrapes an existing page | `{ pageId: string }` | `BatchIndexResult` | Clerk Auth OR `x-admin-secret` (Tenant Ownership Verified) |
| `/api/upload` | `POST` | File upload & chunked batch embedding | Form-data: `{ file, siteName?, siteDescription?, siteId? }` OR JSON: `{ action: "embed-batch", pageId, siteId, chunks }` | `{ success: true, done: boolean, siteId, pageId, totalChunks, processedChunks, pendingChunks: [...] }` | Clerk Auth OR `x-admin-secret` (Tenant Ownership Verified) |
| `/api/cron/sync` | `GET` | Automated scheduled re-sync (Vercel Cron) | None | `{ success: true, executedAt, totalEligibleSites, processedSites, syncedSites, summary: [...] }` | Vercel Cron (`Authorization: Bearer ${CRON_SECRET}`) OR `x-admin-secret` |
| `/api/sites` | `GET` | Lists available bots | Query param: `?scope=all` (Admin only) | `{ sites: SiteSummary[], isAdmin: boolean }` | Public (Filters to public bots if unauthenticated; returns user's bots if authenticated; returns all if super admin) |
| `/api/sites/[id]` | `GET` | Fetches individual bot metadata & pages | URL param: `id` | `{ site: SiteWithPages }` | Public |
| `/api/sites/[id]` | `PATCH` | Updates bot settings, prompts, questions | `{ name?, description?, systemPrompt?, starterQuestions?, tone?, isPublic?, autoSync?, syncFrequency?, sourceUrl? }` | `{ success: true, site: Site }` | Clerk Auth (Owner) OR Super Admin |
| `/api/sites/[id]` | `DELETE` | Deletes bot and cascades all children | URL param: `id` | `{ success: true }` | Clerk Auth (Owner) OR Super Admin |
| `/api/sites/[id]/sync` | `POST` | Triggers manual on-demand re-sync for a bot | `{ maxPages?: number }` | `{ success: true, siteId, siteName, newPagesCount, newUrls, message, site }` | Clerk Auth (Owner) OR Super Admin OR `x-admin-secret` |
| `/api/sites/[id]/analytics` | `GET` | Fetches aggregated analytics & transcripts | URL param: `id` | `{ stats: { totalSessions, totalQueries, totalResponses, thumbsUp, thumbsDown, satisfactionRate, avgLatencyMs }, sessions, topCitations, contentGaps, queryVolume }` | Clerk Auth (Owner) OR Super Admin |
| `/api/feedback` | `POST` | Submits thumbs up/down and comment | `{ messageId: string, rating: "up" \| "down" \| null, feedback?: string }` | `{ success: true, message: { id, rating, feedback } }` | Public (Embed widget & Dashboard) |
| `/api/telegram` | `POST` | Webhook receiver for Telegram messages/audio | Telegram `Update` object (messages, voice notes, inline callbacks) | Status 200 `{ ok: true }` | Verified via Telegram Bot Token in webhook configuration |

---

## 6. Core Logic & Algorithms

### 1. Multi-Turn Conversational Query Rewriting (`condenseQuery`)
- **What it does**: When a user asks a contextual follow-up (*"How much is it?"*, *"Can I take a pet with them?"*), it examines the last 4 messages in the session and reformulates the question into an autonomous, entity-rich standalone question (*"What is the pet policy for Red Taxi outstation cabs?"*).
- **Why it's built that way**: Raw conversational follow-ups fail completely in vector and keyword search because they lack the core nouns and entities established in earlier turns.
- **Tradeoffs & Optimizations**:
  - Greeting queries (*"hi"*, *"thanks"*) bypass rewriting completely.
  - Runs on Groq's `openai/gpt-oss-20b` with `reasoning_effort: "low"` and `temperature: 0.0`. By forcing low reasoning effort, generation takes ~400ms rather than 3,000ms, and avoids depleting the completion token budget on internal chain-of-thought tokens.

### 2. Decoupled Hybrid Search (Vector + BM25 + Reciprocal Rank Fusion)
- **What it does**: Simultaneously runs:
  1. Dense vector cosine search (`Chunk.embedding <=> CAST($1 AS vector)`) in PostgreSQL using Jina embeddings (`retrieval.passage`).
  2. Sparse keyword matching using PostgreSQL full-text search (`ts_rank_cd(Chunk.tsv, websearch_to_tsquery('simple', $1))`).
  3. Fuses both ranked candidate lists using Reciprocal Rank Fusion ($RRF\_Score = \sum \frac{1}{60 + rank}$).
- **The Decoupled Query Strategy**:
  - Query expansion (`expandQuery`) generates synonyms (*"pasta, penne, spaghetti, recipes"*).
  - Passing keyword lists to dense vector encoders or cross-encoders damages ranking scores because cross-encoders expect natural grammatical sentences.
  - Therefore, the search pipeline is **decoupled**: the clean `standaloneQuery` is sent to the dense vector encoder and Jina cross-encoder, while the comma-separated `expandedQuery` is sent exclusively to PostgreSQL BM25 keyword matching.

### 3. Jina AI Cross-Encoder Reranker (`jina-reranker-v2-base-multilingual`)
- **What it does**: Takes the top 30 candidates from RRF fusion and computes token-level cross-attention relevance scores against the user's natural question.
- **Why it's built that way**: Bi-encoders (vector embeddings) evaluate query and document in isolation. Cross-encoders examine interaction terms between every word in the query and every word in the document, achieving dramatically higher precision.
- **Threshold Pruning**: Any chunk scoring below `0.08` is dropped. If all chunks score below `0.08`, the search returns zero documents, triggering the model's strict fallback behavior (*"I couldn't find that in the source."*) and hiding citation cards.

### 4. Client-Driven Chunked Batching & Vercel Timeout Elimination
- **What it does**: Eliminates Vercel's Hobby 15-second execution limit (`504 Gateway Timeout`):
  - In URL crawling: `/api/crawl` only discovers links (finishing in <3s). The client then processes URLs in sequential batches of 3–5 pages via `POST /api/scrape`.
  - In PDF uploads: PDFs with `>25 chunks` embed the first 25 chunks and return the pending array. The client streams remaining chunks in 25-chunk batches via `POST /api/upload` (`action: "embed-batch"`).
- **Why it's built that way**: Serverless workers on free tiers cannot run long-lived 60-second jobs. Pushing queue orchestration to the client guarantees that every single HTTP transaction takes only 1.2–2.5s, while providing real-time progress bar feedback (`Indexing page 14 of 30... (45%)`).

### 5. Multi-Row Parameterized SQL Chunk Insertion
- **What it does**: Rather than executing individual `$executeRawUnsafe` statements for each chunk, `insertChunksBulk` constructs a single parameterized multi-row query:
  ```sql
  INSERT INTO "Chunk" (id, "pageId", content, heading, "order", "isBoilerplate", embedding)
  VALUES ($1, $2, $3, $4, $5, $6, CAST($7 AS vector)),
         ($8, $9, $10, $11, $12, $13, CAST($14 AS vector))...
  ```
- **Why it's built that way**: Over remote cloud databases (Neon PostgreSQL on AWS), executing 30 individual queries consumes 2,500ms in network roundtrips. Batching into 25-chunk parameterized statements executes in ~120ms (a 20x speedup).

### 6. HTML Sanitization, Hierarchical Chunking & Noise Filtering (`chunk.ts` & `fetchPage.ts`)
- **DOM Sanitization**: `fetchPage.ts` cleans the DOM with JSDOM, stripping non-content tags (`<nav>`, `<header>`, `<footer>`, `<aside>`, `<script>`, `<style>`, `[role="banner"]`). `Turndown` transforms the content into clean GitHub-flavored markdown.
- **Hierarchical Heading Split**: `chunk.ts` splits sections along Markdown heading boundaries (`/\n(?=#{1,3}\s+)/`).
- **Exact Chunking Parameters**:
  - **Max Chunk Size**: `MAX_CHARS = 1500` characters (~300–375 words / ~350–400 tokens), tuned to stay well within Jina's 8192-token window while maintaining high semantic density.
  - **Sliding Window Overlap**: `OVERLAP = 200` characters, ensuring cross-boundary continuity.
  - **Heading Context Injection**: When generating embeddings, the parent section heading is prepended to the text (`heading\n\ncontent`). This ensures chunks inherit their contextual anchor (e.g., *"Fares & Pricing"* or *"Cancellation Policy"*), preventing orphan chunks.
  - **Boilerplate Filtering**: Regex patterns (`BOILERPLATE_PATTERNS`) detect and discard subscription popups, donation banners, cookie consent dialogs, and newsletter signup blocks (`filterBoilerplateFromHtml`).

### 7. Dual-Mode Sliding Window Rate Limiting (`rateLimit.ts`)
- **What it does**: Tracks request volume per client key over a 600-second window.
- **Why it's built that way**: If `UPSTASH_REDIS_REST_URL` is configured, it executes an atomic pipeline (`ZREMRANGEBYSCORE`, `ZADD`, `ZCARD`, `EXPIRE`) against Upstash Redis REST. If not configured, it falls back to an in-memory `Map<string, number[]>` with automated interval garbage collection.

### 8. Incremental Sitemap & News Sync Engine with Timeout Defense (`sync.ts`)
- **What it does**: Automatically detects and ingests newly published news articles and pages for any bot tracking a live publication (e.g., *Dinakaran*, *The Hindu*, *BBC Sport*, blogs):
  1. Resolves the seed source URL (`Site.sourceUrl` or the first HTTP/HTTPS page).
  2. Probes sitemaps (`/sitemap.xml`, `/sitemap_index.xml`, `/news-sitemap.xml`) in `<400ms`. If sitemaps are not available, it performs lightweight regex link extraction on the homepage HTML.
  3. **Zero-Duplicate Set Subtraction**: Normalizes and compares discovered URLs against existing `Page.url` records in PostgreSQL. Only unindexed, newly published URLs are selected.
  4. Ingests fresh articles using `indexPagesBatch` (Jina bulk embedding and multi-row SQL insert) and updates `lastSyncedAt`.
- **Vercel Hobby Serverless Timeout Defense**:
  - Vercel Hobby serverless functions have a strict 10–15 second timeout. A long loop across dozens of sites would trigger a `504 Gateway Timeout`.
  - The cron route (`/api/cron/sync`) enforces a **Hard Deadline Guard (`DEADLINE_MS = 8_500`)** and an **Oldest-First Rotation (`orderBy: { lastSyncedAt: 'asc' }`)**.
  - When the execution timer nears 8.5 seconds, the cron cleanly returns a partial summary. Remaining sites are serviced on subsequent cron runs without ever crashing the lambda.

---

## 7. Third-Party Integrations & External Services

| Service | Protocol / Client | Purpose | Authentication / Config |
| :--- | :--- | :--- | :--- |
| **Groq Cloud** | `groq-sdk` / HTTPS REST | Ultra-fast LLM inference (`openai/gpt-oss-20b`), speech transcription (`whisper-large-v3-turbo`), and vision analysis (`llama-3.2-11b-vision-preview`) | `GROQ_API_KEYS` (supports comma-separated rotation) |
| **Jina AI** | Native `fetch` / HTTPS REST | Dense document & query embeddings (`jina-embeddings-v3`), and cross-encoder reranking (`jina-reranker-v2-base-multilingual`) | `JINA_API_KEY` |
| **Neon PostgreSQL** | Prisma ORM over PostgreSQL connection pool | Relational data, foreign keys, vector similarity (`pgvector`), full-text search (`tsvector`) | `DATABASE_URL` |
| **Clerk** | `@clerk/nextjs` (Edge Middleware & React Providers) | Multi-tenant user auth, session tokens, user profile modals, and super-admin validation (`ADMIN_EMAIL`) | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| **Vercel Cron** | HTTPS Scheduled Trigger (`vercel.json`) | Automated background synchronization of active news/publication bots daily at 06:30 AM IST (`0 1 * * *`) | `CRON_SECRET` header |
| **Telegram Bot API** | HTTPS Webhooks (`/api/telegram`) | Bi-directional Telegram bot interface supporting audio voice memos, language preferences, and interactive inline keyboards | `TELEGRAM_BOT_TOKEN` |
| **Upstash Redis** | HTTPS REST Pipeline | Distributed global rate limiting across serverless isolates (optional fallback to memory) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Vercel** | Git CI/CD Integration | Production hosting, edge routing, automated SSL, and preview deployments | Standard Vercel deployment pipeline |

---

## 8. Known Gaps, Resolved Cleanups & Implementation Quirks

1. **Resolved Cleanups**:
   - **Unused Dependency Removed**: `@xenova/transformers` was uninstalled and removed from `package.json` (reducing dependencies by 76 sub-packages).
   - **Dead Code Pruned**: `src/lib/scraper/vision.ts` (unused multimodal experiment) was deleted.
   - **Root Scratch Scripts Cleaned**: Removed 11 legacy scratch scripts and payloads (`add-lang.*`, `check*.js`, `poll.js`, `test*.js`, `sql_telegram_state.sql`). Formal regression and benchmark suites are preserved under `scripts/`.
2. **Serverless In-Memory Rate Limiting Boundary**:
   - In `rateLimit.ts`, when Upstash Redis credentials are omitted, rate limiting uses an in-memory JavaScript `Map`. On Vercel Hobby, serverless lambdas spin up in isolated micro-VMs. As a consequence, in-memory rate limiting only tracks requests that land on the same warm container instance. True global rate limiting across all lambda instances requires provisioning Upstash Redis (`UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`).
3. **Widget Domain Whitelisting**:
   - The embed script (`public/widget.js`) and embed route (`src/app/embed/[id]/page.tsx`) allow any website to embed a bot given its ID. There is currently no `allowedOrigins` column in the `Site` table to restrict iframe embedding to specific domains.
4. **JavaScript-Rendered SPA Boundary**:
   - Headless Chromium (Playwright/Puppeteer) is intentionally excluded to maintain a 100% free-tier serverless deployment (avoiding >50MB bundle sizes and container memory ceilings). Fast SSR parsing (`jsdom` + `Readability`) covers standard publications, documentation hubs, and news portals. For heavy client-rendered SPAs (React/Vue hydration), the architectural upgrade path is delegating link fetching to an external headless API (such as Jina Reader `r.jina.ai` or Firecrawl).
5. **Evaluation Harness & Benchmark Metrics Roadmap**:
   - The repository provides functional benchmark and stress scripts (`scripts/test-batch-endpoints.ts`, `scripts/explain-retrieval.ts`, `scripts/stress-groq-retry.ts`). For enterprise benchmarking, integrating a formal evaluation harness (RAGAS / TruLens) tracking Context Recall@k, Faithfulness, and Answer Relevance against a golden test set is the natural next step.
6. **Tunable Reranking Thresholds**:
   - The global cross-encoder cutoff is set to `0.08`. While optimal for general documentation and news, exposing an optional sensitivity slider in the **Bot Settings Modal** allows users to tune between strict precision (0.15+) and broad recall (0.04+).

---

## 9. How to Run & Local Development Setup

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **PostgreSQL**: Neon PostgreSQL with `vector` extension enabled, or a local PostgreSQL 16+ instance with `pgvector`.

### 2. Environment Configuration (`.env`)
Create a `.env` file in the root directory:

```env
# Groq API Keys (Supports comma-separated keys for automatic round-robin rotation)
GROQ_API_KEYS="gsk_key1,gsk_key2"
GROQ_MODEL="openai/gpt-oss-20b"

# Jina AI (Embeddings & Cross-Encoder Reranker)
JINA_API_KEY="jina_xxx"

# Database Connection (Neon PostgreSQL with connection pooler)
DATABASE_URL="postgresql://user:password@ep-pooler.region.aws.neon.tech/neondb?sslmode=require"

# Admin Secret (Bypasses Clerk session guards for local scripts and CLI tools)
ADMIN_SECRET="admin-secret-change-me"
ADMIN_EMAIL="your-email@example.com"

# Vercel Cron Security (Protects /api/cron/sync against unauthorized calls)
CRON_SECRET="your-vercel-cron-secret"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxx"
CLERK_SECRET_KEY="sk_test_xxx"

# Telegram Bot (Optional — for Telegram integration)
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHI..."

# Upstash Redis (Optional — for distributed serverless rate limiting)
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

### 3. Database Initialization
Because PostgreSQL requires the `vector` extension before Prisma can parse `Unsupported("vector(768)")`, run the setup pipeline in order:

```bash
# 1. Enable pgvector extension
npm run db:ext

# 2. Push Prisma schema
npm run db:push

# 3. Create IVFFlat cosine index & GIN full-text search index
npm run db:index
```
*(Alternatively, execute `npm run db:setup` which runs all three in sequence).*

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 5. Running Verification & Diagnostic Benchmarks
```bash
# Verify embedding dimensions against the schema (768-dim)
npm run probe:embed

# Test decoupled hybrid retrieval on live database
npm run test:explain

# Benchmark Groq rate-limiting backoff and retry budget
npm run test:groq-light

# Test client-driven batch crawl, scrape, and chunked upload endpoints
npx tsx scripts/test-batch-endpoints.ts

# Production build test
npm run build
```

### 6. Local Development Quirks & Gotchas
- **Ingestion Auth Guard**: `/api/crawl`, `/api/scrape`, and `/api/upload` require either a valid Clerk session cookie or `x-admin-secret: <ADMIN_SECRET>` in the HTTP headers. When writing CLI scripts, always include `x-admin-secret`.
- **Groq Token Exhaustion**: If changing `GROQ_MODEL`, ensure any model with reasoning capability (like `openai/gpt-oss-20b`) passes `reasoning_effort: "low"`. Otherwise, reasoning tokens will consume the max token budget before generating output text.
- **PowerShell Separator**: On Windows PowerShell, command chaining must use semicolon `;` rather than `&&` (e.g. `git add -A ; git commit -m "..." ; git push origin main`).
