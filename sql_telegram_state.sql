CREATE TABLE IF NOT EXISTS "TelegramState" (
    "chatId" BIGINT NOT NULL,
    "siteId" TEXT,
    "language" TEXT,
    CONSTRAINT "TelegramState_pkey" PRIMARY KEY ("chatId")
);

-- In case the table already exists, add the language column
ALTER TABLE "TelegramState" ADD COLUMN IF NOT EXISTS "language" TEXT;
