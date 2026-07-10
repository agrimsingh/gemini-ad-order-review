# Google AI Studio Build Sequence

Use Google AI Studio **Build mode** and choose a web app. Attach `vrdu-mini-ai-studio.zip` to the first prompt if attachments are available. The ZIP contains the schema, extraction prompt, PDFs, gold labels, manifest, and VRDU comparator map.

Send these prompts in order. Let each pass finish and test before sending the next one.

## Prompt 1: Build the working vertical slice

```text
Build a full-stack web application called "Ad Spend Extraction Workbench" for a forward-deployed engineering demo. This is an operational tool, not a landing page. The VRDU benchmark is part of the product path, not a detached leaderboard.

I am attaching a data pack. Unpack or add its contents to the server-side project while preserving this structure:
- schemas/ad_buy_extraction.schema.json
- prompts/extraction-system-prompt.txt
- data/vrdu-mini/manifest.jsonl
- data/vrdu-mini/gold.jsonl and gold/*.json
- data/vrdu-mini/meta.json
- data/vrdu-mini/pdfs/*.pdf

Use React on the client and the AI Studio server-side Node runtime. Keep GEMINI_API_KEY server-side. Use @google/genai version 2.3.0 or newer and the GA Interactions API, not generateContent.

Implement one end-to-end path first:
1. Preselect the manifest document with demo_rank=1.
2. Render its PDF in the browser.
3. An Extract button posts the PDF to a server endpoint.
4. The server renders the PDF into ordered high-resolution page images, then calls Gemini with model gemini-3.5-flash.
5. The Interactions request must use:
   - store: false
   - input containing ordered JPEG page items with resolution high, followed by a short extraction request
   - system_instruction loaded from prompts/extraction-system-prompt.txt
   - response_format { type: "text", mime_type: "application/json", schema: <the attached JSON schema> }
   - generation_config { thinking_level: "minimal" }
   - no temperature, top_p, top_k, or thinking_budget
6. Parse interaction.output_text as JSON and validate it server-side against the same JSON schema with Ajv 2020. Do not trust schema-shaped values without application validation.
7. Apply independent normalization and semantic validation, then derive READY or REVIEW.
8. When the selected document is from the VRDU manifest, compare the result with its gold file using the comparator map, respecting score_excluded_fields.
9. Return the extraction, validation and gate results, VRDU comparison when available, latency, model id, and all available usage fields: total, input, output, and thought tokens.

The extraction schema is the only model output. Do not ask Gemini to calculate totals, confidence, warnings, or normalized fields.

The partner field contract is explicit:
- property is the legal station/entity printed beside the postal address; prefer it over logo, market, network, or call-sign text.
- tv_address is postal address only. Deterministically remove labeled contact suffixes such as Main:, Billing:, Phone:, and Fax: before validation.
- contract_num is the underlying media-buy identifier: use Contract # when present, otherwise Order #. If both Order # and Invoice # are present, use Order #. Never populate contract_num from Invoice # alone.
- gross_amount is an explicit Gross Amount, Contract Amount, or Grand Total on an order or contract. For a credit memo, use the explicit credit amount. Never substitute Net Total, Invoice Total, line-item subtotals, or a calculated sum.
- preserve the selected source values exactly; application code handles parsing and comparison.

Add deterministic application validation after extraction:
- acceptance fields: advertiser, contract_num, flight_from, flight_to, gross_amount
- parse money without floating-point arithmetic; support currency symbols, commas, negative signs, and parentheses
- parse common US dates without changing the displayed raw value
- check flight_from <= flight_to when both parse
- report line-item missing cells
- compare the sum of parseable sub_amount values to gross_amount only as an ADVISORY anomaly, never as a hard correctness rule

Derive a binary READY or REVIEW header decision with an array of explicit reasons. REVIEW on invalid schema, any missing acceptance field, unparseable present gross amount, or impossible date order. Report sparse line-item rows separately because rows remain review-only and do not block header auto-accept. Do not call this a confidence score.

UI requirements:
- quiet, dense, work-focused interface
- fixed top bar with product name, model id, and API status
- left column: sample documents ordered by demo_rank with slice and difficulty tags, plus Upload PDF
- center: large PDF viewer
- right: status, review reasons, document fields, and a compact line-item table
- tabs for Extraction, Validation, VRDU Comparison, and Raw JSON
- no hero, marketing copy, gradient background, decorative cards, or nested cards
- use Lucide icons for upload, run, refresh, status, and JSON actions
- professional neutral palette with green, amber, and red reserved for state
- responsive enough for a 1440x900 demo; prioritize desktop density
- expanded document lists scroll independently above any pinned summary/footer
- long validation values wrap within their row and never overlap adjacent labels or values

Add clear loading, API error, invalid JSON, and empty states. Never silently fall back to mock extraction data. Label cached or fixture results explicitly if they are ever shown.

Before finishing this pass, run the app, fix build/runtime errors, and verify the demo_rank=1 PDF loads, a real server request reaches the Gemini endpoint, and the result can be compared with that document's gold extraction.
```

