import { NextRequest } from "next/server";
import { handleChatCompletions, handleOptions } from "@/lib/openaiGateway";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  return handleChatCompletions(req);
}
