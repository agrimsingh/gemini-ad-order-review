export type NullableText = string | null;

export type LineItem = {
  channel: NullableText;
  program_desc: NullableText;
  program_start_date: NullableText;
  program_end_date: NullableText;
  sub_amount: NullableText;
};

export type Extraction = {
  document: {
    property: NullableText;
    tv_address: NullableText;
    advertiser: NullableText;
    agency: NullableText;
    product: NullableText;
    contract_num: NullableText;
    flight_from: NullableText;
    flight_to: NullableText;
    gross_amount: NullableText;
  };
  line_items: LineItem[];
};

export type HeaderField = keyof Extraction["document"];
export type LineField = keyof LineItem;

export type ManifestEntry = {
  document_id: string;
  filename: string;
  slice: string;
  difficulty: "easy" | "medium" | "hard" | "stress";
  demo_rank: number;
  include_reason: string;
  page_count: number;
  line_item_count: number;
  score_excluded_fields: HeaderField[];
  score_line_items?: boolean;
  line_item_score_exclusion_reason?: string | null;
  missing_header_fields: HeaderField[];
  amount_sum_status: string;
};

export type ValidationResult = {
  schemaValid: boolean;
  missingCritical: HeaderField[];
  dateOrderOk: boolean;
  grossAmountParseable: boolean;
  rowShapeValid: boolean;
  reconciliation: "match" | "mismatch" | "not_applicable";
  route: "accept" | "review";
  reasons: string[];
};

export type ComparisonResult = {
  lineItemsScored: boolean;
  lineItemScoreExclusionReason: string | null;
  scoredHeaderFields: number;
  fieldPassRate: number;
  hallucinationRate: number;
  missingValueRate: number;
  lineItemPrecision: number;
  lineItemRecall: number;
  lineItemF1: number;
  matchedRowLeafAccuracy: number;
  criticalFieldsAllCorrect: boolean;
  lineItemMatches: number;
  predictedLineItems: number;
  goldLineItems: number;
  matchedLeafPasses: number;
  matchedLeafTotal: number;
  fieldRows: Array<{
    field: HeaderField;
    expected: NullableText;
    actual: NullableText;
    passed: boolean;
    excluded: boolean;
  }>;
  spotComparisons: Array<{
    kind: "gold" | "extra";
    goldIndex: number | null;
    predictedIndex: number | null;
    label: string;
    fullyMatched: boolean;
    paired: boolean;
    fieldPasses: number;
    fieldTotal: number;
    fields: Array<{
      field: LineField;
      expected: NullableText;
      actual: NullableText | null;
      passed: boolean;
    }>;
  }>;
};

export type Telemetry = {
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  estimatedCostUsd: number;
  model: string;
  promptHash: string;
  schemaHash: string;
  settingsHash: string;
};

export type ExtractionResponse = {
  extraction: Extraction;
  validation: ValidationResult;
  telemetry: Telemetry;
  configuration: {
    model: string;
    api: "interactions";
    resolution: "high" | "api_default";
    thinking: "minimal" | "low";
    store: false;
    inputMode: "rasterized_pdf_pages" | "inline_pdf_document";
    normalizationVersion: "address-contact-v1" | "org-name-address-v1" | "org-name-address-v2";
  };
};
