# Gemini Ad Order Review

This is a working document-extraction and review-gating prototype for media-buy orders, contracts, invoices, credit memos, and request sheets. It sends high-resolution page images to Gemini, validates the structured response in deterministic code, and decides whether the document has enough information to bypass header review.

The app also includes an evaluation harness built around the VRDU Ad-buy Forms dataset. Every model run can be compared with gold labels and reported with quality, latency, token, and cost metrics.

[Read the four-slide partner engineering briefing](docs/partner-engineering-briefing.pdf).

## Why the review gate exists

JSON Schema keeps a response parseable. It does not catch a plausible value in the wrong business field. An invoice can contain an Invoice #, an Order #, and a Net Total at the same time; choosing the wrong one still produces valid JSON.

The prototype separates four jobs:

1. Gemini reads the document and returns source-faithful strings or explicit `null` values.
2. Deterministic code normalizes known formatting artifacts and checks dates, money, required fields, and row completeness.
3. A partner policy decides whether headers can bypass review. Line items remain in review in this version.
4. The evaluator compares the same output with VRDU gold labels. Evaluation never changes the partner route.

```mermaid
flowchart LR
  A[PDF] --> B[Render pages at 180 DPI]
  B --> C[Gemini Interactions API]
  C --> D[JSON Schema extraction]
  D --> E[Normalize and validate]
  E --> F{Partner policy}
  F -->|Required headers present| G[Auto-accept headers]
  F -->|Missing or invalid| H[Send to review]
  D -. benchmark documents .-> I[VRDU comparison]
  I --> J[Quality, latency, tokens, cost]
```

## Partner field contract

The target record is an ad-buy order, not a general invoice ledger.

- `contract_num`: use Contract #, otherwise Order #. Invoice # does not substitute.
- `gross_amount`: use an explicit Gross Amount, Contract Amount, Grand Total, or credit amount. Net Total and Invoice Total do not substitute.
- `property`: use the legal station or entity name next to the station address.
- `tv_address`: return only the postal address.

The address field passes through a versioned normalizer that removes labeled contact suffixes such as `Main:`, `Billing:`, `Phone:`, and `Fax:`. Dates, money parsing, routing, and scoring stay outside the model. The app does not use model-reported confidence.

## Run it locally

Requirements:

- Node.js 20 or newer
- Poppler (`brew install poppler` on macOS, `apt-get install poppler-utils` on Debian or Ubuntu)
- a Gemini API key created in Google AI Studio
- a local checkout of VRDU for the bundled benchmark scenarios

```bash
npm install
cp .env.example .env.local
```

Set `GEMINI_API_KEY` in `.env.local`, then build the local benchmark pack:

```bash
python3 scripts/prepare_vrdu_subset.py /path/to/vrdu
npm run data:validate
```

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The API key stays on the server. Gemini Interactions requests explicitly set `store:false`.

## Demo flow

The three featured documents each answer a different question:

- **Complete order:** can a clean document bypass header review?
- **Invoice plus order IDs:** does the field contract choose Order # and leave gross amount null instead of substituting Invoice # or Net Total?
- **Ten-page order:** does the pipeline remain inspectable when the document is long and the available row labels are unreliable?

The full document list adds rotated pages, dense tables, negative and zero amounts, an out-of-scope form, and OCR noise.

## Evaluation

Run the saved 12-document harness with either model:

```bash
npm run eval -- gemini-3.5-flash
npm run eval -- gemini-3.1-flash-lite
```

Recompute validation and comparison after deterministic code changes without paying for another model run:

```bash
npm run eval:rescore -- gemini-3.5-flash gemini-3.1-flash-lite
```

The current Gemini 3.5 Flash run produced:

| Metric | Result |
| --- | ---: |
| Schema-valid responses | 100% |
| Documents bypassing header review | 9 / 12 |
| Accepted documents correct on advertiser, order ID, and gross | 100% |
| Scored header-field pass rate | 88.3% |
| Exact line-item row F1 | 29.1% on 107 rows |
| Aligned line-item field accuracy | 79.2% |
| Median latency | 3.7 s |
| Total measured inference cost | $0.2075 |

Exact-row F1 is deliberately strict. A line item receives credit only when channel, description, both dates, and amount all match one gold row. The aligned-field metric shows partial correctness when a row misses exact credit because one field differs.

The 12-document set is too small to set a production threshold. One result moves a reported rate by 8.3 percentage points. A partner pilot should use 100 to 200 stratified, jointly reviewed documents before choosing an operating threshold.

## Dataset and redistribution

The public repository does not contain VRDU PDFs or derived row labels. The archived upstream repository does not declare redistribution terms. `scripts/prepare_vrdu_subset.py` rebuilds the fixed local pack from your own checkout using:

- `config/vrdu-selection.json` for document selection;
- `config/vrdu-adjudications.json` for source-verified corrections and score exclusions.

Five disputed header labels are excluded from headline metrics. A source audit also excludes 64 corrupted row labels from exact-row scoring, leaving 107 of 171 rows in the aggregate.

## Build notes

I started the UI in Google AI Studio Build. The builder returned `RpcError: The caller does not have permission` after a paid key was selected and across several model choices. I moved the app to local Next.js so the integration work could continue while keeping the Gemini request path, schema, and settings explicit.

The other API snag was PDF resolution. Interactions rejected resolution controls on PDF document items, while image items accepted them. The app renders pages locally and sends high-resolution image inputs instead. [FRICTION_LOG.md](FRICTION_LOG.md) records the evidence, partner impact, workaround, and product request for each issue.

## Project map

```text
app/                         Next.js UI and API routes
lib/                         Gemini client, PDF rendering, data loading
shared/                      schema, normalization, validation, scoring
scripts/                     benchmark, rescoring, and dataset tools
schemas/                     JSON Schema used for structured output
prompts/                     extraction prompt and AI Studio build prompts
config/                      fixed selection and adjudication decisions
slides/                      four-slide partner engineering briefing
outputs/EVALUATION_SUMMARY.md aggregate evaluation evidence
```

## Verification

```bash
npm run data:validate
npm run typecheck
npm test
npm run build
```
