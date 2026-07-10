<template>
  <div class="deck-slide architecture-slide">
    <div class="slide-topline">
      <span>Ad Order Review Gate</span>
      <span>Architecture · 2 / 4</span>
    </div>

    <header class="slide-heading compact-heading">
      <p class="eyebrow">System boundary</p>
      <h1>Keep business decisions outside the model</h1>
      <p class="lede">Gemini reads the source. Versioned code normalizes values, checks the contract, routes the document, and measures the result.</p>
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
          <span>03 · Contract</span>
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
          <span>05 · Route + report</span>
          <strong>Accept or review</strong>
          <small>VRDU score when gold exists</small>
        </div>
      </div>

      <div class="boundary-labels" aria-hidden="true">
        <span class="model-boundary">Model work</span>
        <span class="code-boundary">Application work</span>
      </div>

      <section class="architecture-reasons">
        <div>
          <p class="section-label">Source-faithful values</p>
          <h2>Preserve what the document says</h2>
          <p>Dates and money stay as strings until deterministic parsers handle them. Net Total never silently becomes Gross Amount.</p>
        </div>
        <div>
          <p class="section-label">No model confidence</p>
          <h2>Acceptance comes from evidence</h2>
          <p>Field checks, review corrections, and golden-set regressions are observable. A self-reported score is not used for routing.</p>
        </div>
        <div>
          <p class="section-label">Advisory amount check</p>
          <h2>The benchmark often does not add up</h2>
          <p>Only about 81% of eligible VRDU documents reconcile to gross, so arithmetic mismatch cannot be an automatic failure.</p>
        </div>
      </section>
    </main>

    <div class="config-line">
      <code>resolution: high</code>
      <code>thinking: minimal</code>
      <code>store: false</code>
      <code>normalizer: address-contact-v1</code>
      <span>Scale extension: Batch via generateContent, not built in v1.</span>
    </div>
  </div>
</template>
