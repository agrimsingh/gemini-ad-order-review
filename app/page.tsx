"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Database,
  ExternalLink,
  FileJson,
  FileSearch,
  FileText,
  Gauge,
  CircleHelp,
  Info,
  Layers3,
  LockKeyhole,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  TableProperties,
  Upload,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { compareToGold, HEADER_FIELDS } from "@/shared/evaluation";
import { EXTRACTION_PROMPT } from "@/shared/schema";
import type {
  ComparisonResult,
  Extraction,
  ExtractionResponse,
  ManifestEntry,
  ValidationResult,
} from "@/shared/types";

const BASELINE_ID = "00c3353e-a25f-574a-a9db-39a41579895a";
const NULL_TRAP_ID = "42adf390-6e50-6fbc-fbbe-65117a1ffcb2";
const LONG_STRESS_ID = "48310d93-0e1d-5377-b3e1-8bcdfaaa6422";
const EXTRACTION_REQUEST_PROMPT = `${EXTRACTION_PROMPT}\n\nExtract this PDF document now.`;

const MODEL_OPTIONS = [
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash", role: "Recommended" },
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", role: "Cost challenger" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", role: "Failure escalation" },
];

const TITLES: Record<string, string> = {
  [BASELINE_ID]: "WSIL-TV baseline order",
  "1b3d499b-17c6-eca9-1255-29ea55100b3d": "WSMH repeated schedule",
  "c1ede720-d1f9-dcb4-e56f-65bf46300e84": "Compact full contract",
  "493546-warren-for-senate-est-12911-10-26-12-10-28-12": "Rotated multi-page order",
  "0892f433-a82d-eae3-d2ae-e578edea8656": "Dense 31-row table",
  [NULL_TRAP_ID]: "Invoice with order and invoice IDs",
  "464180-senate-conservatives-action-request-form": "Advertising request sheet",
  "749e7f7f-371f-772d-62e9-2970b3883d56": "Negative credit memo",
  "c442b691-e6c8-7e9d-3970-a205dc05b56d": "Zero gross anomaly",
  "5691cccd-228d-fab4-6d9b-bbf8df92a94a": "Non-reconciling order",
  "782276fb-5d1c-af75-b44f-d75997a7b168": "OCR ambiguity scan",
  [LONG_STRESS_ID]: "Ten-page stress test",
};

const SLICE_NAMES: Record<string, string> = {
  demo: "complete form",
  baseline: "complete form",
  layout: "rotated layout",
  density: "dense layout",
  missing_fields: "field semantics",
  out_of_scope: "out-of-scope form",
  financial_edge: "financial edge",
  ocr_quality: "OCR ambiguity",
  long_document: "long document",
};

const FEATURED_SCENARIOS = [
  {
    id: BASELINE_ID,
    label: "Baseline",
    title: "Complete order",
    expectation: "Should bypass header review",
    tone: "accept",
  },
  {
    id: NULL_TRAP_ID,
    label: "Field semantics",
    title: "Invoice + order IDs",
    expectation: "Use Order #; keep gross null",
    tone: "review",
  },
  {
    id: LONG_STRESS_ID,
    label: "Long stress",
    title: "10-page order",
    expectation: "Tests row-shape guardrail",
    tone: "review",
  },
] as const;

type RunState = "idle" | "running" | "complete" | "error";
type ViewMode = "live" | "benchmark";
type TabName = "Extraction" | "Validation" | "Reference" | "Prompt" | "JSON";

type EvalAggregate = {
  model: string;
  documentsAttempted: number;
  documentsCompleted: number;
  schemaValidity: number;
  acceptanceRate: number;
  acceptedCriticalFieldAccuracy: number;
  perFieldPassRate: number;
  hallucinationRate: number;
  missingValueRate: number;
  lineItemPrecision: number;
  lineItemRecall: number;
  lineItemF1: number;
  lineItemDocumentsScored?: number;
  lineItemGoldRowsScored?: number;
  lineItemGoldRowsTotal?: number;
  matchedRowLeafAccuracy: number;
  criticalFieldsAllCorrectRate: number;
  latencyMs: { median: number; p95: number };
  tokens: { input: number; output: number; thought: number };
  estimatedCostUsd: number;
  estimatedCostPerAcceptedDocumentUsd: number;
  failedDocuments: string[];
  reviewSlices: Array<{ documentId: string; slice: string; reasons: string[] }>;
  acceptedSemanticFailures: Array<{ documentId: string; slice: string }>;
};

type EvalRun = {
  documentId: string;
  slice: string;
  difficulty: string;
  pages: number;
  expectedLineItems: number;
  status: string;
  route: "accept" | "review" | "failed";
  reasons: string[];
  missingCritical: string[];
  fieldPassRate: number | null;
  lineItemF1: number | null;
  lineItemMatches: number | null;
  goldLineItems: number;
  lineItemsScored: boolean;
  lineItemScoreExclusionReason: string | null;
  criticalFieldsAllCorrect: boolean;
  latencyMs: number | null;
  estimatedCostUsd: number | null;
};

type EvalReport = {
  generatedAt: string;
  disclaimer: string;
  aggregate: EvalAggregate;
  runs: EvalRun[];
};

type EvaluationPayload = {
  primary: EvalReport | null;
  challenger: EvalReport | null;
};

