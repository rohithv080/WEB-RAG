import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageId, rating, feedback } = body;

    if (!messageId || typeof messageId !== "string") {
      return NextResponse.json(
        { error: "messageId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (rating !== "up" && rating !== "down" && rating !== null) {
      return NextResponse.json(
        { error: "rating must be 'up', 'down', or null" },
        { status: 400, headers: corsHeaders }
      );
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        rating: rating,
        feedback: typeof feedback === "string" ? feedback.trim().slice(0, 1000) : undefined,
      },
      select: {
        id: true,
        rating: true,
        feedback: true,
      },
    });

    return NextResponse.json(
      { success: true, message: updated },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("[feedback error]", err);
    return NextResponse.json(
      { error: "Failed to record feedback" },
      { status: 500, headers: corsHeaders }
    );
  }
}
