import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { renderPdfPages } from "@/lib/pdf";
import { configuredPdfInputMode, type PdfInputMode } from "@/lib/runtime-config";
import { isExtractionShape, validateExtraction } from "@/shared/evaluation";
import { NORMALIZATION_VERSION, normalizeExtraction } from "@/shared/normalization";
import { EXTRACTION_PROMPT, EXTRACTION_SCHEMA } from "@/shared/schema";
import type { Extraction, ExtractionResponse, Telemetry } from "@/shared/types";

export const SUPPORTED_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

type ExtractionOptions = {
  inputMode?: PdfInputMode;
  mediaInstruction?: string;
};

const INPUT_RATES: Record<SupportedModel, number> = {
  "gemini-3.5-flash": 1.5 / 1_000_000,
  "gemini-3.1-flash-lite": 0.25 / 1_000_000,
  "gemini-3.1-pro-preview": 2 / 1_000_000,
};

const OUTPUT_RATES: Record<SupportedModel, number> = {
  "gemini-3.5-flash": 9 / 1_000_000,
  "gemini-3.1-flash-lite": 1.5 / 1_000_000,
  "gemini-3.1-pro-preview": 12 / 1_000_000,
};

function shortHash(value: unknown) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return crypto.createHash("sha256").update(serialized).digest("hex").slice(0, 12);
}

function usageFrom(interaction: any) {
  const usage = interaction?.usage ?? interaction?.usage_metadata ?? interaction?.usageMetadata ?? {};
  const inputTokens =
    usage.total_input_tokens ??
    usage.input_tokens ??
    usage.prompt_tokens ??
    usage.prompt_token_count ??
    usage.promptTokenCount ??
    0;
  const outputTokens =
    usage.total_output_tokens ??
    usage.output_tokens ??
    usage.completion_tokens ??
    usage.candidates_token_count ??
    usage.candidatesTokenCount ??
    0;
  const thoughtTokens =
    usage.total_thought_tokens ??
    usage.thought_tokens ??
    usage.thoughts_tokens ??
    usage.thoughts_token_count ??
    usage.thoughtsTokenCount ??
    0;
  return { inputTokens, outputTokens, thoughtTokens };
}

export function isSupportedModel(value: string): value is SupportedModel {
  return SUPPORTED_MODELS.includes(value as SupportedModel);
}

export async function extractPdf(
  pdfBuffer: Buffer,
  model: SupportedModel,
  options: ExtractionOptions = {},
): Promise<ExtractionResponse> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const thinking: "minimal" | "low" =
    model === "gemini-3.1-pro-preview" ? "low" : "minimal";
  const started = performance.now();
  const inputMode = options.inputMode ?? configuredPdfInputMode();
  const mediaInput = inputMode === "inline_pdf_document"
    ? [{
        type: "document" as const,
        data: pdfBuffer.toString("base64"),
        mime_type: "application/pdf" as const,
      }]
    : (await renderPdfPages(pdfBuffer)).map((page) => ({
        type: "image" as const,
        data: page.toString("base64"),
        mime_type: "image/jpeg" as const,
        resolution: "high" as const,
      }));
  const mediaInstruction = options.mediaInstruction ?? (
    inputMode === "inline_pdf_document"
      ? "The input is one PDF document. Extract it now."
      : "The images are consecutive pages from one PDF. Extract this document now."
  );
  const requestPrompt = `${EXTRACTION_PROMPT}\n\n${mediaInstruction}`;
  const ai = new GoogleGenAI({ apiKey });
  const interaction = await ai.interactions.create({
    model,
    store: false,
    input: [
      ...mediaInput,
      {
        type: "text",
        text: requestPrompt,
      },
    ],
    generation_config: {
      thinking_level: thinking,
    },
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: EXTRACTION_SCHEMA,
    },
  } as any);

  const rawText = String(interaction.output_text ?? "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  if (!rawText) throw new Error("Gemini returned no structured output.");
  const rawExtraction = JSON.parse(rawText) as Extraction;
  if (!isExtractionShape(rawExtraction)) {
    throw new Error("Gemini returned JSON that did not satisfy the required shape.");
  }
  const extraction = normalizeExtraction(rawExtraction);

  const tokenUsage = usageFrom(interaction);
  const settings = {
    model,
    api: "interactions" as const,
    resolution: inputMode === "inline_pdf_document" ? "api_default" as const : "high" as const,
    thinking,
    store: false as const,
    inputMode,
    normalizationVersion: NORMALIZATION_VERSION,
  };
  const telemetry: Telemetry = {
    latencyMs: Math.round(performance.now() - started),
    ...tokenUsage,
    estimatedCostUsd:
      tokenUsage.inputTokens * INPUT_RATES[model] +
      (tokenUsage.outputTokens + tokenUsage.thoughtTokens) * OUTPUT_RATES[model],
    model,
    promptHash: shortHash(requestPrompt),
    schemaHash: shortHash(EXTRACTION_SCHEMA),
    settingsHash: shortHash(settings),
  };

  return {
    extraction,
    validation: validateExtraction(extraction),
    telemetry,
    configuration: settings,
  };
}
