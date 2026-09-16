import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { generateApiKey, maskApiKey } from "@/lib/apiKey";

export async function GET() {
  try {
    const { userId } = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
    });

    const formatted = keys.map((k) => ({
      id: k.id,
      name: k.name,
      maskedKey: maskApiKey(k.key),
      siteId: k.siteId,
      siteName: k.site?.name || "All Bots (Global)",
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    }));

    return NextResponse.json({ keys: formatted });
  } catch (error: any) {
    console.error("[get api keys] Error:", error);
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const siteId = typeof body.siteId === "string" && body.siteId ? body.siteId : null;

    if (!name) {
      return NextResponse.json({ error: "API key name is required" }, { status: 400 });
    }

    if (siteId) {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: { id: true, userId: true },
      });
      if (!site) {
        return NextResponse.json({ error: "Specified bot not found" }, { status: 404 });
      }
      if (site.userId && site.userId !== userId) {
        return NextResponse.json({ error: "Unauthorized to scope key to this bot" }, { status: 403 });
      }
    }

    const rawKey = generateApiKey();

    const created = await prisma.apiKey.create({
      data: {
        key: rawKey,
        name,
        userId,
        siteId,
      },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      key: {
        id: created.id,
        name: created.name,
        rawKey, // returned once upon creation
        maskedKey: maskApiKey(rawKey),
        siteId: created.siteId,
        siteName: created.site?.name || "All Bots (Global)",
        createdAt: created.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[create api key] Error:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
