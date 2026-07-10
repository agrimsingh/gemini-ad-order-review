import { NextResponse } from "next/server";
import { benchmarkSourcesAvailable, getManifest } from "@/lib/benchmark";

export const runtime = "nodejs";

export function GET() {
  const documents = getManifest();
  return NextResponse.json({
    documents,
    sourcesAvailable: benchmarkSourcesAvailable(),
    summary: {
      documents: documents.length,
      pages: documents.reduce((total, entry) => total + entry.page_count, 0),
      lineItems: documents.reduce((total, entry) => total + entry.line_item_count, 0),
      scoreExclusions: documents.reduce(
        (total, entry) => total + entry.score_excluded_fields.length,
        0,
      ),
    },
  });
}
