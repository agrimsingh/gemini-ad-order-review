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
Open with the partner job, not the model. Media-buy ops receives orders, contracts, invoices, credit memos, and request sheets. They need to know which documents can move without someone checking every header.

The rule is conservative: auto-accept headers only when advertiser, order ID, flight dates, and explicit gross are present and valid. A correct null still goes to review.

Nine of twelve cleared that rule. All nine still matched the reference on advertiser, order ID, and gross. Cost per accepted document includes the three reviewed docs, so it is workload cost.

Spots are a separate decision. 59% of reference spots fully matched. One wrong field fails the whole spot, so posting stays manual.
-->

---

<ArchitectureSlide />

<!--
Gemini does the layout reading. Code owns everything that must stay reproducible: normalization, date and money parsing, validation, routing, scoring, and cost.

Three trade-offs: keep source wording until parsers run; never route on model confidence; score labels after routing so noisy gold cannot rewrite partner policy.

The PDF path needed a workaround because Interactions rejected resolution on PDF document items. Page images at 180 DPI with resolution high worked. Minimal thinking, store false, versioned normalizer.
-->

---

<EvaluationSlide />

<!--
Package the auto-rater as three questions: review saved, accept correctness, remaining failure modes.

Failure modes we score: wrong field semantics, overfill where gold is null, and spot misses where one bad field fails the whole placement.

Flash-Lite matched this run and is cheaper. Held because a prior run let a wrong critical header through. Under this policy that is a disqualifier until a larger paired run.

The 59% fully matched vs 95.5% spot-field gap is the calibration signal: mostly-correct spots still fail exact match. n=12 is too small for a production threshold.
-->

---

<FrictionSlide />

<!--
Frame this as signals for product and research, not a complaint list.

Product: opaque Build errors waste partner time on the wrong layer.
API: PDF quality controls do not work as documented.
Eval: schema-valid JSON can still be the wrong business value.
Data: field contracts and label quality must ship with the benchmark.

Close on the research ask: examples should continue past JSON into checks, routing, failure-mode scoring, and post-accept monitoring.
-->
