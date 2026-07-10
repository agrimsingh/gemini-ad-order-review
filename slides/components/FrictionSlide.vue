<template>
  <div class="deck-slide friction-slide">
    <div class="slide-topline">
      <span>Ad Order Review Gate</span>
      <span>Signal · 4 / 4</span>
    </div>

    <header class="slide-heading compact-heading friction-heading">
      <p class="eyebrow">Observed during the build</p>
      <h1>Friction worth fixing</h1>
      <p class="lede">Reproduced problem, partner impact, workaround, and the product change that would remove it.</p>
    </header>

    <main class="friction-table" role="table" aria-label="Observed developer friction">
      <div class="friction-row friction-head" role="row">
        <div role="columnheader">Issue</div>
        <div role="columnheader">Evidence and partner impact</div>
        <div role="columnheader">Workaround</div>
        <div role="columnheader">Product ask</div>
      </div>

      <div class="friction-row" role="row">
        <div class="friction-issue" role="cell"><span>P1 · 30 min</span><strong>AI Studio Build RPC</strong></div>
        <div role="cell"><code>The caller does not have permission</code> on three models after a paid Tier 1 key was selected. The UI did not identify whether the problem was the key, project, model, or builder.</div>
        <div role="cell">Built the Next.js prototype locally with the same Gemini key; kept AI Studio for prompt and schema work.</div>
        <div role="cell">Show the denied principal, missing permission, and a direct fix in the error.</div>
      </div>

      <div class="friction-row" role="row">
        <div class="friction-issue" role="cell"><span>P1 · 20 min</span><strong>PDF resolution controls</strong></div>
        <div role="cell"><code>resolution</code> and <code>media_resolution</code> on Interactions PDF items returned 400. Service behavior, SDK types, and document guidance did not agree.</div>
        <div role="cell">Rendered pages at 180 DPI and sent image items with <code>resolution: high</code>.</div>
        <div role="cell">Align the API, SDK, and docs. Add one executable high-resolution PDF example.</div>
      </div>

      <div class="friction-row" role="row">
        <div class="friction-issue" role="cell"><span>P1 · quality</span><strong>Valid JSON, wrong value</strong></div>
        <div role="cell">Flash-Lite returned schema-valid output and still auto-accepted one wrong critical header. Shape validation alone can create silent errors.</div>
        <div role="cell">Kept normalization, semantic checks, routing, benchmark comparison, and audit outside the model.</div>
        <div role="cell">Publish a reference extractor that covers structured output, semantic evaluation, and monitoring.</div>
      </div>

      <div class="friction-row" role="row">
        <div class="friction-issue" role="cell"><span>P1 · 15 min</span><strong>Field contract and labels</strong></div>
        <div role="cell">Invoice #, Order #, and Net Total were all plausible until the target contract was written. Source audit also found five conflicting headers and 64 corrupted row labels.</div>
        <div role="cell">Defined field precedence, recorded adjudications, and excluded disputed labels from headline metrics.</div>
        <div role="cell">Ship field definitions, annotation provenance, and label-quality flags with extraction benchmarks.</div>
      </div>
    </main>

    <footer class="friction-close">
      <span>What partners need</span>
      <strong>One reference path for extraction, semantic validation, review routing, benchmark comparison, and production monitoring.</strong>
    </footer>
  </div>
</template>