export default function Home() {
  const [view, setView] = useState<ViewMode>("live");
  const [documents, setDocuments] = useState<ManifestEntry[]>([]);
  const [summary, setSummary] = useState({
    documents: 0,
    pages: 0,
    lineItems: 0,
    scoreExclusions: 0,
  });
  const [sourcesAvailable, setSourcesAvailable] = useState<boolean | null>(null);
  const [pdfInputLabel, setPdfInputLabel] = useState("Detecting input mode");
  const [benchmarkPreviewMode, setBenchmarkPreviewMode] = useState<"page_images" | "inline_pdf">("page_images");
  const [maxPdfBytes, setMaxPdfBytes] = useState(50 * 1024 * 1024);
  const [evaluation, setEvaluation] = useState<EvaluationPayload>({ primary: null, challenger: null });
  const [evaluationState, setEvaluationState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedId, setSelectedId] = useState(BASELINE_ID);
  const [gold, setGold] = useState<Extraction | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [runState, setRunState] = useState<RunState>("idle");
  const [progressStep, setProgressStep] = useState(0);
  const [runResult, setRunResult] = useState<ExtractionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tab, setTab] = useState<TabName>("Extraction");
  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);
  const [allDocumentsOpen, setAllDocumentsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const HELP_STORAGE_KEY = "ad-order-review-help-seen-v3";

  const selected = documents.find((entry) => entry.document_id === selectedId) ?? null;
  const primary = evaluation.primary?.aggregate ?? null;
  const challenger = evaluation.challenger?.aggregate ?? null;
  const previewUrl = uploadedUrl ?? `/api/documents/${selectedId}/preview?page=${pageNumber}`;

  const comparison = useMemo<ComparisonResult | null>(() => {
    if (!runResult || !gold || uploadedFile) return null;
    return compareToGold(
      runResult.extraction,
      gold,
      selected?.score_excluded_fields ?? [],
      selected?.score_line_items !== false,
      selected?.line_item_score_exclusion_reason ?? null,
    );
  }, [runResult, gold, uploadedFile, selected]);

  useEffect(() => {
    fetch("/api/benchmark")
      .then((response) => {
        if (!response.ok) throw new Error("Benchmark manifest unavailable.");
        return response.json();
      })
      .then((benchmark) => {
        const available = Boolean(benchmark.sourcesAvailable);
        setDocuments(
          [...benchmark.documents].sort((left: ManifestEntry, right: ManifestEntry) => {
            if (left.document_id === BASELINE_ID) return -1;
            if (right.document_id === BASELINE_ID) return 1;
            return left.demo_rank - right.demo_rank;
          }),
        );
        setSummary(benchmark.summary);
        setSourcesAvailable(available);
        if (!available) setView("benchmark");
      })
      .catch(() => {
        setDocuments([]);
        setSourcesAvailable(false);
      });

    fetch("/api/health")
      .then((response) => response.json())
      .then((health) => {
        setKeyConfigured(Boolean(health.keyConfigured));
        setPdfInputLabel(health.pdfInput ?? "PDF document");
        if (health.benchmarkPreview === "inline_pdf") setBenchmarkPreviewMode("inline_pdf");
        if (Number.isFinite(health.maxPdfBytes)) setMaxPdfBytes(health.maxPdfBytes);
      })
      .catch(() => {
        setKeyConfigured(false);
        setPdfInputLabel("PDF document");
      });

    fetch("/api/evaluation")
      .then((response) => {
        if (!response.ok) throw new Error("Saved benchmark report unavailable.");
        return response.json();
      })
      .then((evalPayload: EvaluationPayload) => {
        if (!evalPayload.primary || !evalPayload.challenger) {
          throw new Error("Saved benchmark report is incomplete.");
        }
        setEvaluation(evalPayload);
        setEvaluationState("ready");
      })
      .catch(() => setEvaluationState("error"));
  }, []);

  useEffect(() => {
    if (uploadedFile || sourcesAvailable !== true) {
      setGold(null);
      return;
    }
    fetch(`/api/documents/${selectedId}/gold`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setGold)
      .catch(() => setGold(null));
  }, [selectedId, uploadedFile, sourcesAvailable]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      if (uploadedUrl) URL.revokeObjectURL(uploadedUrl);
    };
  }, [uploadedUrl]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSettingsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(HELP_STORAGE_KEY) !== "1") {
        setHelpOpen(true);
      }
    } catch {
      setHelpOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismissHelp();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [helpOpen]);

  function dismissHelp() {
    setHelpOpen(false);
    try {
      window.localStorage.setItem(HELP_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function resetRun() {
    clearTimers();
    setRunState("idle");
    setProgressStep(0);
    setRunResult(null);
    setError(null);
    setDetailsOpen(false);
    setTab("Extraction");
  }

  function chooseDocument(id: string) {
    if (uploadedUrl) URL.revokeObjectURL(uploadedUrl);
    setUploadedFile(null);
    setUploadedUrl(null);
    setSelectedId(id);
    setPageNumber(1);
    resetRun();
  }

  function uploadDocument(file?: File) {
    if (!file) return;
    if (file.size > maxPdfBytes) {
      setError(`PDF exceeds the ${Math.floor(maxPdfBytes / 1024 / 1024)} MB limit.`);
      setRunState("error");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF documents are supported.");
      setRunState("error");
      return;
    }
    if (uploadedUrl) URL.revokeObjectURL(uploadedUrl);
    setUploadedFile(file);
    setUploadedUrl(URL.createObjectURL(file));
    setPageNumber(1);
    resetRun();
  }

  async function runExtraction() {
    if (!uploadedFile && sourcesAvailable === false) {
      setError("Upload a PDF to run extraction in the hosted demo.");
      setRunState("error");
      return;
    }
    clearTimers();
    setRunState("running");
    setProgressStep(0);
    setRunResult(null);
    setError(null);
    setDetailsOpen(false);

    timersRef.current = [
      setTimeout(() => setProgressStep(1), 550),
      setTimeout(() => setProgressStep(2), 1550),
    ];

    const form = new FormData();
    form.set("model", model);
    if (uploadedFile) form.set("pdf", uploadedFile);
    else form.set("documentId", selectedId);

    try {
      const response = await fetch("/api/extract", { method: "POST", body: form });
      const payload = await readExtractionResponse(response);
      clearTimers();
      setProgressStep(3);
      const revealTimer = setTimeout(() => {
        setRunResult(payload as ExtractionResponse);
        setRunState("complete");
      }, 280);
      timersRef.current = [revealTimer];
    } catch (cause) {
      clearTimers();
      setError(cause instanceof Error ? cause.message : "Extraction failed.");
      setRunState("error");
    }
  }

  function openDetails(nextTab: TabName) {
    setTab(nextTab);
    setDetailsOpen(true);
  }


  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><FileSearch size={18} /></span>
          <span className="brand-copy">
            <strong>Ad Order Review Gate</strong>
            <small>Measured Gemini document automation</small>
          </span>
        </div>

        <nav className="mode-switch" aria-label="Application view">
          <button className={view === "live" ? "active" : ""} onClick={() => setView("live")}>
            <FileText size={14} /> Live document
          </button>
          <button className={view === "benchmark" ? "active" : ""} onClick={() => setView("benchmark")}>
            <BarChart3 size={14} /> Benchmark
          </button>
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className={`help-trigger ${keyConfigured === false ? "help-trigger-warn" : ""}`}
            onClick={() => setHelpOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={helpOpen}
          >
            {keyConfigured === false ? <AlertTriangle size={14} /> : <CircleHelp size={14} />}
            <span>{keyConfigured === false ? "API key missing · How this works" : "How this works"}</span>
          </button>
          <div className={`settings-menu ${settingsOpen ? "open" : ""}`} ref={settingsRef}>
            <button
              type="button"
              className="settings-trigger"
              aria-label="Run settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <Settings2 size={16} /><span>Run settings</span><ChevronDown size={13} />
            </button>
            {settingsOpen && (
              <div className="settings-popover">
                <div className="settings-heading">
                  <div><span>MODEL STRATEGY</span><strong>Quality-first default</strong></div>
                  <Gauge size={18} />
                </div>
                <label>
                  Model
                  <select value={model} onChange={(event) => { setModel(event.target.value); resetRun(); }}>
                    {MODEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label} · {option.role}</option>
                    ))}
                  </select>
                </label>
                <SettingRow label="API" value="Interactions" />
                <SettingRow label="Media" value={pdfInputLabel} />
                <SettingRow label="Thinking" value={model === "gemini-3.1-pro-preview" ? "Low" : "Minimal"} />
                <SettingRow label="Storage" value="store=false" />
                <details className="settings-prompt">
                  <summary><Braces size={13} /><span>View extraction prompt</span><ChevronDown size={12} /></summary>
                  <pre>{EXTRACTION_REQUEST_PROMPT}</pre>
                </details>
                <p>3.5 Flash is the measured primary. Flash-Lite remains a visible cost challenger.</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {view === "live" ? (
        <main className="live-workspace view-enter">
          <aside className="scenario-rail">
            <div className="rail-heading">
              <span className="eyebrow">{sourcesAvailable === false ? "LIVE DOCUMENT" : "CHOOSE A PROOF"}</span>
              <h1>{sourcesAvailable === false ? "Live extraction" : "Demo scenarios"}</h1>
              <p>{sourcesAvailable === false ? "Upload a PDF to run the same extraction and review gate." : "Start clean, then test whether the gate catches risk."}</p>
            </div>

            {sourcesAvailable === false ? (
              <div className="hosted-source-note">
                <LockKeyhole size={16} />
                <span><strong>Benchmark sources stay local</strong><small>Upload a PDF using the hosted inline-PDF fallback. Saved benchmark results stay on the measured local path.</small></span>
              </div>
            ) : (
              <div className="scenario-list">
                {FEATURED_SCENARIOS.map((scenario) => {
                const metadata = documents.find((entry) => entry.document_id === scenario.id);
                const active = !uploadedFile && selectedId === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    className={`scenario-button ${active ? "active" : ""}`}
                    onClick={() => chooseDocument(scenario.id)}
                  >
                    <span className={`scenario-signal ${scenario.tone}`} aria-hidden="true" />
                    <span className="scenario-copy">
                      <small>{scenario.label}</small>
                      <strong>{scenario.title}</strong>
                      <span>{scenario.expectation}</span>
                    </span>
                    {metadata?.page_count != null && <span className="scenario-pages">{metadata.page_count}p</span>}
                  </button>
                );
                })}
              </div>
            )}

            <button className="upload-button" onClick={() => inputRef.current?.click()}>
              <Upload size={15} />
              <span>{uploadedFile ? uploadedFile.name : "Upload partner PDF"}</span>
            </button>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => uploadDocument(event.target.files?.[0])}
            />

            {sourcesAvailable !== false && <section className={`all-documents ${allDocumentsOpen ? "open" : ""}`}>
              <button className="document-list-toggle" aria-expanded={allDocumentsOpen} onClick={() => setAllDocumentsOpen((open) => !open)}>
                <Layers3 size={14} /><span>All benchmark documents</span><span>{summary.documents}</span><ChevronDown size={13} />
              </button>
              {allDocumentsOpen && (
                <div className="document-list">
                  {documents.map((entry, index) => (
                    <button
                      key={entry.document_id}
                      className={!uploadedFile && selectedId === entry.document_id ? "active" : ""}
                      onClick={() => chooseDocument(entry.document_id)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span><strong>{TITLES[entry.document_id] ?? entry.filename}</strong><small>{SLICE_NAMES[entry.slice] ?? entry.slice} · {entry.page_count}p</small></span>
                    </button>
                  ))}
                </div>
              )}
            </section>}

            <div className="rail-evidence">
              <Database size={15} />
              <span><strong>{summary.documents} docs · {summary.pages} pages · {summary.lineItems} spots</strong>{summary.scoreExclusions} ambiguous reference fields excluded</span>
            </div>
          </aside>

          <DocumentPanel
            uploadedFile={uploadedFile}
            previewUrl={previewUrl}
            selected={selected}
            selectedId={selectedId}
            pageNumber={pageNumber}
            sourcesAvailable={sourcesAvailable === true}
            mediaLabel={pdfInputLabel}
            benchmarkPreviewMode={benchmarkPreviewMode}
            onPageChange={setPageNumber}
            onReset={resetRun}
            onUpload={() => inputRef.current?.click()}
          />

          <aside className="decision-panel">
            {runState === "idle" && (
              <PreRunDecision
                keyConfigured={keyConfigured}
                model={model}
                onRun={runExtraction}
                hasGold={!uploadedFile && sourcesAvailable === true}
                canRun={Boolean(uploadedFile || sourcesAvailable === true)}
                mediaLabel={pdfInputLabel}
              />
            )}
            {runState === "running" && <RunningDecision progressStep={progressStep} />}
            {runState === "error" && (
              <ErrorDecision message={error ?? "Extraction failed."} onRetry={runExtraction} onReset={resetRun} />
            )}
            {runState === "complete" && runResult && (
              <CompletedDecision
                result={runResult}
                comparison={comparison}
                hasGold={Boolean(gold)}
                primary={primary}
                benchmarkGeneratedAt={evaluation.primary?.generatedAt ?? null}
                selectedId={selectedId}
                model={model}
                detailsOpen={detailsOpen}
                tab={tab}
                onOpenDetails={openDetails}
                onCloseDetails={() => setDetailsOpen(false)}
                onTabChange={setTab}
                onRunAgain={runExtraction}
                onStressTest={() => chooseDocument(NULL_TRAP_ID)}
              />
            )}
          </aside>
        </main>
      ) : primary && challenger && evaluation.primary ? (
        <BenchmarkView
          primary={primary}
          challenger={challenger}
          runs={evaluation.primary?.runs ?? []}
          generatedAt={evaluation.primary.generatedAt}
          acceptedCount={Math.round(primary.documentsCompleted * primary.acceptanceRate)}
          reviewCount={primary.documentsCompleted - Math.round(primary.documentsCompleted * primary.acceptanceRate)}
          summary={summary}
          sourcesAvailable={sourcesAvailable === true}
          onOpenLive={(id) => { chooseDocument(id); setView("live"); }}
        />
      ) : (
        <BenchmarkUnavailable state={evaluationState} />
      )}

      {helpOpen && (
        <HelpModal
          keyConfigured={keyConfigured}
          onClose={dismissHelp}
        />
      )}
    </div>
  );
}