## Prompt 2: Add the evaluation harness

```text
Now extend the same extraction, normalization, validation, gate, and VRDU-comparison path into a holdout runner. Do not create a separate benchmark implementation.

Add an Evaluation tab with:
- a Run holdout button
- concurrency limited to 2 requests
- per-document progress and retry-on-429 with bounded exponential backoff
- the ability to stop the run
- results retained in memory for this session and downloadable as JSON and CSV

Implement comparator functions selected by data/vrdu-mini/meta.json:
- GeneralStringMatch: Unicode normalize, lowercase, collapse whitespace, and ignore punctuation-only differences
- AddressMatch: the same normalization plus compare normalized address tokens
- NumericalStringMatch: compare digit strings while preserving meaningful leading zeros
- DateMatch: parse common source formats into a canonical calendar date; unparseable values fail rather than guessing
- PriceMatch: parse to integer cents and compare exactly; support commas, currency symbols, minus signs, and parentheses

Respect manifest score_excluded_fields. Show excluded fields as LABEL EXCLUDED in drill-down and omit them from headline accuracy denominators.

Treat this as a demo golden set: 12 unseen-template documents, 32 pages, and 171 annotated line items. It does not establish statistical significance or a partner SLA. Exact-row aggregates use the 107 annotations that remain after source adjudication. Surface the slices from the manifest: complete forms, field-semantics and gross-vs-net traps, out-of-scope forms, dense and rotated layouts, negative/zero amounts, OCR ambiguity, and long documents.

In the report notes, state that a partner pilot expands this to 100-200 stratified, co-labeled documents with confidence intervals and partner-approved field rules.

For line items, do not use positional equality alone. Implement deterministic key-based matching:
1. Score every predicted/gold pair using normalized similarity over program_desc, program_start_date, program_end_date, and channel, ignoring null keys.
2. Greedily assign highest-scoring non-conflicting pairs above a documented threshold.
3. Unmatched predictions are false positives; unmatched gold rows are false negatives.
4. Compute line-item precision, recall, F1, and matched-row leaf accuracy over the five line-item fields.

Report this full measurement set:
- schema-valid rate
- header field pass rate and per-field pass rate
- gold-null overfill rate (the benchmark hallucination proxy): predicted non-null where gold is null. Label this as a semantic disagreement, not proof that source text was fabricated
- missing-value rate: predicted null where gold is present
- line-item precision, recall, F1, and matched-row leaf accuracy
- critical-fields-all-correct rate per document
- median and p95 latency
- total input, output, thought, and total tokens
- estimated cost using clearly labeled, editable pricing constants with a last-checked date; do not hide the measured token counts behind the estimate

At the top of the report, generate this sentence from measured results:
"At this acceptance rule, X% of documents bypass review at Y% critical-field accuracy. Errors cluster in [measured slices], and each accepted document costs Z."

Define critical-field accuracy as READY documents whose scored critical fields all match partner-approved gold / all READY documents. Define cost per accepted document as total inference cost / READY documents. Show all three metrics with raw numerators and denominators. With n=12, one document changes a rate by 8.3 percentage points.

Support a paired model experiment on the same selected documents:
- primary: gemini-3.5-flash, high PDF resolution, minimal thinking
- cost challenger: gemini-3.1-flash-lite with identical prompt, schema, resolution, validation, and gate

Show paired per-document deltas in quality, latency, input/output/thought tokens, and estimated cost. Do not switch the default model based on aggregate cost alone.

Add filters by slice and difficulty. Clicking a result row must open the source PDF, predicted extraction, gold extraction, field-level diffs, exclusions, and review reasons.

Record an immutable run tuple with model id, prompt hash, schema hash/version, PDF resolution, thinking level, store setting, validator version, and gate version. Include it in exported JSON and CSV metadata.

Add unit tests for every comparator, negative and parenthesized money, gold-null overfill/miss accounting, score exclusions, line-item alignment, field-semantics cases, and READY/REVIEW routing. Run them and fix failures before finishing.
```

