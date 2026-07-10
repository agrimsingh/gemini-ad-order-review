import { NextResponse } from "next/server";
import { SUPPORTED_MODELS } from "@/lib/gemini";
import { configuredPdfInputMode } from "@/lib/runtime-config";

export const runtime = "nodejs";

export function GET() {
  const inputMode = configuredPdfInputMode();
  return NextResponse.json({
    ok: true,
    keyConfigured: Boolean(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY),
    models: SUPPORTED_MODELS,
    api: "interactions",
    pdfInputMode: inputMode,
    pdfInput: inputMode === "inline_pdf_document" ? "Inline PDF fallback" : "High-resolution pages",
    maxPdfBytes: process.env.VERCEL === "1" ? 4 * 1024 * 1024 : 50 * 1024 * 1024,
  });
}
