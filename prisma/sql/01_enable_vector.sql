-- Run BEFORE prisma db push so the vector type exists:
--   npx prisma db execute --file prisma/sql/01_enable_vector.sql --schema prisma/schema.prisma

CREATE EXTENSION IF NOT EXISTS vector;
