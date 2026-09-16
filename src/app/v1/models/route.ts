import { NextRequest } from "next/server";
import { handleModels, handleOptions } from "@/lib/openaiGateway";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  return handleModels(req);
}
