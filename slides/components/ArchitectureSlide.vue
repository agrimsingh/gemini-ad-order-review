<template>
  <div class="deck-slide architecture-slide">
    <div class="slide-topline">
      <span>Ad Order Review Gate</span>
      <span>Architecture · 2 / 4</span>
    </div>

    <header class="slide-heading compact-heading">
      <p class="eyebrow">System boundary</p>
      <h1>Keep business decisions outside the model</h1>
      <p class="lede">Gemini reads the source. Versioned code normalizes values, checks the field contract, routes the document, and measures the result.</p>
    </header>

    <main class="architecture-main">
      <div class="pipeline" aria-label="Document extraction pipeline">
        <div class="pipe-step input-step">
          <span>01 · Input</span>
          <strong>PDF pages</strong>
          <small>180 DPI render</small>
        </div>
        <div class="pipe-arrow">→</div>
        <div class="pipe-step model-step">
          <span>02 · Read</span>
          <strong>Gemini 3.5 Flash</strong>
          <small>Interactions API</small>
        </div>
        <div class="pipe-arrow">→</div>
        <div class="pipe-step shape-step">
          <span>03 · Shape</span>
          <strong>JSON Schema</strong>
          <small>strings or explicit null</small>
        </div>
        <div class="pipe-arrow boundary-arrow">→</div>
        <div class="pipe-step code-step">
          <span>04 · Check</span>
          <strong>Deterministic code</strong>
          <small>normalize · validate · route</small>
        </div>
        <div class="pipe-arrow">→</div>
        <div class="pipe-step outcome-step">
          <span>05 · Decide</span>
          <strong>Accept or review</strong>
          <small>score against labels after</small>
        </div>
      </div>

      <div class="boundary-labels" aria-hidden="true">
        <span class="model-boundary">Model work</span>
        <span class="code-boundary">Application work</span>
      </div>

      <section class="architecture-reasons">
        <div>
          <p class="section-label">Trade-off 1</p>
          <h2>Preserve what the document says</h2>
          <p>Dates and money stay as printed strings until parsers handle them. Net Total never silently becomes Gross Amount.</p>
        </div>
        <div>
          <p class="section-label">Trade-off 2</p>
          <h2>No model confidence in the gate</h2>
          <p>Routing uses required fields and deterministic checks. Quality is measured afterward against labels, not a self-score.</p>
        </div>
        <div>
          <p class="section-label">Trade-off 3</p>
          <h2>Score labels separately from routing</h2>
          <p>Reference comparison never changes accept/review. That keeps partner policy stable when the benchmark is noisy.</p>
        </div>
      </section>
    </main>

    <div class="config-line">
      <code>resolution: high</code>
      <code>thinking: minimal</code>
      <code>store: false</code>
      <code>normalizer: org-name-address-v2</code>
      <span>Scale later: Batch via generateContent — not built in v1.</span>
    </div>
  </div>
</template>
