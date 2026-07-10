<template>
  <div class="deck-slide evaluation-slide">
    <div class="slide-topline">
      <span>Ad Order Review Gate</span>
      <span>Evaluation · 3 / 4</span>
    </div>

    <header class="slide-heading compact-heading">
      <p class="eyebrow">Operating measure</p>
      <h1>Measure review saved without hiding accepted errors</h1>
      <p class="lede">Three questions: how much review disappears, how often accept is actually right, and which failure modes remain.</p>
    </header>

    <main class="evaluation-main">
      <section class="model-choice">
        <div class="section-heading-row">
          <p class="section-label">Paired model run</p>
          <span>Same 12 documents · same prompt · same gate</span>
        </div>

        <div class="model-result recommended">
          <div class="model-name"><span>Primary</span><strong>Gemini 3.5 Flash</strong></div>
          <div class="model-measure"><span>Review saved</span><strong>75%</strong></div>
          <div class="model-measure"><span>Accepts correct</span><strong>100%</strong></div>
          <div class="model-measure"><span>Cost / accepted</span><strong>$0.0234</strong></div>
          <div class="decision-tag">Use</div>
        </div>

        <div class="model-result challenger">
          <div class="model-name"><span>Cost challenger</span><strong>Gemini 3.1 Flash-Lite</strong></div>
          <div class="model-measure"><span>Review saved</span><strong>75%</strong></div>
          <div class="model-measure"><span>Accepts correct</span><strong>100%</strong></div>
          <div class="model-measure"><span>Cost / accepted</span><strong>$0.0038</strong></div>
          <div class="decision-tag reject-tag">Hold</div>
        </div>

        <p class="model-conclusion">Flash-Lite is cheaper and matched this run. Held because a prior run let one wrong critical header through — under this policy, that is a disqualifier until a larger paired run.</p>
      </section>

      <aside class="eval-method">
        <div class="golden-set">
          <p class="section-label">Failure modes we score</p>
          <div class="dataset-line"><strong>Wrong field</strong><span>Invoice # or Net Total chosen instead of Order # / Gross</span></div>
          <div class="dataset-line"><strong>Overfill</strong><span>Model invents a value where the reference is null</span></div>
          <div class="dataset-line"><strong>Spot miss</strong><span>One bad field fails the whole placement</span></div>
          <p class="annotation-note">5 conflicting headers and 64 corrupted spot labels excluded and recorded.</p>
        </div>

        <div class="pilot-plan">
          <p class="section-label">Before production</p>
          <h2>Expand to 100–200 jointly labeled docs</h2>
          <p>Stratify by failure mode, add confidence intervals, and set the gate with the partner.</p>
          <p class="monitor-line"><b>Monitor:</b> accept-error rate, review rate drift, null-rate drift, reviewer corrections, random audits of accepted docs.</p>
        </div>
      </aside>
    </main>

    <div class="quality-strip" aria-label="Primary model evaluation metrics">
      <div><span>Schema valid</span><strong>100%</strong></div>
      <div><span>Header fields correct</span><strong>87.4%</strong></div>
      <div><span>Spots fully matched</span><strong>59%</strong><small>63 of 107 reference spots</small></div>
      <div><span>Spot fields correct</span><strong>95.5%</strong><small>after pairing · 363 of 380</small></div>
    </div>
  </div>
</template>
