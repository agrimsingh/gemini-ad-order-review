import type {
  ComparisonResult,
  Extraction,
  HeaderField,
  LineField,
  LineItem,
  NullableText,
  ValidationResult,
} from "./types";

export const HEADER_FIELDS: HeaderField[] = [
  "property",
  "tv_address",
  "advertiser",
  "agency",
  "product",
  "contract_num",
  "flight_from",
  "flight_to",
  "gross_amount",
];

export const LINE_FIELDS: LineField[] = [
  "channel",
  "program_desc",
  "program_start_date",
  "program_end_date",
  "sub_amount",
];

const GATE_REQUIRED_FIELDS: HeaderField[] = [
  "advertiser",
  "contract_num",
  "flight_from",
  "flight_to",
  "gross_amount",
];

const CRITICAL_SCORE_FIELDS: HeaderField[] = ["advertiser", "contract_num", "gross_amount"];

export function normalizeText(value: NullableText) {
  if (value === null || value === undefined) return null;
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function parseMoneyToCents(value: NullableText) {
  if (!value) return null;
  const negative = /\(.*\)/.test(value) || /^\s*-/.test(value);
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned || (cleaned.match(/\./g) ?? []).length > 1) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) * (negative ? -1 : 1);
}

export function parseDate(value: NullableText) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
}

function valuesMatch(field: HeaderField | LineField, expected: NullableText, actual: NullableText) {
  if (expected === null || actual === null) return expected === actual;
  if (field === "gross_amount" || field === "sub_amount") {
    const toPrice = (value: string) => Number(value.replace(/[^0-9.]/g, ""));
    const expectedPrice = toPrice(expected);
    const actualPrice = toPrice(actual);
    return Number.isFinite(expectedPrice) && Number.isFinite(actualPrice)
      ? Math.abs(expectedPrice - actualPrice) <= 0.01
      : false;
  }
  if (
    field === "flight_from" ||
    field === "flight_to" ||
    field === "program_start_date" ||
    field === "program_end_date"
  ) {
    const expectedDate = decodeVrduDate(expected);
    const actualDate = decodeVrduDate(actual);
    if (expectedDate && actualDate) {
      return (
        (expectedDate.year === actualDate.year &&
          expectedDate.month === actualDate.month &&
          expectedDate.day === actualDate.day) ||
        (expectedDate.year === actualDate.year &&
          expectedDate.month === actualDate.day &&
          expectedDate.day === actualDate.month)
      );
    }
    return alphaNumeric(expected) === alphaNumeric(actual);
  }
  if (field === "contract_num") return digitsOnly(expected) === digitsOnly(actual);
  if (field === "tv_address") return levenshtein(collapseWhitespace(expected), collapseWhitespace(actual)) <= 3;
  return alphaNumeric(expected) === alphaNumeric(actual);
}

function collapseWhitespace(value: string) {
  return value.trim().split(/\s+/).join(" ");
}

function alphaNumeric(value: string) {
  return collapseWhitespace(value).replace(/[^0-9a-zA-Z]/g, "");
}

function digitsOnly(value: string) {
  return collapseWhitespace(value).replace(/[^0-9]/g, "");
}

function levenshtein(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function decodeVrduDate(value: string) {
  const cleaned = value.replace(/[^0-9a-zA-Z/\-,]/g, "");
  const numeric = cleaned.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (numeric) {
    if (numeric[1].length === 4) {
      return { year: Number(numeric[1]), month: Number(numeric[2]), day: Number(numeric[3]) };
    }
    return {
      year: Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]),
      month: Number(numeric[1]),
      day: Number(numeric[2]),
    };
  }
  const withoutYear = cleaned.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (withoutYear) return { year: 1900, month: Number(withoutYear[1]), day: Number(withoutYear[2]) };
  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const named = cleaned.match(/^([A-Za-z]+)(\d{1,2})[\/,](\d{2}|\d{4})$/);
  if (named) {
    const token = named[1].toLowerCase();
    const monthIndex = monthNames.findIndex((name) => name === token || name.slice(0, 3) === token.slice(0, 3));
    if (monthIndex >= 0) {
      return {
        year: Number(named[3].length === 2 ? `20${named[3]}` : named[3]),
        month: monthIndex + 1,
        day: Number(named[2]),
      };
    }
  }
  return null;
}

export function isExtractionShape(value: unknown): value is Extraction {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Extraction>;
  if (!candidate.document || typeof candidate.document !== "object") return false;
  if (!Array.isArray(candidate.line_items)) return false;
  const headersValid = HEADER_FIELDS.every((field) =>
    Object.prototype.hasOwnProperty.call(candidate.document, field),
  );
  const rowsValid = candidate.line_items.every((row) =>
    LINE_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(row, field)),
  );
  return headersValid && rowsValid;
}

