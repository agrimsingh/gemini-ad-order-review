import { NextResponse } from "next/server";
import { readBenchmarkPdf } from "@/lib/benchmark";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = readBenchmarkPdf(id);
  if (!document) return NextResponse.json({ error: "Unknown document." }, { status: 404 });
  return new NextResponse(new Uint8Array(document.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${document.entry.filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
