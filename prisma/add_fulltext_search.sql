-- Add full-text search support to the Chunk table
-- This creates a generated tsvector column and a GIN index for fast BM25-style search

-- Add the tsvector column (auto-generated from content)
ALTER TABLE "Chunk" ADD COLUMN IF NOT EXISTS "tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(heading, '') || ' ' || content)) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "Chunk_tsv_idx" ON "Chunk" USING GIN ("tsv");

-- Also add a regular text index on content for LIKE queries as fallback
CREATE INDEX IF NOT EXISTS "Chunk_content_idx" ON "Chunk" USING GIN (to_tsvector('english', content));
