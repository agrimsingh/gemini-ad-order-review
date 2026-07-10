import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { aggregateBenchmarkRuns, type BenchmarkDocumentRun } from "../shared/benchmark-report";
import { compareToGold, validateExtraction } from "../shared/evaluation";
import { NORMALIZATION_VERSION, normalizeExtraction } from "../shared/normalization";
import { getManifest, readGoldLabel } from "../lib/benchmark";

const requestedModels = process.argv.slice(2);
if (!requestedModels.length) {
  throw new Error("Pass at least one model report name to rescore.");
}

const manifest = new Map(getManifest().map((entry) => [entry.document_id, entry]));

function shortHash(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
}

for (const model of requestedModels) {
  const outputPath = path.join("outputs", `eval-${model}.json`);
  const report = JSON.parse(await fs.readFile(outputPath, "utf8"));
  const runs = report.runs as BenchmarkDocumentRun[];

  for (const run of runs) {
    if (run.status !== "completed" || !run.result) continue;
    const entry = manifest.get(run.documentId);
    const gold = readGoldLabel(run.documentId);
    if (!entry || !gold) throw new Error(`Missing benchmark data for ${run.documentId}.`);

    run.result.extraction = normalizeExtraction(run.result.extraction);
    run.result.configuration.normalizationVersion = NORMALIZATION_VERSION;
    run.result.telemetry.settingsHash = shortHash(run.result.configuration);
    run.result.validation = validateExtraction(run.result.extraction);
    run.comparison = compareToGold(
      run.result.extraction,
      gold,
      entry.score_excluded_fields,
      entry.score_line_items !== false,
      entry.line_item_score_exclusion_reason ?? null,
    );
  }

  report.aggregate = aggregateBenchmarkRuns(runs, model);
  report.disclaimer =
    "Twelve-document demo set. Results are directional and are not a partner SLA.";
  report.rescoredAt = new Date().toISOString();
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Rescored ${outputPath}`);
}