function HelpModal({
  keyConfigured,
  onClose,
}: {
  keyConfigured: boolean | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = () =>
      [...dialog.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
        .filter((element) => !element.hasAttribute("disabled"));

    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="help-overlay" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="help-modal-header">
          <div>
            <span className="eyebrow">QUICK GUIDE</span>
            <h2 id="help-modal-title">How this app works</h2>
          </div>
          <button type="button" className="help-close" onClick={onClose} aria-label="Close guide">
            <X size={16} />
          </button>
        </div>

        <div className="help-modal-body">
          <section>
            <h3>What you are looking at</h3>
            <p>
              Gemini extracts fields from an ad-buy PDF. Deterministic code then decides whether
              headers can <strong>auto-accept</strong> or must go to <strong>partner review</strong>.
              Extraction quality and partner routing are separate judgments.
            </p>
          </section>

          <section>
            <h3>Two views</h3>
            <ul>
              <li><strong>Live document</strong> — pick a scenario (or upload a PDF), run extraction, inspect the decision.</li>
              <li><strong>Benchmark</strong> — saved results across the 12-document VRDU pack: quality, cost, latency.</li>
            </ul>
          </section>

          <section>
            <h3>Reading a result</h3>
            <ul>
              <li><strong>Partner route</strong> — AUTO-ACCEPT only if required headers are present: advertiser, order/contract ID, flight dates, gross amount. Missing in the source means review, not a model error.</li>
              <li><strong>Headers</strong> — document-level fields (station, advertiser, amounts, dates).</li>
              <li><strong>Spots</strong> — individual ad placements on the order schedule (channel, program, dates, amount). Posting them stays manual in this version.</li>
              <li><strong>Reference labels</strong> — VRDU ground truth used only to score extraction (also called gold). They never change the partner route.</li>
            </ul>
          </section>

          <section>
            <h3>Spot scores (the confusing bit)</h3>
            <ul>
              <li><strong>Fully matched spots</strong> — every field on that spot agrees with the reference (channel, program, both dates, and amount). One mismatch → that spot fails this score.</li>
              <li><strong>Spot fields correct</strong> — after pairing similar spots, how many individual fields still match. Use this when fully matched looks harsh.</li>
              <li><strong>Advertiser / order ID / gross</strong> — a narrow reference check, not the partner route and not a whole-document grade. Route still requires flight dates too.</li>
            </ul>
          </section>

          <section>
            <h3>Suggested demo path</h3>
            <ol>
              <li>Run <strong>Complete order</strong> — should auto-accept.</li>
              <li>Run <strong>Invoice + order IDs</strong> — correct extraction, but review because gross is absent in source.</li>
              <li>Open <strong>Benchmark</strong> for the measured pack.</li>
            </ol>
          </section>

          {keyConfigured === false && (
            <p className="help-api-warn">
              <AlertTriangle size={14} /> Gemini API key is missing. Add <code>GEMINI_API_KEY</code> to <code>.env.local</code> to run live extraction.
            </p>
          )}
        </div>

        <div className="help-modal-footer">
          <button type="button" className="primary-action" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentPanel({
  uploadedFile,
  previewUrl,
  selected,
  selectedId,
  pageNumber,
  sourcesAvailable,
  mediaLabel,
  benchmarkPreviewMode,
  onPageChange,
  onReset,
  onUpload,
}: {
  uploadedFile: File | null;
  previewUrl: string;
  selected: ManifestEntry | null;
  selectedId: string;
  pageNumber: number;
  sourcesAvailable: boolean;
  mediaLabel: string;
  benchmarkPreviewMode: "page_images" | "inline_pdf";
  onPageChange: React.Dispatch<React.SetStateAction<number>>;
  onReset: () => void;
  onUpload: () => void;
}) {
  const pageCount = selected?.page_count ?? 1;
  const hostedEmpty = !uploadedFile && !sourcesAvailable;
  const embeddedPdf = Boolean(uploadedFile) || (!hostedEmpty && benchmarkPreviewMode === "inline_pdf");
  return (
    <section className="document-panel">
      <div className="document-toolbar">
        <div className="document-heading">
          <span className="eyebrow">{uploadedFile ? "PARTNER DOCUMENT" : hostedEmpty ? "HOSTED DEMO" : (SLICE_NAMES[selected?.slice ?? ""] ?? "BENCHMARK DOCUMENT").toUpperCase()}</span>
          <h2>{uploadedFile ? uploadedFile.name : hostedEmpty ? "Upload a partner PDF" : TITLES[selectedId] ?? "Loading document"}</h2>
          <p title={uploadedFile ? "Transient upload · no reference label" : hostedEmpty ? "Source benchmark documents are intentionally not deployed." : selected?.include_reason ?? "Loading benchmark metadata"}>
            {uploadedFile ? "Transient upload · no reference label" : hostedEmpty ? "Source benchmark documents are intentionally not deployed." : selected?.include_reason ?? "Loading benchmark metadata"}
          </p>
        </div>
        <div className="icon-actions">
          {!uploadedFile && sourcesAvailable && <a href={`/api/documents/${selectedId}/pdf`} target="_blank" rel="noreferrer" title="Open source PDF"><ExternalLink size={15} /></a>}
          <button onClick={onReset} title="Reset run"><RotateCcw size={15} /></button>
        </div>
      </div>

      <div className={`pdf-stage ${embeddedPdf ? "pdf-stage-embed" : ""}`}>
        {uploadedFile ? (
          <iframe title="Uploaded PDF document preview" src={previewUrl} />
        ) : hostedEmpty ? (
          <div className="hosted-upload-empty">
            <span><Upload size={22} /></span>
            <h3>Run your own document</h3>
            <p>The PDF stays transient.</p>
            <button onClick={onUpload}><Upload size={15} /> Choose PDF</button>
          </div>
        ) : benchmarkPreviewMode === "inline_pdf" ? (
          <iframe title={`PDF preview of ${TITLES[selectedId] ?? "benchmark document"}`} src={`/api/documents/${selectedId}/pdf#page=${pageNumber}`} />
        ) : (
          <>
            <div className="preview-toolbar">
              <button aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => onPageChange((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
              <strong>{pageNumber} / {pageCount}</strong>
              <button aria-label="Next page" disabled={pageNumber >= pageCount} onClick={() => onPageChange((current) => Math.min(pageCount, current + 1))}><ChevronRight size={15} /></button>
            </div>
            <div className="preview-canvas">
              <img src={previewUrl} alt={`Page ${pageNumber} of ${TITLES[selectedId] ?? "benchmark document"}`} />
            </div>
          </>
        )}
      </div>

      <div className="document-footer">
        <span><FileText size={13} />{uploadedFile ? "Uploaded PDF" : hostedEmpty ? "Bring your own PDF" : `${pageCount} page${pageCount === 1 ? "" : "s"}`}</span>
        <span>{uploadedFile || hostedEmpty ? "No benchmark comparison" : `${selected?.line_item_count ?? 0} annotated spot${selected?.line_item_count === 1 ? "" : "s"}`}</span>
        <span>{uploadedFile ? mediaLabel : hostedEmpty ? "Source files not deployed" : benchmarkPreviewMode === "inline_pdf" ? "Browser PDF preview" : "High-resolution page images"}</span>
      </div>
    </section>
  );
}

function PreRunDecision({
  keyConfigured,
  model,
  onRun,
  hasGold,
  canRun,
  mediaLabel,
}: {
  keyConfigured: boolean | null;
  model: string;
  onRun: () => void;
  hasGold: boolean;
  canRun: boolean;
  mediaLabel: string;
}) {
  return (
    <div className="decision-state pre-run-state">
      <div className="decision-kicker"><span>PARTNER WORKFLOW</span><FileSearch size={18} /></div>
      <h2>Will this clear the partner review rule?</h2>

      <button className="primary-action" disabled={keyConfigured === false || !canRun} onClick={onRun}>
        <Play size={16} fill="currentColor" /> {canRun ? "Run decision" : "Upload a PDF to run"}
        <ArrowRight size={15} />
      </button>
      <div className="run-model"><Zap size={13} /><span>{modelLabel(model)}</span><small>{mediaLabel.toLowerCase()}</small></div>

      <div className="gate-preview">
        <div className="section-heading"><span>EXAMPLE PARTNER POLICY</span><small>deterministic</small></div>
        <div className="policy-contract">
          <span>REQUIRED TO AUTO-ACCEPT</span>
          <strong>Advertiser · order / contract ID · flight dates · gross amount</strong>
        </div>
        <GateRule icon={<Braces size={15} />} label="Valid schema" />
        <GateRule icon={<Clock3 size={15} />} label="Dates ordered and amount parseable" />
        <GateRule icon={<TableProperties size={15} />} label="Spot posting stays manual" />
      </div>

      <div className="pre-run-evidence">
        <ShieldCheck size={16} />
        <div>
          <strong>{hasGold ? "Reference labels score extraction after the run" : canRun ? "No benchmark label for this upload" : "Upload a PDF to begin"}</strong>
          <span>{hasGold ? "The partner policy determines routing independently." : canRun ? "The deterministic partner gate still runs without reference labels." : "Saved VRDU results remain available in Benchmark."}</span>
        </div>
      </div>
    </div>
  );
}

function RunningDecision({ progressStep }: { progressStep: number }) {
  const steps = [
    { label: "Render", detail: "PDF to high-resolution pages" },
    { label: "Extract", detail: "Schema-constrained Gemini output" },
    { label: "Validate", detail: "Dates, money, nulls, row shape" },
    { label: "Route", detail: "Apply partner policy" },
  ];
  return (
    <div className="decision-state running-state">
      <div className="decision-kicker"><span>LIVE PIPELINE</span><Activity className="spin" size={18} /></div>
      <h2>Testing the review gate</h2>
      <p>The model extracts. Deterministic code validates and routes.</p>
      <div className="progress-list">
        {steps.map((step, index) => {
          const state = index < progressStep ? "complete" : index === progressStep ? "current" : "pending";
          return (
            <div className={`progress-row ${state}`} key={step.label}>
              <span className="progress-icon">{state === "complete" ? <Check size={14} /> : state === "current" ? <Activity size={14} /> : index + 1}</span>
              <span><strong>{step.label}</strong><small>{step.detail}</small></span>
            </div>
          );
        })}
      </div>
      <div className="running-note"><LockKeyhole size={14} />Request data is not stored by the API.</div>
    </div>
  );
}

function ErrorDecision({ message, onRetry, onReset }: { message: string; onRetry: () => void; onReset: () => void }) {
  return (
    <div className="decision-state error-state">
      <div className="error-icon"><XCircle size={24} /></div>
      <span className="eyebrow">RUN FAILED</span>
      <h2>The gate did not produce a decision</h2>
      <p>{message}</p>
      <div className="error-actions">
        <button className="primary-action" onClick={onRetry}><RotateCcw size={15} /> Retry run</button>
        <button className="secondary-action" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}

function CompletedDecision({
  result,
  comparison,
  hasGold,
  primary,
  benchmarkGeneratedAt,
  selectedId,
  model,
  detailsOpen,
  tab,
  onOpenDetails,
  onCloseDetails,
  onTabChange,
  onRunAgain,
  onStressTest,
}: {
  result: ExtractionResponse;
  comparison: ComparisonResult | null;
  hasGold: boolean;
  primary: EvalAggregate | null;
  benchmarkGeneratedAt: string | null;
  selectedId: string;
  model: string;
  detailsOpen: boolean;
  tab: TabName;
  onOpenDetails: (tab: TabName) => void;
  onCloseDetails: () => void;
  onTabChange: (tab: TabName) => void;
  onRunAgain: () => void;
  onStressTest: () => void;
}) {
  const accepted = result.validation.route === "accept";
  const acceptedCount = primary
    ? Math.round(primary.documentsCompleted * primary.acceptanceRate)
    : null;
  const inspectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!detailsOpen) return;
    requestAnimationFrame(() => {
      inspectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [detailsOpen]);

  return (
    <div className="decision-state completed-state result-reveal">
      <div className="outcome-heading">
        <div><span className="eyebrow">LIVE API RESULT · PARTNER POLICY</span><h2>{accepted ? "Partner policy cleared" : "Partner policy sends this to review"}</h2></div>
        <span className={`route-status ${accepted ? "accept" : "review"}`}>{accepted ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}{accepted ? "AUTO-ACCEPT" : "REVIEW"}</span>
      </div>

      <div className="decision-banner">
        <section className={`decision-lane ${accepted ? "accept" : "review"}`}>
          <span>PARTNER ROUTE</span>
          <strong>{accepted ? "AUTO-ACCEPT" : "SEND TO REVIEW"}</strong>
          <small>{accepted ? "All required partner fields are present." : routeReason(result.validation)}</small>
          {!accepted && !result.validation.rowShapeValid && (
            <small className="decision-footnote">Some spots are incomplete. That is advisory and did not affect this route.</small>
          )}
        </section>
      </div>

      <div className="run-telemetry">
        <TelemetryItem icon={<Clock3 size={14} />} label="LATENCY" value={`${(result.telemetry.latencyMs / 1000).toFixed(1)}s`} />
        <TelemetryItem icon={<Braces size={14} />} label="TOKENS" value={(result.telemetry.inputTokens + result.telemetry.outputTokens + result.telemetry.thoughtTokens).toLocaleString()} />
        <TelemetryItem icon={<CircleDollarSign size={14} />} label="EST. COST" value={formatCost(result.telemetry.estimatedCostUsd)} />
      </div>

      <section className="evidence-section">
        <div className="section-heading"><span>EXTRACTION QUALITY</span><small>{hasGold ? "API output vs reference labels" : "no reference label"}</small></div>
        {comparison ? (
          <div className="evidence-metrics">
            <EvidenceMetric
              label="Advertiser · order ID · gross"
              value={comparison.criticalFieldsAllCorrect ? "Match reference" : "Differ from reference"}
              tone={comparison.criticalFieldsAllCorrect ? "good" : "bad"}
            />
            <EvidenceMetric label="Header fields correct" value={percent(comparison.fieldPassRate)} />
            <EvidenceMetric label="Spot fields correct" value={alignedFieldMetric(comparison)} />
          </div>
        ) : (
          <div className="no-gold-evidence"><Database size={16} /><span><strong>No reference label for this document.</strong>Extraction cannot be scored; the partner route still uses policy checks.</span></div>
        )}
        <p className="evidence-note">
          {runEvidenceNote(result.validation, comparison, primary, acceptedCount, benchmarkGeneratedAt)}
        </p>
      </section>

      <section className="checks-section">
        <div className="section-heading"><span>PARTNER POLICY CHECKS</span></div>
        <ValidationChecks validation={result.validation} compact />
      </section>

      <div className="result-actions">
        <button className="secondary-action" onClick={() => onOpenDetails("Extraction")}><FileSearch size={14} />Inspect extraction</button>
        {hasGold && <button className="secondary-action" onClick={() => onOpenDetails("Reference")}><Gauge size={14} />Compare with reference</button>}
        <button className="secondary-action prompt-action" onClick={() => onOpenDetails("Prompt")}><Braces size={14} />View prompt</button>
        <button className="icon-button" title="Run again" onClick={onRunAgain}><RotateCcw size={15} /></button>
      </div>

      {selectedId === BASELINE_ID && (
        <button className="stress-action" onClick={onStressTest}>
          <span><strong>Stress test the field contract</strong><small>Use Order # without substituting Net Total</small></span><ArrowRight size={16} />
        </button>
      )}

      {detailsOpen && (
        <section className="inspection-panel" ref={inspectionRef}>
          <div className="inspection-header">
            <div><span className="eyebrow">RUN EVIDENCE</span><strong>{modelLabel(model)}</strong></div>
            <button onClick={onCloseDetails} aria-label="Close run evidence"><XCircle size={16} /></button>
          </div>
          <div className="tabs" role="tablist">
            {(["Extraction", "Validation", "Reference", "Prompt", "JSON"] as TabName[]).map((name) => (
              <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? "active" : ""} onClick={() => onTabChange(name)}>{name}</button>
            ))}
          </div>
          <div className="inspection-content">
            {tab === "Extraction" && <ExtractionView extraction={result.extraction} />}
            {tab === "Validation" && <ValidationView validation={result.validation} />}
            {tab === "Reference" && <GoldView comparison={comparison} hasGold={hasGold} />}
            {tab === "Prompt" && <PromptView result={result} />}
            {tab === "JSON" && <JsonView extraction={result.extraction} />}
          </div>
        </section>
      )}
    </div>
  );
}

function BenchmarkUnavailable({ state }: { state: "loading" | "ready" | "error" }) {
  return (
    <main className="benchmark-unavailable view-enter">
      <div className="benchmark-unavailable-icon">{state === "loading" ? <Activity className="spin" size={20} /> : <AlertTriangle size={20} />}</div>
      <span className="eyebrow">SAVED BENCHMARK REPORT</span>
      <h1>{state === "loading" ? "Loading measured evidence" : "Benchmark evidence unavailable"}</h1>
      <p>{state === "loading" ? "Reading the persisted evaluation reports." : "No embedded metrics are substituted. Restore the evaluation JSON files or rerun the benchmark."}</p>
    </main>
  );
}

function BenchmarkView({
  primary,
  challenger,
  runs,
  generatedAt,
  acceptedCount,
  reviewCount,
  summary,
  sourcesAvailable,
  onOpenLive,
}: {
  primary: EvalAggregate;
  challenger: EvalAggregate;
  runs: EvalRun[];
  generatedAt: string;
  acceptedCount: number;
  reviewCount: number;
  summary: { documents: number; pages: number; lineItems: number; scoreExclusions: number };
  sourcesAvailable: boolean;
  onOpenLive: (id: string) => void;
}) {
  const acceptedCriticalCount = Math.round(
    acceptedCount * primary.acceptedCriticalFieldAccuracy,
  );
  const challengerFailureCount = challenger.acceptedSemanticFailures.length;
  const costRatio =
    challenger.estimatedCostPerAcceptedDocumentUsd > 0
      ? primary.estimatedCostPerAcceptedDocumentUsd / challenger.estimatedCostPerAcceptedDocumentUsd
      : null;
  const runsById = new Map(runs.map((run) => [run.documentId, run]));
  return (
    <main className="benchmark-view view-enter">
      <section className="benchmark-intro">
        <div>
          <span className="eyebrow">SAVED EVALUATION</span>
          <h1>Benchmark results</h1>
        </div>
        <div className="dataset-stamp"><Database size={17} /><span><strong>Gemini 3.5 Flash</strong>{summary.documents} docs · {summary.pages} pages · {summary.lineItems} spots · {formatReportDate(generatedAt)}</span><small>SAVED · Poppler 180 DPI</small></div>
      </section>

      <section className="headline-metrics" aria-label="Primary benchmark results">
        <HeadlineMetric value={`${acceptedCount}/${primary.documentsCompleted}`} label="bypass partner review" detail={`${reviewCount} sent to review · ${percent(primary.acceptanceRate)} auto-accept`} />
        <HeadlineMetric value={percent(primary.acceptedCriticalFieldAccuracy)} label="accepted key fields correct" detail={`${acceptedCriticalCount}/${acceptedCount} docs · advertiser, order ID, gross`} tone="good" />
        <HeadlineMetric value={percent(primary.hallucinationRate)} label="hallucinated values" detail="model value where reference is null" />
        <HeadlineMetric value={formatCost(primary.estimatedCostPerAcceptedDocumentUsd)} label="cost per accepted doc" detail={`${formatCost(primary.estimatedCostUsd)} total run`} />
      </section>

      <section className="policy-section">
        <div className="policy-copy">
          <span className="eyebrow">EXAMPLE PARTNER POLICY</span>
          <h2>Auto-accept complete headers. Keep spot posting manual.</h2>
          <p><strong>Required:</strong> advertiser · order / contract ID · flight dates · gross amount<br /><span>Absent in source means review, not extraction error.</span></p>
        </div>
        <div className="policy-rails">
          <div className="policy-rail good"><span>ACCEPTED QUALITY</span><strong>{percent(primary.acceptedCriticalFieldAccuracy)}</strong><small>advertiser · order ID · gross</small></div>
          <div className="policy-rail caution"><span>REFERENCE SPOTS MATCHED</span><strong>{percent(primary.lineItemRecall)}</strong><small>{primary.lineItemGoldRowsScored ?? summary.lineItems}/{primary.lineItemGoldRowsTotal ?? summary.lineItems} reference spots scored · {percent(primary.matchedRowLeafAccuracy)} fields correct</small></div>
        </div>
      </section>

      <section className="benchmark-section model-section">
        <div className="benchmark-section-heading">
          <div>
            <span className="eyebrow">MODEL COMPARISON</span>
            <h2>Flash vs Flash-Lite</h2>
            <p className="model-finding">
              Flash-Lite is cheaper but had {challengerFailureCount} accepted failure{challengerFailureCount === 1 ? "" : "s"}
              {costRatio !== null ? ` · Flash costs ~${costRatio.toFixed(1)}× per accepted doc` : ""}.
            </p>
          </div>
        </div>
        <div className="model-table" role="table" aria-label="Model benchmark comparison">
          <div className="model-table-row model-table-head" role="row">
            <span>ROLE</span><span>MODEL</span><span>ACCEPTED KEY FIELDS</span><span>COST / ACCEPTED</span><span>MEDIAN</span><span>DECISION</span>
          </div>
          <ModelRow role="Primary" model="Gemini 3.5 Flash" quality={primary.acceptedCriticalFieldAccuracy} cost={primary.estimatedCostPerAcceptedDocumentUsd} latency={primary.latencyMs.median} decision="Use" recommended />
          <ModelRow role="Challenger" model="Gemini 3.1 Flash-Lite" quality={challenger.acceptedCriticalFieldAccuracy} cost={challenger.estimatedCostPerAcceptedDocumentUsd} latency={challenger.latencyMs.median} decision={`${challengerFailureCount} accepted failure${challengerFailureCount === 1 ? "" : "s"}`} />
        </div>
      </section>

      <section className="benchmark-grid">
        <div className="benchmark-section review-section">
          <div className="benchmark-section-heading compact"><div><span className="eyebrow">PARTNER REVIEW QUEUE</span><h2>{reviewCount} documents</h2></div></div>
          <div className="review-slice-list">
            {primary.reviewSlices.map((slice) => (
              <button key={slice.documentId} disabled={!sourcesAvailable} title={sourcesAvailable ? "Open live document" : "Source document is not included in the hosted demo"} onClick={() => onOpenLive(slice.documentId)}>
                <span className="review-icon"><AlertTriangle size={14} /></span>
                <span><strong>{SLICE_NAMES[slice.slice] ?? slice.slice}</strong><small>{TITLES[slice.documentId] ?? slice.documentId}</small></span>
                <span>{evaluationRunReason(runsById.get(slice.documentId), slice.reasons)}</span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </div>

        <div className="benchmark-section reliability-section">
          <div className="benchmark-section-heading compact"><div><span className="eyebrow">DIAGNOSTICS</span><h2>Quality and latency</h2></div></div>
          <div className="reliability-list">
            <ReliabilityRow label="Schema-valid responses" value={percent(primary.schemaValidity)} />
            <ReliabilityRow label="Header field pass" value={percent(primary.perFieldPassRate)} note={`${summary.scoreExclusions} ambiguous labels excluded`} />
            <ReliabilityRow label="Model value / reference null" value={percent(primary.hallucinationRate)} />
            <ReliabilityRow label="Spot scoring coverage" value={`${primary.lineItemGoldRowsScored ?? summary.lineItems}/${primary.lineItemGoldRowsTotal ?? summary.lineItems}`} />
            <ReliabilityRow label="Latency p50 / p95" value={`${(primary.latencyMs.median / 1000).toFixed(1)}s / ${(primary.latencyMs.p95 / 1000).toFixed(1)}s`} />
          </div>
        </div>
      </section>

      <section className="benchmark-section run-section">
        <div className="benchmark-section-heading">
          <div><span className="eyebrow">RUNS</span><h2>Document results</h2></div>
        </div>
        <div className="run-table">
          <div className="run-table-row run-table-head"><span>DOCUMENT</span><span>SLICE</span><span>PARTNER ROUTE</span><span>FIELD PASS</span><span title="Fully matched spots / reference spots. A spot fully matches only when channel, program, both dates, and amount all agree.">SPOTS MATCHED</span><span>LATENCY</span><span>COST</span></div>
          {runs.map((run) => (
            <button className="run-table-row" key={run.documentId} disabled={!sourcesAvailable} title={sourcesAvailable ? "Open live document" : "Source document is not included in the hosted demo"} onClick={() => onOpenLive(run.documentId)}>
              <span><strong>{TITLES[run.documentId] ?? run.documentId}</strong><small>{run.pages}p · {run.expectedLineItems} spots</small></span>
              <span>{SLICE_NAMES[run.slice] ?? run.slice}</span>
              <span className={`table-route ${run.route}`}>{run.route}</span>
              <span>{run.fieldPassRate === null ? "–" : percent(run.fieldPassRate)}</span>
              <span
                className={!run.lineItemsScored || run.lineItemMatches === null ? undefined : run.lineItemMatches === 0 && run.goldLineItems > 0 ? "row-match-zero" : undefined}
                title={!run.lineItemsScored ? (run.lineItemScoreExclusionReason ?? "Spot score excluded") : "Fully matched spots / reference spots"}
              >
                {!run.lineItemsScored ? "excluded" : run.lineItemMatches === null ? "–" : `${run.lineItemMatches}/${run.goldLineItems}`}
              </span>
              <span>{run.latencyMs === null ? "–" : `${(run.latencyMs / 1000).toFixed(1)}s`}</span>
              <span>{run.estimatedCostUsd === null ? "–" : formatCost(run.estimatedCostUsd)}</span>
            </button>
          ))}
          {!runs.length && <div className="run-table-empty">Saved document-level runs are unavailable.</div>}
        </div>
      </section>

    </main>
  );
}

function ExtractionView({ extraction }: { extraction: Extraction }) {
  return (
    <div className="extraction-view">
      <div className="section-label"><span>DOCUMENT FIELDS</span><span>{HEADER_FIELDS.filter((field) => extraction.document[field] !== null).length}/9 present</span></div>
      <div className="field-table">
        {HEADER_FIELDS.map((field) => (
          <div className="field-row" key={field}><span>{fieldLabel(field)}</span><strong className={extraction.document[field] === null ? "null-value" : ""}>{extraction.document[field] ?? "null"}</strong></div>
        ))}
      </div>
      <div className="section-label"><span>SPOTS</span><span>{extraction.line_items.length} on schedule</span></div>
      {extraction.line_items.length ? (
        <div className="line-items">
          {extraction.line_items.slice(0, 16).map((row, index) => (
            <div className="line-row" key={`${row.program_desc}-${index}`}>
              <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="line-description"><strong>{row.program_desc ?? "null"}</strong><small>{row.channel ?? "no channel"} · {row.program_start_date ?? "null"} to {row.program_end_date ?? "null"}</small></span>
              <strong>{row.sub_amount ?? "null"}</strong>
            </div>
          ))}
          {extraction.line_items.length > 16 && <div className="more-rows">+ {extraction.line_items.length - 16} more spots</div>}
        </div>
      ) : <div className="empty-state">No spots in model output.</div>}
    </div>
  );
}

function ValidationView({ validation }: { validation: ValidationResult }) {
  return (
    <div className="validation-view">
      <div className={`route-decision ${validation.route}`}><span>{validation.route === "accept" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}</span><div><small>PARTNER ROUTE</small><strong>{validation.route === "accept" ? "Auto-accept" : "Send to review"}</strong></div></div>
      <ValidationChecks validation={validation} />
      <div className="advisory-note"><AlertTriangle size={14} /><span>Amount check is informational. Spots sum to gross in only 219 of 271 eligible VRDU documents, so this check does not affect the partner route.</span></div>
    </div>
  );
}

function PromptView({ result }: { result: ExtractionResponse }) {
  return (
    <div className="prompt-view">
      <div className="prompt-provenance">
        <div><span>PROMPT HASH</span><strong>{result.telemetry.promptHash}</strong></div>
        <div><span>SCHEMA HASH</span><strong>{result.telemetry.schemaHash}</strong></div>
        <div><span>SETTINGS HASH</span><strong>{result.telemetry.settingsHash}</strong></div>
      </div>
      <div className="prompt-note"><Braces size={15} /><span><strong>Extraction instruction</strong>This is sent with the PDF pages. The JSON schema is configured separately.</span></div>
      <pre>{EXTRACTION_REQUEST_PROMPT}</pre>
    </div>
  );
}

function ValidationChecks({ validation, compact = false }: { validation: ValidationResult; compact?: boolean }) {
  return (
    <div className={compact ? "validation-checks compact" : "validation-checks"}>
      <CheckRow label="Required partner fields" value={validation.missingCritical.length ? `${capitalize(formatFieldList(validation.missingCritical))} absent` : "all 5 present"} ok={validation.missingCritical.length === 0} wide />
      <CheckRow label="JSON schema" value={validation.schemaValid ? "valid" : "invalid"} ok={validation.schemaValid} />
      <CheckRow label="Dates and money" value={validation.dateOrderOk && validation.grossAmountParseable ? "valid" : "needs review"} ok={validation.dateOrderOk && validation.grossAmountParseable} />
      <CheckRow label="Spot structure" value={validation.rowShapeValid ? "complete" : "incomplete spots"} ok={validation.rowShapeValid} advisory />
      {!compact && <CheckRow label="Arithmetic reconciliation" value={validation.reconciliation.replace("_", " ")} ok={validation.reconciliation !== "mismatch"} advisory />}
    </div>
  );
}

function GoldView({ comparison, hasGold }: { comparison: ComparisonResult | null; hasGold: boolean }) {
  if (!comparison) {
    return <div className="gold-empty"><Gauge size={26} /><strong>{hasGold ? "Reference comparison unavailable" : "No reference label"}</strong><span>Uploaded partner documents are routed without benchmark labels.</span></div>;
  }

  const headerPasses = comparison.fieldRows.filter((row) => !row.excluded && row.passed).length;
  const hallucinatedCount = comparison.fieldRows.filter((row) => !row.excluded && row.expected === null && row.actual !== null).length;
  const missedCount = comparison.fieldRows.filter((row) => !row.excluded && row.expected !== null && row.actual === null).length;
  const scored = comparison.scoredHeaderFields;

  return (
    <div className="gold-view">
      <div className={`gold-verdict ${comparison.criticalFieldsAllCorrect ? "pass" : "fail"}`}>
        <span>Advertiser, order ID, and gross match reference</span>
        <strong>{comparison.criticalFieldsAllCorrect ? "YES" : "NO"}</strong>
      </div>

      <div className="metric-group">
        <span className="metric-group-label">Headers</span>
        <div className="metric-grid metric-grid-3">
          <Metric label="Header fields correct" value={formatRate(headerPasses, scored)} tone={accuracyTone(comparison.fieldPassRate)} />
          <Metric label="Hallucinated values" value={formatRate(hallucinatedCount, scored)} tone={errorCountTone(hallucinatedCount)} />
          <Metric label="Missed values" value={formatRate(missedCount, scored)} tone={errorCountTone(missedCount)} />
        </div>
      </div>

      <div className="metric-group">
        <span className="metric-group-label">Spots</span>
        <div className="metric-grid metric-grid-2">
          <Metric
            label="Fully matched spots"
            value={comparison.lineItemsScored ? exactRowMetric(comparison) : "Not scored"}
            tone={comparison.lineItemsScored ? accuracyTone(comparison.lineItemF1) : "neutral"}
          />
          <Metric
            label="Spot fields correct"
            value={comparison.lineItemsScored ? alignedFieldMetric(comparison) : "Not scored"}
            tone={comparison.lineItemsScored ? accuracyTone(comparison.matchedRowLeafAccuracy) : "neutral"}
          />
        </div>
      </div>

      {comparison.lineItemsScored && <div className="row-score-explanation"><Info size={13} /><span>{rowScoreExplanation(comparison)}</span></div>}
      {!comparison.lineItemsScored && <div className="row-score-exclusion"><Database size={13} /><span>Spot score excluded: {comparison.lineItemScoreExclusionReason}</span></div>}
      {comparison.lineItemsScored && <SpotFailurePanel spots={comparison.spotComparisons} />}
      <div className="section-label"><span>HEADERS</span><span>{headerPasses}/{scored} correct</span></div>
      <div className="gold-table">
        <div className="gold-table-head"><span>FIELD</span><span>MODEL</span><span>REFERENCE</span><span>RESULT</span></div>
        {comparison.fieldRows.map((row) => (
          <div className={`gold-row ${row.excluded ? "excluded" : ""}`} key={row.field}>
            <span>{fieldLabel(row.field)}{row.excluded && <small>excluded</small>}</span>
            <strong className={row.actual === null ? "null-value" : ""}>{row.actual ?? "null"}</strong>
            <strong className={row.expected === null ? "null-value" : ""}>{row.expected ?? "null"}</strong>
            <GoldRowResult row={row} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SpotFailurePanel({ spots }: { spots: ComparisonResult["spotComparisons"] }) {
  const goldSpots = spots.filter((spot) => spot.kind === "gold");
  const extraSpots = spots.filter((spot) => spot.kind === "extra");
  const failures = spots.filter((spot) => !spot.fullyMatched);
  if (!spots.length) return null;
  if (!failures.length) {
    return <div className="spot-failure-ok"><CheckCircle2 size={13} /><span>All reference spots fully matched.</span></div>;
  }

  const failedGold = failures.length - extraSpots.length;
  const counter = extraSpots.length
    ? `${failedGold} of ${goldSpots.length} · +${extraSpots.length} extra`
    : `${failedGold} of ${goldSpots.length}`;

  return (
    <div className="spot-failure-panel">
      <div className="section-label"><span>SPOT FAILURES</span><span>{counter}</span></div>
      {failures.map((spot) => {
        const failingFields = spot.fields.filter((field) => !field.passed);
        const heading =
          spot.kind === "extra"
            ? `EXTRA ${spot.label}`
            : `${String((spot.goldIndex ?? 0) + 1).padStart(2, "0")} ${spot.label}`;
        return (
          <div className="spot-failure" key={`${spot.kind}-${spot.goldIndex ?? spot.predictedIndex}`}>
            <div className="spot-failure-head">
              <strong>{heading}</strong>
              <span>{spot.kind === "extra" ? "not in reference" : spot.paired ? `${spot.fieldPasses}/${spot.fieldTotal} fields` : "unpaired"}</span>
            </div>
            {spot.kind === "extra" ? (
              <div className="spot-failure-note">
                The model returned this spot, but no reference spot matches it. It counts against fully-matched spots.
              </div>
            ) : !spot.paired ? (
              <div className="spot-failure-note">No model spot shared enough identity fields to pair (need ≥2 of channel / program / dates).</div>
            ) : (
              failingFields.map((field) => (
                <div className="spot-failure-row" key={field.field}>
                  <span>{fieldLabel(field.field)}</span>
                  <strong className={field.actual === null ? "null-value" : ""}>{field.actual ?? "null"}</strong>
                  <strong className={field.expected === null ? "null-value" : ""}>{field.expected ?? "null"}</strong>
                  <SpotFieldResult expected={field.expected} actual={field.actual} />
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function SpotFieldResult({ expected, actual }: { expected: string | null; actual: string | null }) {
  if (expected === null && actual !== null) {
    return <span className="overfill" title="Model returned a value where the reference label is null"><AlertTriangle size={13} />overfill</span>;
  }
  if (expected !== null && actual === null) return <span className="diff"><XCircle size={13} />missing</span>;
  return <span className="diff"><XCircle size={13} />diff</span>;
}

function GoldRowResult({ row }: { row: ComparisonResult["fieldRows"][number] }) {
  if (row.excluded) return <span className="excluded-result"><Database size={13} />excluded</span>;
  if (row.passed) return <span className="match"><CheckCircle2 size={13} />match</span>;
  if (row.expected === null && row.actual !== null) {
    return <span className="overfill" title="Model returned a value where the reference label is null"><AlertTriangle size={13} />overfill</span>;
  }
  if (row.expected !== null && row.actual === null) return <span className="diff"><XCircle size={13} />missing</span>;
  return <span className="diff"><XCircle size={13} />diff</span>;
}

function JsonView({ extraction }: { extraction: Extraction }) {
  return <div className="json-view"><div className="json-toolbar"><FileJson size={14} />model-output.json</div><pre>{JSON.stringify(extraction, null, 2)}</pre></div>;
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return <div className="setting-row"><span>{label}</span><strong>{value}</strong></div>;
}

function GateRule({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="gate-rule"><span>{icon}</span><strong>{label}</strong><Check size={13} /></div>;
}

function CheckRow({ label, value, ok, advisory = false, wide = false }: { label: string; value: string; ok: boolean; advisory?: boolean; wide?: boolean }) {
  const state = ok ? "ok" : advisory ? "warn" : "bad";
  return <div className={`check-row ${state} ${wide ? "wide" : ""}`}><span className={`check-icon ${state}`}>{ok ? <Check size={12} /> : advisory ? <AlertTriangle size={12} /> : <XCircle size={12} />}</span><span className="check-label"><span>{label}</span>{advisory && <small>ADVISORY</small>}</span><strong>{value}</strong></div>;
}

function EvidenceMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  return <div className={`evidence-metric ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "good" | "bad" | "warn" | "neutral" }) {
  return <div className={`metric metric-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function TelemetryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="telemetry-item">{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function HeadlineMetric({ value, label, detail, tone = "neutral" }: { value: string; label: string; detail: string; tone?: "neutral" | "good" }) {
  return <div className={`headline-metric ${tone}`}><strong>{value}</strong><span>{label}</span><small>{detail}</small></div>;
}

function ModelRow({ role, model, quality, cost, latency, decision, recommended = false }: { role: string; model: string; quality: number; cost: number; latency: number; decision: string; recommended?: boolean }) {
  return (
    <div className={`model-table-row ${recommended ? "recommended" : ""}`} role="row">
      <span>{role}</span><span><strong>{model}</strong><small>{recommended ? "recommended" : "cost test"}</small></span><span><strong>{percent(quality)}</strong><small>advertiser · order ID · gross</small></span><span>{formatCost(cost)}</span><span>{(latency / 1000).toFixed(1)}s</span><span className={recommended ? "decision-use" : "decision-hold"}>{recommended ? <Check size={13} /> : <AlertTriangle size={13} />}{decision}</span>
    </div>
  );
}

function ReliabilityRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="reliability-row"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function percent(value: number) {
  return `${(value * 100).toFixed(value === 1 || value === 0 ? 0 : 1)}%`;
}

function formatRate(passes: number, total: number, unit?: string) {
  if (total === 0) return "n/a";
  const count = unit ? `${passes}/${total} ${unit}` : `${passes}/${total}`;
  if (total <= 20) {
    return `${count} (${percent(passes / total)})`;
  }
  return percent(passes / total);
}

function exactRowMetric(comparison: ComparisonResult) {
  const extras = comparison.spotComparisons.filter((spot) => spot.kind === "extra").length;
  const base = `${comparison.lineItemMatches}/${comparison.goldLineItems}`;
  return extras > 0 ? `${base} (+${extras} extra)` : base;
}

function alignedFieldMetric(comparison: ComparisonResult) {
  if (comparison.matchedLeafTotal === 0) return "No matched spots";
  return formatRate(comparison.matchedLeafPasses, comparison.matchedLeafTotal, "fields");
}

function accuracyTone(rate: number): "good" | "bad" | "warn" {
  if (rate >= 0.9) return "good";
  if (rate >= 0.5) return "warn";
  return "bad";
}

function errorCountTone(count: number): "good" | "bad" {
  return count === 0 ? "good" : "bad";
}

function rowScoreExplanation(comparison: ComparisonResult) {
  if (comparison.goldLineItems === 0 && comparison.predictedLineItems === 0) {
    return "Reference and the model both contain no spots, so fully matched is 100%.";
  }
  if (comparison.goldLineItems === 0) {
    return `Reference contains no spots, but the model returned ${comparison.predictedLineItems}. Fully matched is therefore 0%.`;
  }
  const goldItems = `${comparison.goldLineItems} reference spot${comparison.goldLineItems === 1 ? "" : "s"}`;
  const modelItems = `${comparison.predictedLineItems} model spot${comparison.predictedLineItems === 1 ? "" : "s"}`;
  const fieldCredit = comparison.matchedLeafTotal > 0
    ? ` ${comparison.matchedLeafPasses}/${comparison.matchedLeafTotal} fields still matched after pairing similar spots.`
    : " No spots could be paired for field-level comparison.";
  return `A spot fully matches only when channel, program, both dates, and amount all agree with the reference. ${comparison.lineItemMatches} of ${goldItems} fully matched across ${modelItems}.${fieldCredit}`;
}

function fieldLabel(field: string) {
  if (field === "contract_num") return "order / contract ID";
  if (field === "program_desc") return "program";
  if (field === "program_start_date") return "start date";
  if (field === "program_end_date") return "end date";
  if (field === "sub_amount") return "amount";
  return field.replaceAll("_", " ");
}

function formatCost(value: number) {
  return `$${value.toFixed(4)}`;
}

function modelLabel(value: string) {
  return MODEL_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function formatFieldList(fields: string[]) {
  const labels = fields.map(fieldLabel);
  if (labels.length < 2) return labels[0] ?? "required field";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function routeReason(validation: ValidationResult) {
  if (validation.missingCritical.length) {
    const fields = formatFieldList(validation.missingCritical);
    return `Partner policy requires ${fields} for auto-accept.`;
  }
  if (!validation.schemaValid) return "The response did not match the JSON schema.";
  if (!validation.dateOrderOk) return "Flight dates are out of order.";
  if (!validation.grossAmountParseable) return "Gross amount could not be parsed.";
  return "A policy check requires review.";
}

function evaluationRunReason(run: EvalRun | undefined, fallbackReasons: string[]) {
  if (run?.missingCritical.length) return `Policy: ${formatFieldList(run.missingCritical)} absent`;
  const reason = fallbackReasons[0];
  if (reason === "schema_invalid") return "JSON schema invalid";
  if (reason === "date_order_invalid") return "Flight dates out of order";
  if (reason === "gross_amount_unparseable") return "Gross amount unreadable";
  if (reason === "line_item_shape_invalid") return "Incomplete spot";
  return "Review required";
}

function runEvidenceNote(
  validation: ValidationResult,
  comparison: ComparisonResult | null,
  primary: EvalAggregate | null,
  acceptedCount: number | null,
  benchmarkGeneratedAt: string | null,
) {
  const goldNullFields = validation.missingCritical.filter((field) =>
    comparison?.fieldRows.some((row) => row.field === field && row.expected === null),
  );
  if (goldNullFields.length) {
    const fields = formatFieldList(goldNullFields);
    return `Reference also marks ${fields} null. That extraction is correct; the example partner policy still sends it to review.`;
  }
  if (primary && acceptedCount !== null) {
    return `Saved benchmark: ${acceptedCount}/${acceptedCount} accepted documents matched reference on advertiser, order ID, and gross${benchmarkGeneratedAt ? ` · ${formatReportDate(benchmarkGeneratedAt)}` : ""}.`;
  }
  return "No saved benchmark is loaded. This route uses the current extraction and policy checks.";
}

function formatReportDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "saved report";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function readExtractionResponse(response: Response): Promise<ExtractionResponse> {
  const body = await response.text();
  let payload: unknown;

  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
    if (!response.ok) {
      throw new Error(
        `The extraction service returned HTTP ${response.status}. Retry once; if it persists, restart the local server.`,
      );
    }
    throw new Error("The extraction service returned an unreadable response. Please retry the run.");
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `The extraction service returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== "object" || !("extraction" in payload) || !("validation" in payload)) {
    throw new Error("The extraction service returned an incomplete result. Please retry the run.");
  }

  return payload as ExtractionResponse;
}