export function validateExtraction(value: Extraction): ValidationResult {
  const schemaValid = isExtractionShape(value);
  const missingCritical = GATE_REQUIRED_FIELDS.filter((field) => !value.document[field]);
  const start = parseDate(value.document.flight_from);
  const end = parseDate(value.document.flight_to);
  const dateOrderOk = start === null || end === null || start <= end;
  const grossAmount = parseMoneyToCents(value.document.gross_amount);
  const grossAmountParseable = value.document.gross_amount === null || grossAmount !== null;
  const rowShapeValid = value.line_items.every(
    (row) => row.program_desc !== null || row.sub_amount !== null,
  );
  const lineAmounts = value.line_items.map((row) => parseMoneyToCents(row.sub_amount));
  const allLineAmountsPresent =
    value.line_items.length > 0 && lineAmounts.every((amount) => amount !== null);
  const lineSum = lineAmounts.reduce<number>(
    (total, amount) => total + (amount === null ? 0 : amount),
    0,
  );
  const reconciliation =
    grossAmount !== null && allLineAmountsPresent
      ? Math.abs(grossAmount - lineSum) <= 1
        ? "match"
        : "mismatch"
      : "not_applicable";

  const reasons: string[] = [];
  if (!schemaValid) reasons.push("schema_invalid");
  if (missingCritical.length) reasons.push("critical_field_missing");
  if (!dateOrderOk) reasons.push("date_order_invalid");
  if (!grossAmountParseable) reasons.push("gross_amount_unparseable");

  return {
    schemaValid,
    missingCritical,
    dateOrderOk,
    grossAmountParseable,
    rowShapeValid,
    reconciliation,
    route: reasons.length === 0 ? "accept" : "review",
    reasons,
  };
}

export function compareToGold(
  predicted: Extraction,
  gold: Extraction,
  excludedFields: HeaderField[] = [],
  lineItemsScored = true,
  lineItemScoreExclusionReason: string | null = null,
): ComparisonResult {
  const exclusions = new Set(excludedFields);
  let passed = 0;
  let hallucinations = 0;
  let missingValues = 0;
  let scoredHeaderFields = 0;

  const fieldRows = HEADER_FIELDS.map((field) => {
    const expected = gold.document[field];
    const actual = predicted.document[field];
    const excluded = exclusions.has(field);
    const fieldPassed = valuesMatch(field, expected, actual);
    if (!excluded) {
      scoredHeaderFields += 1;
      if (fieldPassed) passed += 1;
      if (expected === null && actual !== null) hallucinations += 1;
      if (expected !== null && actual === null) missingValues += 1;
    }
    return { field, expected, actual, passed: fieldPassed, excluded };
  });

  const unusedPredicted = new Set(predicted.line_items.map((_, index) => index));
  let lineItemMatches = 0;
  gold.line_items.forEach((expected) => {
    const matchedIndex = [...unusedPredicted].find((index) =>
      LINE_FIELDS.every((field) => valuesMatch(field, expected[field], predicted.line_items[index][field])),
    );
    if (matchedIndex !== undefined) {
      lineItemMatches += 1;
      unusedPredicted.delete(matchedIndex);
    }
  });

  const unusedForAlignment = new Set(predicted.line_items.map((_, index) => index));
  const alignedRows: Array<{ predicted: LineItem; expected: LineItem }> = [];
  gold.line_items.forEach((expected) => {
    let bestIndex: number | null = null;
    let bestIdentityMatches = 0;
    let bestLeafMatches = 0;
    unusedForAlignment.forEach((index) => {
      const row = predicted.line_items[index];
      const identityMatches = (["channel", "program_desc", "program_start_date", "program_end_date"] as LineField[])
        .filter((field) => valuesMatch(field, expected[field], row[field])).length;
      const leafMatches = LINE_FIELDS.filter((field) => valuesMatch(field, expected[field], row[field])).length;
      if (identityMatches > bestIdentityMatches || (identityMatches === bestIdentityMatches && leafMatches > bestLeafMatches)) {
        bestIndex = index;
        bestIdentityMatches = identityMatches;
        bestLeafMatches = leafMatches;
      }
    });
    if (bestIndex !== null && bestIdentityMatches >= 2) {
      alignedRows.push({ predicted: predicted.line_items[bestIndex], expected });
      unusedForAlignment.delete(bestIndex);
    }
  });

  const precision = predicted.line_items.length
    ? lineItemMatches / predicted.line_items.length
    : gold.line_items.length
      ? 0
      : 1;
  const recall = gold.line_items.length
    ? lineItemMatches / gold.line_items.length
    : predicted.line_items.length
      ? 0
      : 1;
  const lineItemF1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  let matchedLeafPasses = 0;
  alignedRows.forEach(({ predicted: row, expected }) => {
    LINE_FIELDS.forEach((field) => {
      if (valuesMatch(field, expected[field], row[field])) matchedLeafPasses += 1;
    });
  });
  const matchedLeafTotal = alignedRows.length * LINE_FIELDS.length;

  return {
    lineItemsScored,
    lineItemScoreExclusionReason: lineItemsScored ? null : lineItemScoreExclusionReason,
    scoredHeaderFields,
    fieldPassRate: scoredHeaderFields ? passed / scoredHeaderFields : 1,
    hallucinationRate: scoredHeaderFields ? hallucinations / scoredHeaderFields : 0,
    missingValueRate: scoredHeaderFields ? missingValues / scoredHeaderFields : 0,
    lineItemPrecision: precision,
    lineItemRecall: recall,
    lineItemF1,
    matchedRowLeafAccuracy: matchedLeafTotal
      ? matchedLeafPasses / matchedLeafTotal
      : gold.line_items.length
        ? 0
        : 1,
    criticalFieldsAllCorrect: CRITICAL_SCORE_FIELDS.filter((field) => !exclusions.has(field)).every(
      (field) => valuesMatch(field, gold.document[field], predicted.document[field]),
    ),
    lineItemMatches,
    predictedLineItems: predicted.line_items.length,
    goldLineItems: gold.line_items.length,
    matchedLeafPasses,
    matchedLeafTotal,
    fieldRows,
  };
}
