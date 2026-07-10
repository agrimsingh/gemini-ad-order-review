import fs from "node:fs/promises";
import path from "node:path";
import { compareToGold } from "../shared/evaluation";
import { aggregateBenchmarkRuns, type BenchmarkDocumentRun } from "../shared/benchmark-report";
import type { ManifestEntry } from "../shared/types";
import { getManifest, readBenchmarkPdf, readGoldLabel } from "../lib/benchmark";
import { extractPdf, isSupportedModel } from "../lib/gemini";

const requestedModelValue = process.argv[2] ?? "gemini-3.5-flash";
if (!isSupportedModel(requestedModelValue)) {
  throw new Error(`Unsupported model: ${requestedModelValue}`);
}
const requestedModel = requestedModelValue;

async function runDocument(entry: ManifestEntry): Promise<BenchmarkDocumentRun> {
  const pdf = readBenchmarkPdf(entry.document_id);
  const gold = readGoldLabel(entry.document_id);
  if (!pdf || !gold) {
    return {
      documentId: entry.document_id,
      slice: entry.slice,
      difficulty: entry.difficulty,
      pages: entry.page_count,
      expectedLineItems: entry.line_item_count,
      status: "failed",
      error: "Missing benchmark PDF or gold label.",
    };
  }

  try {
    const result = await extractPdf(pdf.buffer, requestedModel);
    return {
      documentId: entry.document_id,
      slice: entry.slice,
      difficulty: entry.difficulty,
      pages: entry.page_count,
      expectedLineItems: entry.line_item_count,
      status: "completed",
      result,
      comparison: compareToGold(
        result.extraction,
        gold,
        entry.score_excluded_fields,
        entry.score_line_items !== false,
        entry.line_item_score_exclusion_reason ?? null,
      ),
    };
  } catch (error) {
    return {
      documentId: entry.document_id,
      slice: entry.slice,
      difficulty: entry.difficulty,
      pages: entry.page_count,
      expectedLineItems: entry.line_item_count,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown evaluation error.",
    };
  }
}

const runs: BenchmarkDocumentRun[] = [];
for (const [index, entry] of getManifest().entries()) {
  process.stdout.write(
    `[${index + 1}/${getManifest().length}] ${entry.document_id} (${entry.page_count}p, ${entry.line_item_count} rows)... `,
  );
  const run = await runDocument(entry);
  runs.push(run);
  if (run.status === "completed") {
    console.log(
      `${run.result?.validation.route.toUpperCase()} ${run.result?.telemetry.latencyMs}ms $${run.result?.telemetry.estimatedCostUsd.toFixed(4)}`,
    );
  } else {
    console.log(`FAILED ${run.error}`);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  disclaimer:
    "Twelve-document demo set. Results are directional and are not a partner SLA.",
  aggregate: aggregateBenchmarkRuns(runs, requestedModel),
  runs,
};
const outputPath = path.join("outputs", `eval-${requestedModel}.json`);
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nWrote ${outputPath}`);
console.log(JSON.stringify(report.aggregate, null, 2));
