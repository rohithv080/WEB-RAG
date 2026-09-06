-- Enable pgvector and create cosine index on Chunk.embedding
-- Run after: npx prisma db push  (or as part of migrate)
--   npx prisma db execute --file prisma/migrations/0_pgvector/migration.sql --schema prisma/schema.prisma

CREATE EXTENSION IF NOT EXISTS vector;

-- IVFFlat index for cosine similarity (requires some rows for good lists;
-- lists=100 is fine for demos; raise for large corpora)
CREATE INDEX IF NOT EXISTS chunk_embedding_cosine_idx
  ON "Chunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
