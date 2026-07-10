import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceManifestPath = path.join(root, "data", "vrdu-mini", "manifest.jsonl");
const publicManifestPath = path.join(root, "data", "vrdu-public-manifest.json");
const publicEvaluationPath = path.join(root, "outputs", "evaluation-public.json");

function publicRun(run: any) {
  return {
    documentId: run.documentId,
    slice: run.slice,
    difficulty: run.difficulty,
    pages: run.pages,
    expectedLineItems: run.expectedLineItems,
    status: run.status,
    route: run.result?.validation?.route ?? "failed",
    reasons: run.result?.validation?.reasons ?? [],
    missingCritical: run.result?.validation?.missingCritical ?? [],
    fieldPassRate: run.comparison?.fieldPassRate ?? null,
    lineItemF1: run.comparison?.lineItemsScored === false ? null : run.comparison?.lineItemF1 ?? null,
    lineItemsScored: run.comparison?.lineItemsScored ?? true,
    lineItemScoreExclusionReason: run.comparison?.lineItemScoreExclusionReason ?? null,
    criticalFieldsAllCorrect: run.comparison?.criticalFieldsAllCorrect ?? false,
    latencyMs: run.result?.telemetry?.latencyMs ?? null,
    estimatedCostUsd: run.result?.telemetry?.estimatedCostUsd ?? null,
  };
}

async function publicReport(model: string) {
  const reportPath = path.join(root, "outputs", `eval-${model}.json`);
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  return {
    generatedAt: report.generatedAt,
    disclaimer: report.disclaimer,
    aggregate: report.aggregate,
    runs: report.runs.map(publicRun),
  };
}

const manifest = (await fs.readFile(sourceManifestPath, "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line))
  .map((entry) => ({
    document_id: entry.document_id,
    filename: entry.filename,
    slice: entry.slice,
    difficulty: entry.difficulty,
    demo_rank: entry.demo_rank,
    include_reason: entry.include_reason,
    page_count: entry.page_count,
    line_item_count: entry.line_item_count,
    score_excluded_fields: entry.score_excluded_fields,
    score_line_items: entry.score_line_items,
    line_item_score_exclusion_reason: entry.line_item_score_exclusion_reason,
    missing_header_fields: entry.missing_header_fields,
    amount_sum_status: entry.amount_sum_status,
  }));

await fs.writeFile(publicManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(
  publicEvaluationPath,
  `${JSON.stringify({
    primary: await publicReport("gemini-3.5-flash"),
    challenger: await publicReport("gemini-3.1-flash-lite"),
  }, null, 2)}\n`,
);

console.log("Wrote public benchmark metadata and evaluation snapshot.");
