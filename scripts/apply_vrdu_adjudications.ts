import fs from "node:fs/promises";
import path from "node:path";

type Adjudication = {
  source_evidence: string;
  document_overrides?: Record<string, string | null>;
  score_line_items?: boolean;
  line_item_score_exclusion_reason?: string | null;
};

const root = process.cwd();
const dataDir = path.join(root, "data", "vrdu-mini");
const adjudications = JSON.parse(
  await fs.readFile(path.join(root, "config", "vrdu-adjudications.json"), "utf8"),
) as Record<string, Adjudication>;

const manifestPath = path.join(dataDir, "manifest.jsonl");
const manifest = (await fs.readFile(manifestPath, "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

const updatedGold = new Map<string, unknown>();
for (const row of manifest) {
  const adjudication = adjudications[row.document_id];
  if (!adjudication) continue;

  const goldPath = path.join(dataDir, "gold", `${row.document_id}.json`);
  const gold = JSON.parse(await fs.readFile(goldPath, "utf8"));
  Object.assign(gold.document, adjudication.document_overrides ?? {});
  await fs.writeFile(goldPath, `${JSON.stringify(gold, null, 2)}\n`);
  updatedGold.set(row.document_id, gold);

  row.score_line_items = adjudication.score_line_items ?? true;
  row.line_item_score_exclusion_reason =
    adjudication.line_item_score_exclusion_reason ?? null;
  row.gold_adjudication_note = adjudication.source_evidence;
}

await fs.writeFile(
  manifestPath,
  `${manifest.map((row) => JSON.stringify(row)).join("\n")}\n`,
);

const combinedPath = path.join(dataDir, "gold.jsonl");
const combined = (await fs.readFile(combinedPath, "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
for (const row of combined) {
  if (updatedGold.has(row.document_id)) row.expected = updatedGold.get(row.document_id);
}
await fs.writeFile(
  combinedPath,
  `${combined.map((row) => JSON.stringify(row)).join("\n")}\n`,
);

console.log(`Applied ${updatedGold.size} VRDU adjudication(s).`);
