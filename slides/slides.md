---
theme: default
title: Ad Order Review Gate
info: A four-slide partner engineering briefing for a measured Gemini document extraction workflow.
author: Agrim Singh
aspectRatio: 16/9
canvasWidth: 1440
colorSchema: light
download: true
exportFilename: ad-order-review-gate-briefing
lineNumbers: false
---

<DecisionSlide />

<!--
Start with the partner's decision, not the model. A media-buying operations team receives orders, contracts, invoices, credit memos, and request sheets. They need to know which documents can move forward without someone checking every header.

The policy is conservative by design. A document bypasses header review only when advertiser, the underlying order or contract ID, both flight dates, and an explicit gross amount are present and valid. A correctly extracted null still sends the document to review.

Nine of twelve documents cleared that rule. All nine matched the benchmark on advertiser, order ID, and gross amount. The cost per accepted document includes inference spent on the three reviewed documents, so it reflects the workload rather than cherry-picking successful calls.

Line items are a separate decision. Exact-row F1 is 29.1% because all five row fields must match for credit. That is useful diagnostic evidence, but it is not ready for automatic posting.
-->

---

<ArchitectureSlide />

<!--
Gemini handles the part deterministic code is bad at: reading varied layouts and mapping them to a field contract. It returns source-faithful strings or explicit nulls. Code owns everything that can be made reproducible: normalization, date and money parsing, validation, routing, scoring, and cost calculation.

This split prevents a prompt change from silently changing business policy. The address normalizer is a concrete example. One credit memo included Main and Billing phone numbers after the station address. A versioned suffix rule removes those contact fields before validation.

The PDF path required a workaround. Interactions rejected resolution controls on PDF document items. Rendering each page at 180 DPI and sending high-resolution image items produced the intended request, although the extra preprocessing should not be necessary.

I use minimal thinking because this is extraction, and store is explicitly false because document privacy should not depend on a default. Batch belongs in a throughput extension. It uses generateContent rather than Interactions, so adding it to the live proof would create a second integration path before the quality decision is settled.
-->

---

<EvaluationSlide />

<!--
The evaluator measures the same path the partner would run. A saved benchmark document and a live upload both go through extraction, deterministic checks, and the review gate. Gold comparison is attached afterward and never changes the route.

The paired model run makes the trade-off concrete. Flash-Lite was much cheaper, but it allowed one incorrect critical header through the gate. Under this policy, that disqualifies it as the primary model even though its average cost looks better.

Exact-row F1 needs context. The primary model produced 31 exact matches from 106 predicted rows and 107 gold rows. Among rows that could be aligned, 301 of 380 individual fields matched. That gap shows where row grouping or one bad value turns a mostly correct row into an exact miss.

Twelve documents are enough to exercise the harness, but too few to set a production threshold. One result moves a rate by 8.3 percentage points. A partner pilot should expand to 100 to 200 jointly labeled documents, add confidence intervals, and monitor review corrections plus random audits of accepted documents.
-->

---

<FrictionSlide />

<!--
The AI Studio failure was the first blocker. Build mode returned the same permission RPC across three model choices after a paid Tier 1 key was selected. The message did not identify the denied principal or missing permission. After about thirty minutes, I moved the UI to local Next.js and kept the same Gemini key, prompt, schema, and request settings.

The PDF issue was separate and reproducible in code. Interactions rejected both resolution controls on PDF document blocks, while image blocks accepted high resolution. Local page rendering worked, but the service behavior, SDK types, and documentation should agree.

The other two issues affect trust. Structured output can be valid and still choose the wrong business value. Benchmarks can also contain ambiguous or corrupt labels. Both require explicit field definitions, provenance, deterministic checks, and monitoring around the model.

The practical product request is an executable reference that continues past JSON generation. It should show semantic validation, review routing, benchmark comparison, privacy settings, telemetry, and production monitoring in one path.
-->
