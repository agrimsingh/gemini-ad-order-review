export type PdfInputMode = "rasterized_pdf_pages" | "inline_pdf_document";

export function configuredPdfInputMode(): PdfInputMode {
  return process.env.VERCEL === "1" || process.env.GEMINI_PDF_INPUT_MODE === "inline"
    ? "inline_pdf_document"
    : "rasterized_pdf_pages";
}
