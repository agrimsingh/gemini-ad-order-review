import { NextResponse } from "next/server";
import { readBenchmarkPdf } from "@/lib/benchmark";
import { extractPdf, isSupportedModel } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const modelValue = String(form.get("model") ?? "gemini-3.5-flash");
    if (!isSupportedModel(modelValue)) {
      return NextResponse.json({ error: "Unsupported model selection." }, { status: 400 });
    }

    const upload = form.get("pdf");
    const documentId = String(form.get("documentId") ?? "");
    let buffer: Buffer;

    if (upload instanceof File && upload.size > 0) {
      if (upload.size > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "PDF exceeds the 50 MB limit." }, { status: 413 });
      }
      if (upload.type !== "application/pdf" && !upload.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ error: "Only PDF documents are supported." }, { status: 415 });
      }
      buffer = Buffer.from(await upload.arrayBuffer());
    } else {
      const benchmark = readBenchmarkPdf(documentId);
      if (!benchmark) {
        return NextResponse.json(
          { error: "Provide a PDF upload or benchmark document id." },
          { status: 400 },
        );
      }
      buffer = benchmark.buffer;
    }

    const result = await extractPdf(buffer, modelValue);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini extraction failed.";
    console.error("Extraction failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
