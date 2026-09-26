import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing API key ID" }, { status: 400 });
    }

    const { userId, isAdmin } = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (apiKey.userId !== userId && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized to delete this key" }, { status: 403 });
    }

    await prisma.apiKey.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedKeyId: id });
  } catch (error: any) {
    console.error("[delete api key] Error:", error);
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
  }
}
