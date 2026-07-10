import fs from "node:fs/promises";
import path from "node:path";
import { getManifest, readBenchmarkPdf, readGoldLabel } from "../lib/benchmark";
import { extractPdf, isSupportedModel } from "../lib/gemini";
import type { PdfInputMode } from "../lib/runtime-config";
import { aggregateBenchmarkRuns, type BenchmarkDocumentRun } from "../shared/benchmark-report";
import { compareToGold } from "../shared/evaluation";
import type { ManifestEntry } from "../shared/types";

const requestedModelValue = process.argv[2] ?? "gemini-3.5-flash";
if (!isSupportedModel(requestedModelValue)) {
  throw new Error(`Unsupported model: ${requestedModelValue}`);
}
const requestedModel = requestedModelValue;
const mediaInstruction = "The supplied media contains one document. Extract it now.";
const modes: PdfInputMode[] = ["rasterized_pdf_pages", "inline_pdf_document"];

async function runDocument(
  entry: ManifestEntry,
  inputMode: PdfInputMode,
): Promise<BenchmarkDocumentRun> {
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
    const result = await extractPdf(pdf.buffer, requestedModel, {
      inputMode,
      mediaInstruction,
    });
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

const runsByMode = {} as Record<PdfInputMode, BenchmarkDocumentRun[]>;
for (const mode of modes) {
  const runs: BenchmarkDocumentRun[] = [];
  console.log(`\n${mode}`);
  for (const [index, entry] of getManifest().entries()) {
    process.stdout.write(
      `[${index + 1}/${getManifest().length}] ${entry.document_id} (${entry.page_count}p, ${entry.line_item_count} rows)... `,
    );
    const run = await runDocument(entry, mode);
    runs.push(run);
    if (run.status === "completed") {
      console.log(
        `${run.result?.validation.route.toUpperCase()} ${run.result?.telemetry.latencyMs}ms $${run.result?.telemetry.estimatedCostUsd.toFixed(4)}`,
      );
    } else {
      console.log(`FAILED ${run.error}`);
    }
  }
  runsByMode[mode] = runs;
}

function uniqueTelemetryValues(
  runs: BenchmarkDocumentRun[],
  field: "promptHash" | "schemaHash",
) {
  return [...new Set(runs.flatMap((run) => run.result ? [run.result.telemetry[field]] : []))];
}

const aggregates = Object.fromEntries(
  modes.map((mode) => [mode, aggregateBenchmarkRuns(runsByMode[mode], requestedModel)]),
) as Record<PdfInputMode, ReturnType<typeof aggregateBenchmarkRuns>>;
const report = {
  generatedAt: new Date().toISOString(),
  model: requestedModel,
  controlledVariables: {
    mediaInstruction,
    promptHashes: Object.fromEntries(
      modes.map((mode) => [mode, uniqueTelemetryValues(runsByMode[mode], "promptHash")]),
    ),
    schemaHashes: Object.fromEntries(
      modes.map((mode) => [mode, uniqueTelemetryValues(runsByMode[mode], "schemaHash")]),
    ),
    thinking: "minimal",
    store: false,
    normalizationVersion: "address-contact-v1",
  },
  aggregates,
  runs: runsByMode,
};
const outputPath = path.join("outputs", `input-mode-comparison-${requestedModel}.json`);
const publicOutputPath = path.join("outputs", "input-mode-comparison-public.json");
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
await fs.writeFile(publicOutputPath, `${JSON.stringify({
  generatedAt: report.generatedAt,
  model: report.model,
  controlledVariables: report.controlledVariables,
  aggregates: report.aggregates,
}, null, 2)}\n`);
console.log(`\nWrote ${outputPath}`);
console.log(`Wrote ${publicOutputPath}`);
console.log(JSON.stringify({ controlledVariables: report.controlledVariables, aggregates }, null, 2));
