import { NextResponse } from "next/server";
import { readBenchmarkPdf } from "@/lib/benchmark";
import { renderPdfPreview } from "@/lib/pdf";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = readBenchmarkPdf(id);
  if (!document) return NextResponse.json({ error: "Unknown document." }, { status: 404 });
  const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
  const preview = await renderPdfPreview(document.buffer, Number.isFinite(page) ? page : 1);
  return new NextResponse(new Uint8Array(preview.buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
      "X-Page": String(preview.page),
      "X-Page-Count": String(preview.pageCount),
    },
  });
}
