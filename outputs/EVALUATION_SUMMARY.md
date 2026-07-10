# Evaluation Summary

Run date: July 10, 2026. Demo set: 12 documents, 32 pages, and 171 annotated line items. One source-audited document has corrupted VRDU row labels, so exact row metrics use 107 rows across 11 documents.

Numbers below are from the post-scoring-fix benchmark rerun (signed money comparison, non-null spot pairing, org-name address stripper v2, and parenthetical name-code prompt fix).

## Model Comparison

| Metric | Gemini 3.5 Flash | Gemini 3.1 Flash-Lite |
|---|---:|---:|
| Schema-valid responses | 100% | 100% |
| Partner auto-accept rate | **75.0%** | 75.0% |
| Accepted key-field accuracy | **100%** | 100% |
| Header-field pass rate | **87.4%** | 84.5% |
| Model value where gold is null | 7.8% | 7.8% |
| Missing-value rate | 0% | 0% |
| Exact line-item F1 (107 rows) | **59.2%** | 59.4% |
| Matched-row leaf accuracy | 95.5% | **96.8%** |
| Median / p95 latency | 4.1s / 31.1s | **2.7s / 17.5s** |
| Total estimated cost | $0.2109 | **$0.0343** |
| Cost per auto-accepted document | $0.0234 | **$0.0038** |

Use Gemini 3.5 Flash for the primary route. Flash-Lite matched acceptance quality on this run and is materially cheaper, but an earlier paired run auto-accepted a wrong critical header, so it stays on hold pending a larger paired evaluation.

## Partner Policy

The example partner policy auto-accepts a header only when advertiser, contract/order identifier, flight dates, and explicit gross amount are present; schema, dates, and money must also validate. Missing source values can be correct extraction and still send a document to review. Line items remain review-only and do not block header auto-accept.

Gemini 3.5 Flash auto-accepted 9 of 12 documents. All nine matched gold on advertiser, contract/order identifier, and gross amount. Review cases were the net-only invoice, out-of-scope request sheet, and negative credit memo.

## Label Adjudication

The ten-page WKOW document originally scored 55.6% on headers. Source review found two broken gold dates and an underspecified station-name contract. After correcting the dates and defining station-name precedence, both models score 9/9 headers on that document.

Its 64 VRDU row annotations truncate dates and splice Comments text into `program_desc`. Those rows remain visible but are excluded from exact-row aggregates. The adjudication is recorded in `config/vrdu-adjudications.json` and can be reapplied with `npm run data:adjudicate`.

## Boundary

Header automation is supported by this demo. Line-item posting is not: exact-row F1 is about 59% on the 107 trustworthy row labels, even though aligned spot fields match about 95–97% of the time. A partner pilot should use 100-200 stratified, co-labeled documents before setting a production threshold.
