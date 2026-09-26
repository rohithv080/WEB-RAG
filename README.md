# 🌐 Web RAG — Autonomous AI Knowledge Base Platform

> **Transform any website, live publication, or document into an enterprise-grade AI knowledge assistant in seconds.**  
> Powered by Next.js 15, PostgreSQL (pgvector + BM25 full-text search), Jina AI Multilingual Reranker, Groq Cloud LLM streaming, and Vercel Cron. **100% Free-Tier Engineered.**

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5.25-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Groq Cloud](https://img.shields.io/badge/Groq-Ultra--Fast%20LLM-F55036?style=flat-square)](https://groq.com/)
[![Jina AI](https://img.shields.io/badge/Jina_AI-Embeddings_%26_Reranker-000000?style=flat-square)](https://jina.ai/)
[![Clerk](https://img.shields.io/badge/Clerk-Multi--Tenant%20Auth-6C47FF?style=flat-square&logo=clerk)](https://clerk.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless%20Cron-000000?style=flat-square&logo=vercel)](https://vercel.com/)

---

## ⚡ Core Highlights

- **🌐 Deep Multi-Page Crawling (1 to 100 Pages)**: High-speed sitemap discovery (`/sitemap.xml`, `/sitemap_index.xml`) with parallel link extraction.
- **🛡️ Vercel Timeout Elimination Trap**: Client-driven chunked batching eliminates serverless 15-second execution limits (`504 Gateway Timeout`) with real-time linear-style animated progress bars.
- **🔄 Automated Scheduled Daily Re-Sync (Vercel Cron)**: Background cron (`/api/cron/sync` at `0 1 * * *` / 06:30 AM IST) checks live news portals (e.g. _The Hindu_, _Dinakaran_, _BBC Sport_), deduplicates URLs, and ingests freshly published articles automatically.
- **🧠 Decoupled Hybrid Search + Cross-Encoder Reranking**:
  - **Dense Vector Search**: Jina AI `jina-embeddings-v3` (768-dim) with `vector_cosine_ops` IVFFlat indexing.
  - **Sparse Keyword Search**: PostgreSQL native BM25 full-text search (`tsvector` + GIN indexing) with query expansion.
  - **Reciprocal Rank Fusion (RRF)**: Merges dense and sparse candidates.
  - **Multilingual Cross-Encoder**: `jina-reranker-v2-base-multilingual` computes token-level cross-attention relevance scores, dropping irrelevancies (`score < 0.08`).
- **⚡ Sub-Second Streaming Responses**: Ultra-low latency generation via Groq Cloud (`openai/gpt-oss-20b`) with verifiable citation chips (`[1]`, `[2]`).
- **📎 Multi-Format Document Ingestion**: Supports PDF, Microsoft Word (`.docx`), TXT, Markdown, CSV, and JSON uploads with automatic text extraction.
- **💬 1-Line Embeddable Widget**: Add an interactive chatbot to any external website via a single `<script src=".../widget.js">` tag.
- **🤖 Omnichannel Telegram Bot**: Two-way voice messaging (Groq Whisper transcription + free Neural TTS voice bubble replies), multilingual language selection (English, Tamil, Hindi, Spanish, French), and inline site-picker keyboards.
- **📊 Analytics & Feedback Hub**: Query volume tracking, latency metrics, user satisfaction rates (thumbs up/down), full conversation transcripts, and content gap detection.
- **⚙️ Bot Customization**: Configure AI personas (system prompts), response tones (_Concise_, _Balanced_, _Detailed_), and suggested starter prompt chips.

---

## 🏗️ Architecture & Data Flow

```mermaid
flowchart TB
    subgraph INGESTION ["1. Ingestion & Preprocessing"]
        Web["Web URL (1-100 Pages)"] --> Crawler["Sitemap / Regex Link Discovery"]
        Docs["PDF / TXT / MD / CSV / JSON"] --> Parser["Text Extraction & Normalization"]
        Crawler --> Batcher["Client-Driven Chunked Batcher"]
        Docs --> Batcher
        Batcher --> Chunker["Header-Aware Chunker (1500 chars / 200 overlap)"]
        Chunker --> JinaEmbed["Jina AI Batch Embeddings (768-d)"]
        JinaEmbed --> NeonDB[("Neon PostgreSQL<br/>pgvector + GIN tsvector")]
    end

    subgraph CRON ["2. Automated Daily Synchronization"]
        VercelCron["Vercel Cron: 06:30 AM IST"] --> CronRoute["/api/cron/sync (8.5s Timeout Guard)"]
        CronRoute --> SyncEngine["Incremental Sync Engine"]
        SyncEngine --> SitemapCheck{"Sitemap / RSS Probe"}
        SitemapCheck --> Dedupe["Set Subtraction vs Existing URLs"]
        Dedupe --> IngestNew["Batch Embed & Insert New Articles"]
        IngestNew --> NeonDB
    end

    subgraph INFERENCE ["3. Retrieval & Grounded Generation"]
        UserQuery["User Question / Voice Note"] --> Rewriter["Multi-Turn Query Rewriter"]
        Rewriter --> StandaloneQ["Standalone Query"]
        Rewriter --> ExpandedQ["Expanded Query Synonyms"]
        StandaloneQ --> DenseSearch["pgvector Cosine Search"]
        ExpandedQ --> SparseSearch["PostgreSQL BM25 TSV Search"]
        DenseSearch & SparseSearch --> RRF["Reciprocal Rank Fusion (RRF)"]
        RRF --> Reranker["Jina AI Multilingual Cross-Encoder (Threshold >= 0.08)"]
        Reranker --> PromptBuilder["Grounded Context Assembler"]
        PromptBuilder --> GroqLLM["Groq Cloud LLM (openai/gpt-oss-20b)"]
        GroqLLM --> SSEStream["Streaming SSE + Citations [1], [2]"]
    end

    subgraph CLIENTS ["4. Omnichannel Delivery"]
        SSEStream --> WebApp["Web Dashboard"]
        SSEStream --> EmbedWidget["1-Line External Widget"]
        SSEStream --> TelegramBot["Telegram Bot (Text & Voice)"]
    end
```

---

## 🛠️ Tech Stack

| Component              | Technology                                         | Role                                                                       |
| :--------------------- | :------------------------------------------------- | :------------------------------------------------------------------------- |
| **Frontend Framework** | **Next.js 15.5.25 (App Router)**                   | Server Components, Streaming UI, dynamic routing                           |
| **Language**           | **TypeScript 5.0**                                 | Full end-to-end static type safety                                         |
| **Styling**            | **Vanilla CSS + Styled JSX**                       | Obsidian dark mode (`#0c0c0f`), glassmorphism, responsive micro-animations |
| **Database**           | **Neon PostgreSQL (Serverless)**                   | Relational tables, connection pooling, foreign keys                        |
| **Vector Engine**      | **pgvector (`vector(768)`)**                       | IVFFlat cosine similarity vector index (`lists = 100`)                     |
| **Full-Text Search**   | **PostgreSQL `tsvector` + GIN**                    | Stemmed English keyword matching (`to_tsvector`, `ts_rank_cd`)             |
| **ORM**                | **Prisma 6.19.3**                                  | Type-safe migrations and relational queries                                |
| **Embeddings**         | **Jina AI (`jina-embeddings-v3`)**                 | 768-dimensional multilingual dense embeddings                              |
| **Reranker**           | **Jina AI (`jina-reranker-v2-base-multilingual`)** | Cross-encoder relevance scoring & threshold pruning                        |
| **LLM Inference**      | **Groq Cloud (`openai/gpt-oss-20b`)**              | Ultra-fast sub-second token generation with reasoning control              |
| **Speech-to-Text**     | **Groq Cloud (`whisper-large-v3-turbo`)**          | Telegram audio voice memo transcription                                    |
| **Authentication**     | **Clerk (`@clerk/nextjs`)**                        | Multi-tenant user auth, sessions, super-admin validation                   |
| **Background Cron**    | **Vercel Cron**                                    | Scheduled automated daily re-scraping (`vercel.json`)                      |
| **Rate Limiting**      | **Upstash Redis REST**                             | Distributed sliding window rate limiter (with in-memory fallback)          |

---

## 🔬 Deep Dive: Chunking, Hybrid Search & Reranking Pipeline

### 1. Header-Aware Chunking & Noise Stripping (`src/lib/scraper/chunk.ts`)

- **Target Size**: `MAX_CHARS = 1500` (~350–400 tokens), optimal for Jina's 8192-token context window while keeping embeddings localized to specific answers.
- **Sliding Window Overlap**: `OVERLAP = 200` characters, ensuring context is preserved across paragraph splits.
- **Topological Heading Splitting**: Content is split hierarchically on Markdown headings (`#`, `##`, `###`). The closest heading is stored in `Chunk.heading` and automatically injected into embedding text (`heading\n\ncontent`), dramatically boosting vector search accuracy for questions like _"What are the fares?"_.
- **DOM & Boilerplate Filtering**: `filterBoilerplateFromHtml` strips non-content tags (`<nav>`, `<header>`, `<footer>`, `<aside>`, `<script>`, `<style>`) and regex filters cookie notices, newsletter subscriptions, donation banners, and advertisement prompts.

### 2. Decoupled Hybrid Retrieval & Reciprocal Rank Fusion (RRF)

To prevent keyword lists from polluting dense vector embeddings or cross-encoder attention layers, the query is **decoupled**:

1. **Dense Vector Search**: Evaluates the clean natural language question against 768-d vectors in PostgreSQL using `pgvector` (`<=>` cosine distance).
2. **Sparse Keyword Search**: Queries PostgreSQL's native `tsvector` generated column using `websearch_to_tsquery('simple', $query)` and `ts_rank_cd`.
3. **Reciprocal Rank Fusion**: Merges both candidate sets using:
   $$RRF\_Score(d) = \sum_{m \in \{dense, sparse\}} \frac{1}{60 + Rank_m(d)}$$
   This prevents dense vector search from dominating exact keyword matches (names, flight numbers, model numbers).

### 3. Jina AI Cross-Encoder Reranking (`jina-reranker-v2-base-multilingual`)

- Evaluates full token-level cross-attention between the user's question and the top 30 RRF candidates.
- **Threshold Pruning (`>= 0.08`)**: Candidates scoring below `0.08` are discarded. If no chunk meets this threshold, retrieval returns 0 documents, cleanly triggering the model's fallback response (_"I couldn't find that in the source."_) rather than hallucinating.

---

## 🚀 Getting Started

### Live Demo

Try the production deployment: **[https://rohith-rag.vercel.app](https://rohith-rag.vercel.app)**

### 1. Prerequisites

- **Node.js**: v20.x or higher
- **PostgreSQL**: [Neon](https://neon.tech/) (free tier with `vector` extension) or local PostgreSQL 16+ with `pgvector`
- **Free API Keys**:
  - [Groq Cloud](https://console.groq.com/) (Ultra-fast LLM & Whisper)
  - [Jina AI](https://jina.ai/) (Embeddings & Reranker)
  - [Clerk](https://clerk.com/) (Authentication)

### 2. Clone & Install

```bash
git clone https://github.com/rohithv080/WEB-RAG.git
cd WEB-RAG/web-rag
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in `web-rag/`:

```env
# Groq Cloud (Supports multiple keys separated by commas for automatic rotation)
GROQ_API_KEYS="gsk_your_key_here"
GROQ_MODEL="openai/gpt-oss-20b"

# Jina AI
JINA_API_KEY="jina_your_key_here"

# Database Connection (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@ep-pooler.region.aws.neon.tech/neondb?sslmode=require"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxx"
CLERK_SECRET_KEY="sk_test_xxx"

# Admin & Cron Security
ADMIN_SECRET="your-admin-secret"
ADMIN_EMAIL="your-email@example.com"
CRON_SECRET="your-vercel-cron-secret"

# Telegram Bot (Optional)
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"

# Upstash Redis Rate Limiting (Optional - falls back to memory)
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_redis_token"
```

### 4. Database Setup & Migrations

Run the database setup script to enable `vector`, push Prisma schema, and apply indexes:

```bash
npx prisma generate
npm run db:setup
```

### 5. Run the Local Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Reference

| Endpoint                    | Method   | Description                                                           | Auth                                |
| :-------------------------- | :------- | :-------------------------------------------------------------------- | :---------------------------------- |
| `/api/chat`                 | `POST`   | Streams RAG answer via Server-Sent Events (SSE) with inline citations | Public (Rate limited)               |
| `/api/crawl`                | `POST`   | Discovers link queue from sitemaps and BFS traversal                  | Clerk Auth / Admin                  |
| `/api/scrape`               | `POST`   | Ingests URL batch, generates chunks, embeds, and saves to DB          | Clerk Auth / Admin                  |
| `/api/scrape`               | `PATCH`  | Re-indexes a specific existing page URL                               | Clerk Auth / Admin                  |
| `/api/upload`               | `POST`   | Extracts text from uploaded PDF/Doc and embeds in chunked batches     | Clerk Auth / Admin                  |
| `/api/cron/sync`            | `GET`    | Automated scheduled re-sync with 8.5s timeout defense                 | Vercel Cron (`CRON_SECRET`) / Admin |
| `/api/sites`                | `GET`    | Lists available bots (supports `?scope=all` for super-admin)          | Public / Filtered                   |
| `/api/sites/[id]`           | `PATCH`  | Updates persona, system prompt, starter chips, tone, and auto-sync    | Bot Owner / Admin                   |
| `/api/sites/[id]`           | `DELETE` | Deletes bot and cascades all child pages and chunks                   | Bot Owner / Admin                   |
| `/api/sites/[id]/sync`      | `POST`   | Triggers manual on-demand re-sync for fresh articles                  | Bot Owner / Admin                   |
| `/api/sites/[id]/analytics` | `GET`    | Returns aggregated metrics, logs, transcripts, and content gaps       | Bot Owner / Admin                   |
| `/api/feedback`             | `POST`   | Submits thumbs up/down rating and user comments                       | Public                              |
| `/api/telegram`             | `POST`   | Webhook handler for Telegram messages, voice notes, and callbacks     | Telegram Token                      |

---

## 🌐 1-Line Website Embed

You can embed any bot on your website or blog with a single script tag:

```html
<script
  src="https://rohith-rag.vercel.app/widget.js"
  data-site-id="YOUR_BOT_ID"
  data-position="bottom-right"
  data-primary-color="#7c7cff"
  defer
></script>
```

---

## 🔄 Automated Background Cron Configuration (`vercel.json`)

Vercel Cron runs automatically every day at 06:30 AM IST (`0 1 * * *` UTC) to keep your news and documentation bots fresh:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 1 * * *"
    }
  ]
}
```

---

## 🧪 Verification & Testing

```bash
# Verify TypeScript types and compilation
npm run build

# Test chunked batch endpoints directly
npx tsx scripts/test-batch-endpoints.ts

# Test Jina embeddings and pgvector cosine search
npm run probe:embed

# Stress-test Groq rate limiter handling
npm run test:groq-stress
```

---

## 📄 License

MIT License. Open source and built for developers building enterprise-grade RAG applications on 100% free-tier cloud services.
