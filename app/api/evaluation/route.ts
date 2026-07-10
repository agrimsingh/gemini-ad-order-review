import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const publicSnapshotPath = path.join(process.cwd(), "outputs", "evaluation-public.json");

function readReport(model: string) {
  const reportPath = path.join(process.cwd(), "outputs", `eval-${model}.json`);
  if (!fs.existsSync(reportPath)) return null;
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  return {
    generatedAt: report.generatedAt,
    disclaimer: report.disclaimer,
    aggregate: report.aggregate,
    runs: report.runs.map((run: any) => ({
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
    })),
  };
}

export function GET() {
  const primary = readReport("gemini-3.5-flash");
  const challenger = readReport("gemini-3.1-flash-lite");
  if ((!primary || !challenger) && fs.existsSync(publicSnapshotPath)) {
    return NextResponse.json(JSON.parse(fs.readFileSync(publicSnapshotPath, "utf8")));
  }
  return NextResponse.json({
    primary,
    challenger,
  });
}
