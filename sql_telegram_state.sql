CREATE TABLE IF NOT EXISTS "TelegramState" (
    "chatId" BIGINT NOT NULL,
    "siteId" TEXT,
    CONSTRAINT "TelegramState_pkey" PRIMARY KEY ("chatId")
);
