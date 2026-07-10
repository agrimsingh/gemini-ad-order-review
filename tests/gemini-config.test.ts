import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configuredPdfInputMode } from "../lib/runtime-config";

const originalVercel = process.env.VERCEL;
const originalInputMode = process.env.GEMINI_PDF_INPUT_MODE;

beforeEach(() => {
  delete process.env.VERCEL;
  delete process.env.GEMINI_PDF_INPUT_MODE;
});

afterEach(() => {
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
  if (originalInputMode === undefined) delete process.env.GEMINI_PDF_INPUT_MODE;
  else process.env.GEMINI_PDF_INPUT_MODE = originalInputMode;
});

describe("configuredPdfInputMode", () => {
  it("uses high-resolution rasterized pages locally", () => {
    expect(configuredPdfInputMode()).toBe("rasterized_pdf_pages");
  });

  it("uses inline PDF documents on Vercel", () => {
    process.env.VERCEL = "1";
    expect(configuredPdfInputMode()).toBe("inline_pdf_document");
  });

  it("allows an explicit inline override", () => {
    process.env.GEMINI_PDF_INPUT_MODE = "inline";
    expect(configuredPdfInputMode()).toBe("inline_pdf_document");
  });
});
