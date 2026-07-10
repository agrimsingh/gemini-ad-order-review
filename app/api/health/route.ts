import { NextResponse } from "next/server";
import { SUPPORTED_MODELS } from "@/lib/gemini";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    keyConfigured: Boolean(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY),
    models: SUPPORTED_MODELS,
    api: "interactions",
    pdfInput: "high-resolution page images",
  });
}
