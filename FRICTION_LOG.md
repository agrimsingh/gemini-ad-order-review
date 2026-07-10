# Friction log

Write entries while building. Promote an item to the briefing only when its status and evidence are clear.

## Observed during this build

### AI Studio Build calls failed after paid-key selection

- **Status:** Observed during build
- **Reproduction and evidence:** AI Studio Build mode returned `RpcError: The caller does not have permission` and canceled direct build prompts with Gemini 3.5 Flash, Gemini 3.1 Pro Preview, and Gemini Flash Latest. The same behavior persisted after selecting the existing Tier 1 key and switching to pay-per-request.
- **Partner impact:** The UI does not distinguish model authorization, project permission, and builder-service failures, so a partner can spend the engagement debugging the wrong layer.
- **Workaround:** Build the prototype locally with the same Gemini key and keep AI Studio as prompt/prototyping evidence.
- **Product ask:** Show the denied principal, required permission, and a direct remediation action in the Build error.
- **Severity:** P1
- **Time lost:** 30 minutes

### PDF resolution controls are rejected on Interactions document items

- **Status:** Observed during build
- **Reproduction and evidence:** With `@google/genai@2.11.0`, a Gemini 3.5 Flash Interactions request containing an inline PDF returned `400 Unknown parameter 'resolution' at 'input[0]'`. `media_resolution` on the item and in `generation_config` also returned 400, including with `v1alpha`. SDK `DocumentContent` omits resolution while `ImageContent` includes it.
- **Partner impact:** The documented quality/cost knob cannot be applied directly to a PDF document item, blocking a quality-first implementation and complicating capacity estimates.
- **Workaround:** Render each PDF page locally at 180 DPI and send JPEG page items with supported `resolution:"high"`.
- **Product ask:** Align the Interactions service, SDK types, and media-resolution documentation for PDF document blocks. Include an executable PDF example.
- **Severity:** P1
- **Time lost:** 20 minutes

### Schema-valid output still contains semantic errors

- **Status:** Observed during build
- **Reproduction and evidence:** Gemini 3.5 Flash produced valid schema and a deterministic ACCEPT route on the baseline while populating `tv_address` that VRDU gold marks null. After correcting the partner field contract and rerunning the full set, Flash-Lite still auto-accepted one rotated-layout document with an incorrect scored critical header.
- **Partner impact:** Treating JSON validity as extraction confidence creates silent downstream errors.
- **Workaround:** Separate schema validation, deterministic routing, VRDU comparison, and random audit. Do not use self-reported confidence.
- **Product ask:** Publish a document-extraction reference that includes semantic evaluation, review gating, and monitoring.
- **Severity:** P1
- **Time lost:** 0 minutes; this is expected evaluation signal

### Interactions usage field names differ from legacy telemetry parsers

- **Status:** Observed during build
- **Reproduction and evidence:** The live response reports `usage.total_input_tokens`, `usage.total_output_tokens`, and `usage.total_thought_tokens`. Parsing only `input_tokens` and `output_tokens` yielded zero tokens and zero estimated cost.
- **Partner impact:** Cost dashboards can silently under-report usage.
- **Workaround:** Parse current total fields first, retain legacy fallbacks, and regression-test nonzero usage.
- **Product ask:** Version the usage schema and provide typed migration examples.
- **Severity:** P1
- **Time lost:** 5 minutes

### Partner ontology and benchmark labels diverged on one invoice

- **Status:** Observed during build
- **Reproduction and evidence:** VRDU document `42adf390-6e50-6fbc-fbbe-65117a1ffcb2` visibly contains `Invoice # 1390338-4`, `Order # 1390338`, and `Net Total $500.00`. VRDU gold assigns `contract_num=1390338` and `gross_amount=null`. The initial schema allowed a contract, order, or invoice identifier and allowed gross, total, net, or credit amounts, so both Gemini's invoice identifier and Flash-Lite's net total were source-faithful under the stated contract even though they disagreed with gold.
- **Partner impact:** An underspecified target ontology can make a valid extraction look like a model failure, distort model selection, and hide whether the real problem is prompt, annotation, or workflow definition.
- **Workaround:** Define this prototype as order-record intake: Contract #, otherwise Order #, never Invoice #; Gross/Contract/Grand Total on an order, never Net Total. Rename the slice as a field-semantics case and rerun the versioned benchmark.
- **Product ask:** Ship extraction benchmarks with field definitions, source-label provenance, and adjudication guidance for documents containing multiple plausible identifiers or totals.
- **Severity:** P1
- **Time lost:** 15 minutes

