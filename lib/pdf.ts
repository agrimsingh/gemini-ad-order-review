import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_DEMO_PAGES = 20;

async function pageCount(pdfPath: string) {
  const { stdout } = await execFileAsync("pdfinfo", [pdfPath]);
  const pageMatch = stdout.match(/^Pages:\s+(\d+)$/m);
  const count = pageMatch ? Number(pageMatch[1]) : 0;
  if (!count) throw new Error("Could not determine the PDF page count.");
  return count;
}

export async function renderPdfPages(pdfBuffer: Buffer) {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "gemini-vrdu-"));
  const pdfPath = path.join(tempDirectory, "source.pdf");
  const outputPrefix = path.join(tempDirectory, "page");

  try {
    await writeFile(pdfPath, pdfBuffer);
    const count = await pageCount(pdfPath);
    if (count > MAX_DEMO_PAGES) {
      throw new Error(`This demo renders at most ${MAX_DEMO_PAGES} pages per document.`);
    }
    await execFileAsync("pdftoppm", [
      "-jpeg",
      "-r",
      "180",
      "-jpegopt",
      "quality=88",
      pdfPath,
      outputPrefix,
    ]);
    const pageFiles = (await readdir(tempDirectory))
      .filter((file) => /^page-\d+\.jpg$/.test(file))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    if (pageFiles.length !== count) throw new Error(`Rendered ${pageFiles.length} of ${count} PDF pages.`);
    return Promise.all(pageFiles.map((file) => readFile(path.join(tempDirectory, file))));
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function renderPdfPreview(pdfBuffer: Buffer, requestedPage: number) {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "gemini-preview-"));
  const pdfPath = path.join(tempDirectory, "source.pdf");
  const outputPrefix = path.join(tempDirectory, "preview");

  try {
    await writeFile(pdfPath, pdfBuffer);
    const count = await pageCount(pdfPath);
    const page = Math.min(Math.max(requestedPage, 1), count);
    await execFileAsync("pdftoppm", [
      "-f",
      String(page),
      "-l",
      String(page),
      "-singlefile",
      "-jpeg",
      "-r",
      "150",
      "-jpegopt",
      "quality=86",
      pdfPath,
      outputPrefix,
    ]);
    return { buffer: await readFile(`${outputPrefix}.jpg`), page, pageCount: count };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