## Prompt 3: Make the demo immediately legible

```text
Refine the existing workbench for a five-minute partner demo. Do not add new architecture.

The default first screen must already show the demo_rank=1 document selected in the left rail and its PDF visible in the center. The primary action must be a single Extract button. After extraction, the right panel should lead with READY or REVIEW and the exact reasons, then show critical fields, then the line-item table.

Make the Evaluation tab readable in under ten seconds:
- first line: "At this acceptance rule, X% of documents bypass review at Y% critical-field accuracy. Errors cluster in these slices, and each accepted document costs Z."
- top row: READY coverage, critical-field accuracy among READY documents, and cost per accepted document
- secondary diagnostic row: schema validity, per-field accuracy, line-item F1, gold-null overfill, missing-value rate, and median/p95 latency
- below: one sortable document table
- state clearly that the 12-document, 32-page, 171-line-item set is a demo golden set, not a statistically significant benchmark or SLA proof
- distinguish measured results from proposed production targets
- distinguish label exclusions from model errors

Use compact typography and stable column widths so content does not shift while loading. Keep the PDF viewer large enough to inspect the real document. Remove explanatory feature copy, decorative panels, large headings, and anything that looks like a marketing page.

Add a presentation-safe cached-results import/export control, but never present cached results as a live run. A visible LIVE or CACHED badge must always identify provenance.

Test at 1440x900 and 1280x800. Fix clipped text, overlapping panels, horizontal page scrolling, and line-item table overflow.
```

## Prompt 4: Produce the friction log and final verification

```text
Do a final engineering pass and create docs/FRICTION_LOG.md based only on what actually occurred in this build.

Every issue must use this order:
- status: OBSERVED DURING BUILD or PRE-IDENTIFIED RISK, NOT REPRODUCED
- reproduction and evidence: smallest sequence, exact error, unexpected result, version, or source
- partner impact
- workaround used or proposed
- actionable product or documentation ask
- severity and time lost when observed

Do not claim a forum or GitHub issue was reproduced unless it happened here. Keep pre-identified risks in a separate section.

Investigate and classify these high-signal topics:
- Interactions is recommended while Batch remains on generateContent
- store=true is the default and store=false is an explicit privacy decision
- PDF resolution, token accounting, and pricing guidance are spread across several docs
- structured outputs constrain shape without providing semantic confidence
- the VRDU subset contains five excluded fields with conflicting annotations
- one VRDU invoice contains both Invoice # and Order # plus a Net Total but no labeled Gross Amount, exposing why partner field semantics must be explicit before scoring
- model, API, and pricing changes require rerunning the versioned benchmark

Close the friction log with this finding: "The missing artifact is not another invoice extractor. It is an end-to-end reference for extraction, semantic validation, benchmark comparison, review gating, and production monitoring."

Also create docs/MONITORING_PLAN.md. It must specify golden-set regression on every change to the run tuple, schema/review/null/parse-failure drift, review corrections flowing back into the golden set, and random audits of auto-accepted documents.

Then verify and report:
- @google/genai is 2.3.0 or newer
- all Gemini calls are server-side
- the app uses interactions.create and not generateContent
- store is false
- PDF resolution is high
- response_format uses application/json plus the attached schema
- no deprecated response_mime_type or thinking_budget remains
- no temperature/top_p/top_k is set
- usage and latency are recorded
- the 12-document manifest, PDFs, and gold files all resolve
- comparator and routing tests pass
- every result export includes the immutable model+prompt hash+schema+settings tuple
- the holdout report includes the measured acceptance-rule sentence and raw denominators
- there is no silent mock-data fallback

Fix issues you find. End by giving me a short list of files changed, tests run, and any remaining demo risk.
```

## Optional Prompt 5: Failure-only escalation experiment

```text
Add an experiment-only action that reruns documents that fail critical-field scoring or route to REVIEW with gemini-3.1-pro-preview. Keep the prompt, schema, resolution, normalization, validation, and scoring identical.

Report how many failures Pro resolves, how many remain, the incremental latency and cost, and whether the preview-model dependency is justified. Do not make escalation automatic. Label the feature EXPERIMENTAL and keep it out of the primary five-minute demo unless the results are clear.
```
