<template>
  <div class="deck-slide friction-slide">
    <div class="slide-topline">
      <span>Ad Order Review Gate</span>
      <span>Signal · 4 / 4</span>
    </div>

    <header class="slide-heading compact-heading friction-heading">
      <p class="eyebrow">Signals for product and research</p>
      <h1>Friction worth fixing</h1>
      <p class="lede">Each row is a reproducible issue, the partner impact, what we did, and the change that would remove it.</p>
    </header>

    <main class="friction-table" role="table" aria-label="Observed developer friction">
      <div class="friction-row friction-head" role="row">
        <div role="columnheader">Signal</div>
        <div role="columnheader">What broke / why it matters</div>
        <div role="columnheader">Workaround</div>
        <div role="columnheader">Ask</div>
      </div>

      <div class="friction-row" role="row">
        <div class="friction-issue" role="cell"><span>P1 · product</span><strong>Opaque Build errors</strong></div>
        <div role="cell">AI Studio Build returned <code>permission</code> across three models after a paid key was selected. Could not tell if the fault was key, project, model, or builder.</div>
        <div role="cell">Built the app locally with the same Gemini key; kept AI Studio for prompt work.</div>
        <div role="cell">Name the denied principal, missing permission, and the fix in the error.</div>
      </div>

      <div class="friction-row" role="row">
        <div class="friction-issue" role="cell"><span>P1 · API</span><strong>PDF quality knob missing</strong></div>
        <div role="cell"><code>resolution</code> / <code>media_resolution</code> on Interactions PDF items returned 400. Docs, SDK types, and service behavior disagreed.</div>
        <div role="cell">Rendered pages at 180 DPI and sent images with <code>resolution: high</code>.</div>
        <div role="cell">Align API, SDK, and docs. Ship one executable high-res PDF example.</div>
      </div>

      <div class="friction-row" role="row">
        <div class="friction-issue" role="cell"><span>P1 · eval</span><strong>Valid JSON, wrong value</strong></div>
        <div role="cell">Schema-valid output still chose the wrong business field and once auto-accepted a bad critical header. Shape checks alone hide failure modes.</div>
        <div role="cell">Kept field checks, routing, label comparison, and audit outside the model.</div>
        <div role="cell">Publish a reference that covers structured output, semantic scoring, and monitoring.</div>
      </div>

      <div class="friction-row" role="row">
        <div class="friction-issue" role="cell"><span>P1 · data</span><strong>Field contract vs labels</strong></div>
        <div role="cell">Invoice #, Order #, and Net Total were all plausible until precedence was written. Source audit found 5 conflicting headers and 64 corrupted spot labels.</div>
        <div role="cell">Defined field precedence, recorded adjudications, excluded disputed labels from headline metrics.</div>
        <div role="cell">Ship field definitions, label provenance, and quality flags with extraction benchmarks.</div>
      </div>
    </main>

    <footer class="friction-close">
      <span>Research takeaway</span>
      <strong>Stop the example at “returns JSON.” Show how output is checked, routed, scored by failure mode, and monitored after accept.</strong>
    </footer>
  </div>
</template>
