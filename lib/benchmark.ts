import fs from "node:fs";
import path from "node:path";
import type { Extraction, ManifestEntry } from "@/shared/types";

const dataRoot = path.join(process.cwd(), "data", "vrdu-mini");
const pdfRoot = path.join(dataRoot, "pdfs");
const goldRoot = path.join(dataRoot, "gold");
const manifestPath = path.join(dataRoot, "manifest.jsonl");
const publicManifestPath = path.join(process.cwd(), "data", "vrdu-public-manifest.json");

let manifestCache: ManifestEntry[] | null = null;

function localSourcesEnabled() {
  return process.env.VERCEL !== "1" && fs.existsSync(manifestPath);
}

export function getManifest() {
  if (manifestCache) return manifestCache;
  manifestCache = (localSourcesEnabled()
    ? fs
        .readFileSync(manifestPath, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as ManifestEntry)
    : JSON.parse(fs.readFileSync(publicManifestPath, "utf8")) as ManifestEntry[]
  ).sort((a, b) => a.demo_rank - b.demo_rank);
  return manifestCache;
}

export function benchmarkSourcesAvailable() {
  return localSourcesEnabled() && getManifest().every((entry) =>
    fs.existsSync(path.join(pdfRoot, entry.filename)),
  );
}

export function getManifestEntry(id: string) {
  return getManifest().find((entry) => entry.document_id === id) ?? null;
}

export function readBenchmarkPdf(id: string) {
  if (!localSourcesEnabled()) return null;
  const entry = getManifestEntry(id);
  if (!entry) return null;
  const pdfPath = path.join(pdfRoot, entry.filename);
  if (!fs.existsSync(pdfPath)) return null;
  return { entry, buffer: fs.readFileSync(pdfPath) };
}

export function readGoldLabel(id: string) {
  if (!localSourcesEnabled()) return null;
  const entry = getManifestEntry(id);
  if (!entry) return null;
  const goldPath = path.join(goldRoot, `${entry.document_id}.json`);
  if (!fs.existsSync(goldPath)) return null;
  return JSON.parse(fs.readFileSync(goldPath, "utf8")) as Extraction;
}
