import crypto from "crypto";
import { prisma } from "@/lib/db";

const API_KEY_PREFIX = "wr_live_";

/**
 * Generate a cryptographically secure random API key with a standard prefix.
 * e.g., "wr_live_a1b2c3d4e5f6..."
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  return `${API_KEY_PREFIX}${randomBytes}`;
}

/**
 * Masks an API key for safe display in dashboard tables.
 * e.g., "wr_live_••••••••••••••••e5f6"
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 12) return "wr_live_••••••••";
  const lastFour = key.slice(-4);
  return `${API_KEY_PREFIX}••••••••••••••••${lastFour}`;
}

export type VerifiedApiKey = {
  id: string;
  name: string;
  userId: string;
  siteId: string | null;
  siteName: string | null;
};

/**
 * Validates an incoming API Key from an Authorization header or raw key string.
 * Updates lastUsedAt asynchronously upon successful verification.
 */
export async function verifyApiKey(
  input: Request | Headers | string | null | undefined
): Promise<VerifiedApiKey | null> {
  let rawKey: string | null = null;

  if (typeof input === "string") {
    rawKey = input.trim();
  } else if (input && "headers" in input) {
    const authHeader = input.headers.get("authorization") || input.headers.get("x-api-key");
    if (authHeader) {
      if (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer ")) {
        rawKey = authHeader.slice(7).trim();
      } else {
        rawKey = authHeader.trim();
      }
    }
  } else if (input && "get" in input) {
    const authHeader = (input as Headers).get("authorization") || (input as Headers).get("x-api-key");
    if (authHeader) {
      if (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer ")) {
        rawKey = authHeader.slice(7).trim();
      } else {
        rawKey = authHeader.trim();
      }
    }
  }

  if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  try {
    const record = await prisma.apiKey.findUnique({
      where: { key: rawKey },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
    });

    if (!record) {
      return null;
    }

    // Touch lastUsedAt asynchronously
    prisma.apiKey
      .update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => {
        console.error("[verifyApiKey] Failed to update lastUsedAt:", err);
      });

    return {
      id: record.id,
      name: record.name,
      userId: record.userId,
      siteId: record.siteId,
      siteName: record.site?.name || null,
    };
  } catch (error) {
    console.error("[verifyApiKey] DB Error:", error);
    return null;
  }
}
