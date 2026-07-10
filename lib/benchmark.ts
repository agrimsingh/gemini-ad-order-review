import fs from "node:fs";
import path from "node:path";
import type { Extraction, ManifestEntry } from "@/shared/types";

const dataRoot = path.join(process.cwd(), "data", "vrdu-mini");
const pdfRoot = path.join(dataRoot, "pdfs");
const goldRoot = path.join(dataRoot, "gold");
const manifestPath = path.join(dataRoot, "manifest.jsonl");

let manifestCache: ManifestEntry[] | null = null;

export function getManifest() {
  if (manifestCache) return manifestCache;
  manifestCache = fs
    .readFileSync(manifestPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as ManifestEntry)
    .sort((a, b) => a.demo_rank - b.demo_rank);
  return manifestCache;
}

export function getManifestEntry(id: string) {
  return getManifest().find((entry) => entry.document_id === id) ?? null;
}

export function readBenchmarkPdf(id: string) {
  const entry = getManifestEntry(id);
  if (!entry) return null;
  return { entry, buffer: fs.readFileSync(path.join(pdfRoot, entry.filename)) };
}

export function readGoldLabel(id: string) {
  const entry = getManifestEntry(id);
  if (!entry) return null;
  const goldPath = path.join(goldRoot, `${entry.document_id}.json`);
  if (!fs.existsSync(goldPath)) return null;
  return JSON.parse(fs.readFileSync(goldPath, "utf8")) as Extraction;
}
