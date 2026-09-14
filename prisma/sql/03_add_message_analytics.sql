ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "rating" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "feedback" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "latencyMs" INTEGER;
CREATE INDEX IF NOT EXISTS "Message_sessionId_idx" ON "Message"("sessionId");
CREATE INDEX IF NOT EXISTS "Message_role_idx" ON "Message"("role");
CREATE INDEX IF NOT EXISTS "ChatSession_siteId_idx" ON "ChatSession"("siteId");