## Entry template

### [Short issue title]

- **Status:** Observed during build / Pre-identified risk, not reproduced
- **Reproduction and evidence:** Smallest sequence, exact error or unexpected result, version, and source.
- **Partner impact:** Effect on implementation time, privacy, quality, capacity planning, cost, or operations.
- **Workaround:** What unblocked the prototype or would contain the risk.
- **Product ask:** One change an owning team could ship.
- **Severity:** P0 / P1 / P2
- **Time lost:** Minutes, for observed items only.

## Topics to track

### Interactions and Batch use different API surfaces

- **Status:** Pre-identified risk, not reproduced
- **Reproduction and evidence:** Current Interactions documentation lists Batch as a `generateContent`-only feature.
- **Partner impact:** An offline extraction pipeline may need parallel integration patterns and separate migration tests.
- **Workaround:** Build live v1 on Interactions and keep Batch in the scale design.
- **Product ask:** Publish a workload decision guide and feature-parity roadmap.
- **Severity:** P1

### Interactions stores requests by default

- **Status:** Pre-identified risk, not reproduced
- **Reproduction and evidence:** Current documentation states `store=true` by default; paid-tier Interaction objects may be retained for 55 days.
- **Partner impact:** A document-processing partner can make the wrong privacy assumption from a minimal example.
- **Workaround:** Set `store:false` and record that choice in the immutable run tuple.
- **Product ask:** Make storage behavior prominent in document-processing examples and generated AI Studio apps.
- **Severity:** P1

### PDF resolution, token accounting, and pricing are split across docs

- **Status:** Pre-identified risk, not reproduced
- **Reproduction and evidence:** Workload estimates require the document-processing, media-resolution, usage, and pricing references.
- **Partner impact:** Cost and capacity estimates take longer and are easier to get wrong.
- **Workaround:** Record input/output/thought/total tokens from the first request and keep dated pricing constants.
- **Product ask:** Publish one document-cost calculator and a consolidated extraction-cost guide.
- **Severity:** P2

### Structured output does not supply semantic confidence

- **Status:** Observed during build
- **Reproduction and evidence:** The baseline reproduced a schema-valid value disagreement, and the model challenger reproduced accepted critical-field errors.
- **Partner impact:** Teams can mistake valid JSON for reliable extraction and send silent errors downstream.
- **Workaround:** Keep normalization, validation, benchmark comparison, and review gating outside the model.
- **Product ask:** Publish an end-to-end extraction reference that includes semantic checks, evaluation, and routing.
- **Severity:** P1

### VRDU contains conflicting annotations

- **Status:** Observed during build
- **Reproduction and evidence:** Five header fields across three selected documents contain conflicting annotations. They are listed in `ambiguous_header_fields` and `score_excluded_fields`.
- **Partner impact:** Unfiltered label noise would distort a small holdout and could lead to the wrong model choice.
- **Workaround:** Show the exclusions in drill-down and remove them from headline denominators.
- **Product ask:** Benchmark cards should include label-quality flags, exclusion guidance, and adjudication status.
- **Severity:** P1
- **Time lost:** 10 minutes

### Model, API, and pricing churn

- **Status:** Pre-identified risk, not reproduced
- **Reproduction and evidence:** Model ids, API guidance, and rates are versioned and can change independently.
- **Partner impact:** Quality and unit economics can change without application-code changes.
- **Workaround:** Pin the full run tuple and rerun the golden set before any migration.
- **Product ask:** Provide machine-readable model deprecation, API compatibility, and pricing metadata.
- **Severity:** P1

## Do not claim without reproduction

- Property-ordering or near-empty JSON bugs.
- Thinking-token spikes from forum reports.
- Undocumented rate-limit or spend-cap behavior.
- Logprob availability or disappearance.
- Any specific SDK issue number.

Mention these only as sourced investigation areas. They are not build friction until this prototype reproduces them.
