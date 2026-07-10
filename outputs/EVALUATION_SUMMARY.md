# Evaluation Summary

Run date: July 10, 2026. Demo set: 12 documents, 32 pages, and 171 annotated line items. One source-audited document has corrupted VRDU row labels, so exact row metrics use 107 rows across 11 documents.

## Model Comparison

| Metric | Gemini 3.5 Flash | Gemini 3.1 Flash-Lite |
|---|---:|---:|
| Schema-valid responses | 100% | 100% |
| Partner auto-accept rate | **75.0%** | 66.7% |
| Accepted key-field accuracy | **100%** | 87.5% |
| Header-field pass rate | **88.3%** | 81.6% |
| Model value where gold is null | 6.8% | 6.8% |
| Missing-value rate | 0% | 1.0% |
| Exact line-item F1 (107 rows) | 29.1% | 29.2% |
| Matched-row leaf accuracy | 79.2% | 88.7% |
| Median / p95 latency | 3.7s / 30.4s | 2.8s / 17.1s |
| Total estimated cost | $0.2075 | $0.0336 |
| Cost per auto-accepted document | $0.0231 | $0.0042 |

Use Gemini 3.5 Flash for the primary route. Flash-Lite is cheaper but auto-accepted one document with a key-field error.

## Partner Policy

The example partner policy auto-accepts a header only when advertiser, contract/order identifier, flight dates, and explicit gross amount are present; schema, dates, and money must also validate. Missing source values can be correct extraction and still send a document to review. Line items remain review-only and do not block header auto-accept.

Gemini 3.5 Flash auto-accepted 9 of 12 documents. All nine matched gold on advertiser, contract/order identifier, and gross amount. Review cases were the net-only invoice, out-of-scope request sheet, and negative credit memo.

## Label Adjudication

The ten-page WKOW document originally scored 55.6% on headers. Source review found two broken gold dates and an underspecified station-name contract. After correcting the dates and defining station-name precedence, both models score 9/9 headers on that document.

Its 64 VRDU row annotations truncate dates and splice Comments text into `program_desc`. Those rows remain visible but are excluded from exact-row aggregates. The adjudication is recorded in `config/vrdu-adjudications.json` and can be reapplied with `npm run data:adjudicate`.

## Boundary

Header automation is supported by this demo. Line-item posting is not: exact-row F1 is about 29% on the 107 trustworthy row labels. A partner pilot should use 100-200 stratified, co-labeled documents before setting a production threshold.
