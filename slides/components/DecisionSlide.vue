<template>
  <div class="deck-slide decision-slide">
    <div class="slide-topline">
      <span>Ad Order Review Gate</span>
      <span>Partner decision · 1 / 4</span>
    </div>

    <header class="slide-heading">
      <p class="eyebrow">Measured document automation</p>
      <h1>Which documents can skip review?</h1>
      <p class="lede">Gemini extracts the order. Deterministic checks decide whether a person still needs to see it.</p>
    </header>

    <main class="decision-layout">
      <section class="decision-proof">
        <div class="policy-line">
          <span>Example partner rule</span>
          <strong>Accept only when advertiser, order ID, flight dates, and explicit gross amount are present and valid.</strong>
        </div>

        <div class="primary-result">
          <div class="result-number">9<span>/12</span></div>
          <div class="result-copy">
            <strong>bypassed header review</strong>
            <span>All 9 had the correct advertiser, order ID, and gross amount.</span>
          </div>
        </div>

        <div class="result-strip" aria-label="Primary benchmark result">
          <div><strong>75.0%</strong><span>auto-accept rate</span></div>
          <div><strong>100%</strong><span>accepted key fields correct</span></div>
          <div><strong>$0.0231</strong><span>workload cost per accepted doc</span></div>
        </div>
      </section>

      <aside class="scope-boundary">
        <p class="section-label">Where the line sits</p>
        <div class="scope-item scope-pass">
          <span>Header fields</span>
          <strong>Ready for a guarded pilot</strong>
          <p>The gate removes routine review while preserving a visible queue.</p>
        </div>
        <div class="scope-item scope-review">
          <span>Line items</span>
          <strong>Keep human review</strong>
          <p><b>29.1% exact-row F1</b> across 107 trustworthy rows. One wrong field makes the whole row incorrect.</p>
        </div>
      </aside>
    </main>

    <footer class="slide-footer">
      <span>Gemini 3.5 Flash</span>
      <span>12 documents · 32 pages · 171 annotated rows</span>
      <span>Demo set, not an SLA</span>
    </footer>
  </div>
</template>
