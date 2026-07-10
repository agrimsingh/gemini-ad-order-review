<template>
  <div class="deck-slide decision-slide">
    <div class="slide-topline">
      <span>Ad Order Review Gate</span>
      <span>Partner decision · 1 / 4</span>
    </div>

    <header class="slide-heading">
      <p class="eyebrow">Media-buy operations</p>
      <h1>Which documents can skip review?</h1>
      <p class="lede">Turn messy order PDFs into a structured record. Gemini reads the page; code decides whether a person still needs to look.</p>
    </header>

    <main class="decision-layout">
      <section class="decision-proof">
        <div class="policy-line">
          <span>Example partner rule</span>
          <strong>Auto-accept headers only when advertiser, order ID, flight dates, and explicit gross amount are present and valid.</strong>
        </div>

        <div class="primary-result">
          <div class="result-number">9<span>/12</span></div>
          <div class="result-copy">
            <strong>skipped header review</strong>
            <span>All 9 still matched the reference on advertiser, order ID, and gross.</span>
          </div>
        </div>

        <div class="result-strip" aria-label="Primary benchmark result">
          <div><strong>4.1s</strong><span>median decision time</span></div>
          <div><strong>100%</strong><span>accepted headers correct</span></div>
          <div><strong>$0.0234</strong><span>workload cost / accepted doc</span></div>
        </div>
      </section>

      <aside class="scope-boundary">
        <p class="section-label">Where the line sits</p>
        <div class="scope-item scope-pass">
          <span>Headers</span>
          <strong>Ready for a controlled pilot</strong>
          <p>Routine header review drops; incomplete or invalid headers stay in a visible queue.</p>
        </div>
        <div class="scope-item scope-review">
          <span>Spots</span>
          <strong>Keep human review</strong>
          <p><b>59% of reference spots fully matched.</b> One wrong field fails the whole spot. Not ready to auto-post.</p>
        </div>
      </aside>
    </main>

    <footer class="slide-footer">
      <span>Gemini 3.5 Flash · n=12 demo, not an SLA</span>
      <span>gemini-ad-order-review.vercel.app</span>
      <span>github.com/agrimsingh/gemini-ad-order-review</span>
    </footer>
  </div>
</template>
