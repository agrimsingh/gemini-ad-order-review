<template>
  <div class="deck-slide evaluation-slide">
    <div class="slide-topline">
      <span>Ad Order Review Gate</span>
      <span>Evaluation · 3 / 4</span>
    </div>

    <header class="slide-heading compact-heading">
      <p class="eyebrow">Operating measure</p>
      <h1>Measure the decision the partner will make</h1>
      <p class="lede">How much review disappears at an acceptable error rate, and where do the remaining errors cluster?</p>
    </header>

    <main class="evaluation-main">
      <section class="model-choice">
        <div class="section-heading-row">
          <p class="section-label">Paired model run</p>
          <span>Same 12 documents · same prompt · same gate</span>
        </div>

        <div class="model-result recommended">
          <div class="model-name"><span>Primary</span><strong>Gemini 3.5 Flash</strong></div>
          <div class="model-measure"><span>Auto-accept</span><strong>75.0%</strong></div>
          <div class="model-measure"><span>Accepted key fields</span><strong>100%</strong></div>
          <div class="model-measure"><span>Cost / accepted</span><strong>$0.0231</strong></div>
          <div class="decision-tag">Use</div>
        </div>

        <div class="model-result challenger">
          <div class="model-name"><span>Cost challenger</span><strong>Gemini 3.1 Flash-Lite</strong></div>
          <div class="model-measure"><span>Auto-accept</span><strong>66.7%</strong></div>
          <div class="model-measure bad-measure"><span>Accepted key fields</span><strong>87.5%</strong></div>
          <div class="model-measure"><span>Cost / accepted</span><strong>$0.0042</strong></div>
          <div class="decision-tag reject-tag">Hold</div>
        </div>

        <p class="model-conclusion">Flash-Lite is cheaper, but one wrong critical header bypassed review. That breaks the operating rule.</p>
      </section>

      <aside class="eval-method">
        <div class="golden-set">
          <p class="section-label">Demo golden set</p>
          <div class="dataset-line"><strong>12</strong><span>unseen-template documents</span></div>
          <div class="dataset-line"><strong>32</strong><span>pages across dense, rotated, OCR, and financial-edge slices</span></div>
          <div class="dataset-line"><strong>107</strong><span>trustworthy line-item labels scored</span></div>
          <p class="annotation-note">Five conflicting headers and 64 corrupted row labels are excluded and recorded.</p>
        </div>

        <div class="pilot-plan">
          <p class="section-label">Before production</p>
          <h2>Expand to 100-200 jointly labeled documents</h2>
          <p>Stratify by failure slice, add confidence intervals, and choose the gate with the partner.</p>
          <p class="monitor-line"><b>Monitor:</b> golden-set regression, null and review drift, reviewer corrections, and random audits of accepted documents.</p>
        </div>
      </aside>
    </main>

    <div class="quality-strip" aria-label="Primary model evaluation metrics">
      <div><span>Schema valid</span><strong>100%</strong></div>
      <div><span>Header field pass</span><strong>88.3%</strong></div>
      <div><span>Exact row F1</span><strong>29.1%</strong><small>31 exact · 106 model / 107 gold rows</small></div>
      <div><span>Aligned row fields</span><strong>79.2%</strong><small>301 of 380 fields</small></div>
    </div>
  </div>
</template>
