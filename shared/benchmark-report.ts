import type { ComparisonResult, ExtractionResponse } from "./types";

export type BenchmarkDocumentRun = {
  documentId: string;
  slice: string;
  difficulty: string;
  pages: number;
  expectedLineItems: number;
  status: "completed" | "failed";
  error?: string;
  result?: ExtractionResponse;
  comparison?: ComparisonResult;
};

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

export function aggregateBenchmarkRuns(runs: BenchmarkDocumentRun[], model: string) {
  const completed = runs.filter(
    (run): run is BenchmarkDocumentRun & { result: ExtractionResponse; comparison: ComparisonResult } =>
      run.status === "completed" && Boolean(run.result) && Boolean(run.comparison),
  );
  const accepted = completed.filter((run) => run.result.validation.route === "accept");
  const rowScored = completed.filter((run) => run.comparison.lineItemsScored);
  let headerScored = 0;
  let headerPassed = 0;
  let hallucinations = 0;
  let missingValues = 0;
  let matchedRows = 0;
  let predictedRows = 0;
  let goldRows = 0;
  let matchedLeafPasses = 0;
  let totalGoldRows = 0;

  completed.forEach((run) => {
    const fieldRows = run.comparison.fieldRows.filter((row) => !row.excluded);
    headerScored += fieldRows.length;
    headerPassed += fieldRows.filter((row) => row.passed).length;
    hallucinations += fieldRows.filter((row) => row.expected === null && row.actual !== null).length;
    missingValues += fieldRows.filter((row) => row.expected !== null && row.actual === null).length;
    totalGoldRows += run.comparison.goldLineItems;
    if (run.comparison.lineItemsScored) {
      matchedRows += run.comparison.lineItemMatches;
      predictedRows += run.comparison.predictedLineItems;
      goldRows += run.comparison.goldLineItems;
      matchedLeafPasses += run.comparison.matchedLeafPasses;
    }
  });

  const linePrecision = predictedRows ? matchedRows / predictedRows : goldRows ? 0 : 1;
  const lineRecall = goldRows ? matchedRows / goldRows : predictedRows ? 0 : 1;
  const lineF1 = linePrecision + lineRecall
    ? (2 * linePrecision * lineRecall) / (linePrecision + lineRecall)
    : 0;
  const matchedLeafTotal = rowScored.reduce(
    (total, run) => total + run.comparison.matchedLeafTotal,
    0,
  );
  const latencies = completed.map((run) => run.result.telemetry.latencyMs);
  const totalCost = completed.reduce(
    (total, run) => total + run.result.telemetry.estimatedCostUsd,
    0,
  );

  return {
    model,
    documentsAttempted: runs.length,
    documentsCompleted: completed.length,
    schemaValidity: completed.length
      ? completed.filter((run) => run.result.validation.schemaValid).length / completed.length
      : 0,
    acceptanceRate: runs.length ? accepted.length / runs.length : 0,
    acceptedCriticalFieldAccuracy: accepted.length
      ? accepted.filter((run) => run.comparison.criticalFieldsAllCorrect).length / accepted.length
      : 0,
    perFieldPassRate: headerScored ? headerPassed / headerScored : 0,
    hallucinationRate: headerScored ? hallucinations / headerScored : 0,
    missingValueRate: headerScored ? missingValues / headerScored : 0,
    lineItemPrecision: linePrecision,
    lineItemRecall: lineRecall,
    lineItemF1: lineF1,
    lineItemDocumentsScored: rowScored.length,
    lineItemGoldRowsScored: goldRows,
    lineItemGoldRowsTotal: totalGoldRows,
    matchedRowLeafAccuracy: matchedLeafTotal
      ? matchedLeafPasses / matchedLeafTotal
      : goldRows
        ? 0
        : 1,
    criticalFieldsAllCorrectRate: completed.length
      ? completed.filter((run) => run.comparison.criticalFieldsAllCorrect).length / completed.length
      : 0,
    latencyMs: {
      median: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
    tokens: {
      input: completed.reduce((total, run) => total + run.result.telemetry.inputTokens, 0),
      output: completed.reduce((total, run) => total + run.result.telemetry.outputTokens, 0),
      thought: completed.reduce((total, run) => total + run.result.telemetry.thoughtTokens, 0),
    },
    estimatedCostUsd: totalCost,
    estimatedCostPerAcceptedDocumentUsd: accepted.length ? totalCost / accepted.length : null,
    failedDocuments: runs.filter((run) => run.status === "failed").map((run) => run.documentId),
    reviewSlices: runs
      .filter((run) => run.result?.validation.route === "review")
      .map((run) => ({ documentId: run.documentId, slice: run.slice, reasons: run.result?.validation.reasons })),
    acceptedSemanticFailures: accepted
      .filter((run) => !run.comparison.criticalFieldsAllCorrect)
      .map((run) => ({ documentId: run.documentId, slice: run.slice })),
  };
}
