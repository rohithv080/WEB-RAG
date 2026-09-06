-- Run AFTER prisma db push (table must exist; better with some rows, works empty on recent pgvector):
--   npx prisma db execute --file prisma/sql/02_chunk_index.sql --schema prisma/schema.prisma

CREATE INDEX IF NOT EXISTS chunk_embedding_cosine_idx
  ON "Chunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
