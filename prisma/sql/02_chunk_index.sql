-- Run AFTER prisma db push (table must exist):
--   npx prisma db execute --file prisma/sql/02_chunk_index.sql --schema prisma/schema.prisma

-- HNSW Index (Recommended for Production & High Scale):
-- Faster queries, higher recall@k, no training phase required, and scales past 1M vectors.
CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx
  ON "Chunk"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Fallback IVFFlat index (if HNSW is unavailable on older pgvector versions < 0.5.0):
-- CREATE INDEX IF NOT EXISTS chunk_embedding_cosine_idx
--   ON "Chunk"
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
