# Building the VRDU mini holdout

The benchmark uses a fixed 12-document subset of the VRDU Ad-buy Forms unseen-template test split: 32 PDF pages and 171 annotated line items. A source audit excludes 64 unreliable row annotations from exact-row aggregates, leaving 107 scored rows.

The source PDFs and derived labels are intentionally absent from the public repository. The archived VRDU repository does not declare redistribution terms, so this project rebuilds the local pack from a checkout instead of republishing it.

## Build the local pack

Clone [Google Research VRDU](https://github.com/google-research-datasets/vrdu), then run this command from the project root:

```bash
python3 scripts/prepare_vrdu_subset.py /path/to/vrdu
npm run data:validate
```

The fixed document selection is in `config/vrdu-selection.json`. Source-verified corrections and scoring exclusions are in `config/vrdu-adjudications.json`.

The generated directory contains:

- `pdfs/`: source documents sent to Gemini;
- `gold/` and `gold.jsonl`: schema-shaped expected extractions;
- `manifest.jsonl`: slice, difficulty, page count, and scoring exclusions;
- `meta.json`: field-to-comparator mapping;
- `source-split.json`: evidence that each document comes from the unseen-template split.

## Label-quality decisions

Five header fields across three documents have conflicting annotations. They remain visible in each manifest entry but are excluded from headline field accuracy.

The ten-page WKOW document has 64 row labels with truncated dates and comments spliced into program descriptions. Those rows remain useful for latency, token, and completeness tests, but they are not used for exact-row accuracy.

Amount reconciliation is informational. Across the full VRDU Ad-buy Forms corpus, only 219 of 271 documents with parseable gross and line-item amounts have an exact sum-to-gross match. The current partner route therefore does not treat a mismatch as an extraction failure.
