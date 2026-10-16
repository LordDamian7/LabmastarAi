import React, { useEffect, useState } from "react";
import { CaseStudy, GradingResult, StudyMaterial, LabResultItem } from "../types";
import { apiFetch, apiError } from "../lib/api";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Lightbulb,
  Loader2,
  User,
  TestTube,
  Droplet,
  Microscope,
  Syringe,
  Dna,
  TriangleAlert,
  Sparkles,
  RotateCcw,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface QuizExerciseProps {
  onAwardXp: (amount: number, categoryKey?: string, achievedScore?: number) => void;
  onIncrementGoal: (actionType: string) => void;
  studyMaterials: StudyMaterial[];
  /** Discipline the dashboard asked to open immediately. */
  pendingCategory?: string | null;
  onPendingCategoryHandled?: () => void;
}

const CATEGORIES = [
  { id: "chemistry", name: "Clinical Chemistry", desc: "Electrolytes, enzymes and delta check interpretation", icon: TestTube, tint: "text-accent bg-accent/14" },
  { id: "hematology", name: "Hematology & Coag", desc: "CBC differentials, smears, left shift and clotting tests", icon: Droplet, tint: "text-critical bg-critical/14" },
  { id: "microbiology", name: "Microbiology", desc: "Culture morphology, staining and biochemical ID", icon: Microscope, tint: "text-normal bg-normal/14" },
  { id: "bloodbank", name: "Blood Bank", desc: "ABO discrepancies, antibody ID and crossmatching", icon: Syringe, tint: "text-low bg-low/14" },
  { id: "immunology", name: "Immunology", desc: "ANA patterns, titers and ELISA assays", icon: Dna, tint: "text-violet bg-violet/14" }
];

const LOADING_STEPS = [
  "Selecting a patient…",
  "Running the analyzer…",
  "Checking reference ranges…",
  "Writing your questions…"
];

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// Map an analyzer status string to a lab flag style.
function flagFor(status: string): { label: string; cls: string; tone: "critical" | "high" | "low" | "normal" } {
  const s = status.toLowerCase();
  if (s.includes("critical")) return { label: status, cls: "text-critical bg-critical/14 border-critical/40", tone: "critical" };
  if (s.includes("low")) return { label: status, cls: "text-low bg-low/14 border-low/40", tone: "low" };
  if (s.includes("normal")) return { label: status, cls: "text-normal bg-normal/14 border-normal/40", tone: "normal" };
  return { label: status, cls: "text-high bg-high/14 border-high/40", tone: "high" };
}

function Flag({ status, small }: { status: string; small?: boolean }) {
  const f = flagFor(status);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-bold ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} ${f.cls}`}>
      {f.tone === "critical" && <TriangleAlert className={small ? "w-3 h-3" : "w-3.5 h-3.5"} />}
      {f.label}
    </span>
  );
}

const formatClock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function QuizExercise({ onAwardXp, onIncrementGoal, studyMaterials, pendingCategory, onPendingCategoryHandled }: QuizExerciseProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [useRagForCase, setUseRagForCase] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCase, setCurrentCase] = useState<CaseStudy | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showHints, setShowHints] = useState<Record<number, boolean>>({});
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const loadCase = async (category: string) => {
    setSelectedCategory(category);
    setIsLoading(true);
    setError(null);
    setCurrentCase(null);
    setGradingResult(null);
    setUserAnswers({});
    setShowHints({});
    setQuestionIndex(0);
    setLoadingStep(0);

    const stepTimer = setInterval(() => setLoadingStep(i => Math.min(i + 1, LOADING_STEPS.length - 1)), 900);
    try {
      const response = await apiFetch("/api/generate-exercise", {
        category,
        materialIds: useRagForCase ? studyMaterials.map(m => m.id) : []
      });
      if (!response.ok) throw await apiError(response, "Couldn't load a case. Please try again.");
      const data: CaseStudy = await response.json();
      setCurrentCase(data);
      setStartedAt(Date.now());
      setElapsed(0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Couldn't load a case. Please try again.");
    } finally {
      clearInterval(stepTimer);
      setIsLoading(false);
    }
  };

  // Open the discipline the dashboard asked for.
  useEffect(() => {
    if (pendingCategory) {
      loadCase(pendingCategory);
      onPendingCategoryHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCategory]);

  // Case timer — stops once the case is graded.
  useEffect(() => {
    if (!startedAt || gradingResult) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt, gradingResult]);

  const handleSubmitExercise = async () => {
    if (!currentCase) return;
    setIsGrading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/grade-exercise", {
        scenario: currentCase.scenario,
        questions: currentCase.questions,
        rawLabData: currentCase.labData,
        studentAnswers: userAnswers
      });
      if (!response.ok) throw await apiError(response, "Grading failed. Please try again.");
      const result: GradingResult = await response.json();
      setGradingResult(result);

      const baseEarned = result.score >= 90 ? 100 : result.score >= 70 ? 75 : 50;
      onAwardXp(baseEarned, selectedCategory || "chemistry", result.score);
      onIncrementGoal("exercise_complete");
      if (result.score >= 90) onIncrementGoal("score_90");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Grading failed. Please try again.");
    } finally {
      setIsGrading(false);
    }
  };

  const leaveCase = () => {
    if (currentCase && !gradingResult && Object.keys(userAnswers).length > 0 && !confirm("Leave this case? Your answers won't be saved.")) return;
    setCurrentCase(null);
    setGradingResult(null);
    setStartedAt(null);
    setError(null);
  };

  const category = CATEGORIES.find(c => c.id === selectedCategory) || CATEGORIES[0];

  // ---------- Discipline picker ----------
  if (!currentCase && !isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight">Lab Simulator</h1>
          <p className="text-[15px] text-ink-2 mt-1">Pick a discipline. You'll get a patient, a lab report and three questions.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-critical/40 bg-critical/10 p-4 text-sm text-critical flex items-start gap-2.5" role="alert">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {studyMaterials.length > 0 && (
          <label className="card flex items-center gap-4 p-4 cursor-pointer">
            <span className="h-10 w-10 shrink-0 rounded-xl bg-accent/14 flex items-center justify-center"><BookOpen className="w-5 h-5 text-accent" /></span>
            <span className="flex-1">
              <span className="block text-sm font-bold">Base cases on my study files</span>
              <span className="block text-sm text-ink-3">{studyMaterials.length} file{studyMaterials.length === 1 ? "" : "s"} in your library</span>
            </span>
            <input type="checkbox" checked={useRagForCase} onChange={e => setUseRagForCase(e.target.checked)} className="h-5 w-5 accent-accent cursor-pointer" />
          </label>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(cat => (
            <motion.button
              key={cat.id}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => loadCase(cat.id)}
              className="card p-4 sm:p-5 text-left flex sm:flex-col items-center sm:items-start gap-4 hover:border-accent/50 transition-colors cursor-pointer group"
            >
              <span className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${cat.tint}`}><cat.icon className="w-[22px] h-[22px]" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-base font-bold group-hover:text-accent transition-colors">{cat.name}</span>
                <span className="block text-sm text-ink-3 mt-1 leading-relaxed">{cat.desc}</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-accent">
                Start case <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
              <ArrowRight className="sm:hidden w-5 h-5 shrink-0 text-accent" aria-hidden="true" />
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Loading ----------
  if (isLoading || !currentCase) {
    return (
      <div className="card p-10 sm:p-14 flex flex-col items-center text-center gap-5 min-h-[420px] justify-center" aria-live="polite">
        <span className={`h-14 w-14 rounded-2xl flex items-center justify-center ${category.tint}`}><category.icon className="w-7 h-7" /></span>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold">Preparing a {category.name.toLowerCase()} case</h2>
          <p className="text-sm text-ink-3">{LOADING_STEPS[loadingStep]}</p>
        </div>
        <div className="flex gap-1.5">
          {LOADING_STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= loadingStep ? "w-8 bg-accent" : "w-4 bg-line"}`} />
          ))}
        </div>
      </div>
    );
  }

  // ---------- Active case ----------
  const questions = currentCase.questions;
  const q = questions[questionIndex];
  const answered = (id: number) => (userAnswers[id] || "").trim().length > 0;
  const allAnswered = questions.every(x => answered(x.id));
  const isLast = questionIndex === questions.length - 1;
  const stage = gradingResult ? 3 : 2;
  const STEPS = ["Case", "Lab results", "Questions", "Feedback"];

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button onClick={leaveCase} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink cursor-pointer">
          <ArrowLeft className="w-[18px] h-[18px]" /> <span className="hidden sm:inline">All disciplines</span>
        </button>
        <ol className="hidden md:flex flex-1 items-center justify-center gap-2" aria-label="Case progress">
          {STEPS.map((label, i) => {
            const done = i < stage;
            const active = i === stage;
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 && <span className={`h-0.5 w-8 rounded-full ${i <= stage ? "bg-accent" : "bg-line"}`} />}
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? "bg-accent text-accent-ink" : active ? "bg-accent/16 border border-accent text-accent" : "bg-surface-2 border border-line text-ink-3"}`}>
                  {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={`text-sm ${active ? "font-bold text-ink" : done ? "font-semibold text-ink-2" : "font-semibold text-ink-3"}`}>{label}</span>
              </li>
            );
          })}
        </ol>
        <span className="md:hidden flex-1 text-sm font-bold">
          {gradingResult ? "Feedback" : `Question ${questionIndex + 1} of ${questions.length}`}
        </span>
        <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm text-ink-2">
          <Clock className="w-4 h-4" /> {formatClock(elapsed)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-5 lg:gap-6 items-start">
        {/* Case column */}
        <div className="space-y-5 min-w-0">
          <section className="card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-accent/14 px-2.5 py-1 text-xs font-bold text-accent">{category.name}</span>
              {currentCase.difficulty && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${/adv/i.test(currentCase.difficulty) ? "bg-critical/14 text-critical" : /inter/i.test(currentCase.difficulty) ? "bg-high/14 text-high" : "bg-normal/14 text-normal"}`}>
                  {currentCase.difficulty}
                </span>
              )}
              <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink-3">Case #{currentCase.id}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">{currentCase.title}</h2>
            <div className="flex gap-3">
              <span className="h-9 w-9 shrink-0 rounded-xl bg-violet/14 flex items-center justify-center"><User className="w-[18px] h-[18px] text-violet" /></span>
              <p className="text-[15px] text-ink-2 leading-relaxed">{currentCase.scenario}</p>
            </div>
          </section>

          <section className="card overflow-hidden" aria-label="Lab results">
            <div className="flex items-center gap-2.5 px-5 sm:px-6 py-4">
              <TestTube className="w-[18px] h-[18px] text-accent" />
              <h3 className="flex-1 text-[15px] font-bold">Lab results</h3>
              <span className="text-xs text-ink-3">{currentCase.labData.length} analytes</span>
            </div>
            {/* Desktop/tablet table */}
            <table className="hidden sm:table w-full text-left">
              <thead className="bg-surface-2">
                <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
                  <th className="px-6 py-2.5 font-bold">Analyte</th>
                  <th className="px-3 py-2.5 font-bold">Result</th>
                  <th className="px-3 py-2.5 font-bold">Reference</th>
                  <th className="px-6 py-2.5 font-bold">Flag</th>
                </tr>
              </thead>
              <tbody>
                {currentCase.labData.map((row: LabResultItem, i) => {
                  const crit = flagFor(row.status).tone === "critical";
                  return (
                    <tr key={i} className={`border-t border-line ${crit ? "bg-critical/7" : ""}`}>
                      <td className="px-6 py-3.5 text-sm font-semibold">{row.parameter}</td>
                      <td className={`px-3 py-3.5 font-mono text-sm font-bold ${crit ? "text-critical" : ""}`}>{row.result}</td>
                      <td className="px-3 py-3.5 font-mono text-[13px] text-ink-3">{row.referenceRange}</td>
                      <td className="px-6 py-3.5"><Flag status={row.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Phone: stacked rows */}
            <ul className="sm:hidden">
              {currentCase.labData.map((row, i) => {
                const crit = flagFor(row.status).tone === "critical";
                return (
                  <li key={i} className={`flex items-center gap-3 border-t border-line px-4 py-3 ${crit ? "bg-critical/8" : ""}`}>
                    <div className="flex-1 min-w-[40%]">
                      <p className="text-sm font-semibold">{row.parameter}</p>
                      <p className="font-mono text-xs text-ink-3 mt-0.5">Ref {row.referenceRange}</p>
                    </div>
                    <div className="flex max-w-[48%] flex-col items-end gap-1.5 text-right">
                      <span className={`font-mono text-sm font-bold break-words ${crit ? "text-critical" : ""}`}>{row.result}</span>
                      <Flag status={row.status} small />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Question / feedback column */}
        <div className="space-y-4 lg:sticky lg:top-6">
          {error && (
            <div className="rounded-xl border border-critical/40 bg-critical/10 p-4 text-sm text-critical flex items-start gap-2.5" role="alert">
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {!gradingResult ? (
            <section className="card p-5 sm:p-6 space-y-5" aria-live="polite">
              <div className="flex items-center">
                <span className="flex-1 text-sm font-bold text-accent">Question {questionIndex + 1} of {questions.length}</span>
                <div className="flex gap-1.5">
                  {questions.map((x, i) => (
                    <button
                      key={x.id}
                      onClick={() => setQuestionIndex(i)}
                      aria-label={`Go to question ${i + 1}`}
                      className={`h-2 rounded-full transition-all cursor-pointer ${i === questionIndex ? "w-6 bg-accent" : answered(x.id) ? "w-2 bg-accent/50" : "w-2 bg-line"}`}
                    />
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={q.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="space-y-4">
                  <h3 className="text-[17px] font-bold leading-relaxed">{q.text}</h3>

                  {showHints[q.id] && (
                    <div className="rounded-xl border border-xp/30 bg-xp/8 p-3.5 text-sm text-ink-2 leading-relaxed flex gap-2.5">
                      <Lightbulb className="w-4 h-4 text-xp shrink-0 mt-0.5" /> {q.hint || "Look at the flagged results first."}
                    </div>
                  )}

                  {q.type === "multiple-choice" && q.options?.length ? (
                    <div className="space-y-2.5" role="radiogroup" aria-label="Answer options">
                      {q.options.map((opt, i) => {
                        const sel = userAnswers[q.id] === opt;
                        return (
                          <button
                            key={i}
                            role="radio"
                            aria-checked={sel}
                            onClick={() => setUserAnswers(prev => ({ ...prev, [q.id]: opt }))}
                            className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${sel ? "border-accent border-2 bg-accent/10" : "border-line bg-surface-2 hover:border-ink-3"}`}
                          >
                            <span className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-[13px] font-bold ${sel ? "bg-accent text-accent-ink" : "border border-line bg-surface text-ink-2"}`}>{LETTERS[i] || "•"}</span>
                            <span className={`text-sm leading-snug ${sel ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label htmlFor={`answer-${q.id}`} className="text-sm font-semibold text-ink-2">Your answer</label>
                      <input
                        id={`answer-${q.id}`}
                        value={userAnswers[q.id] || ""}
                        onChange={e => setUserAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Type a short answer…"
                        className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowHints(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                  className="btn-secondary px-3.5"
                  aria-pressed={!!showHints[q.id]}
                >
                  <Lightbulb className="w-4 h-4 text-xp" /> Hint
                </button>
                {questionIndex > 0 && (
                  <button onClick={() => setQuestionIndex(i => i - 1)} className="btn-secondary px-3.5" aria-label="Previous question">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                {isLast ? (
                  <button onClick={handleSubmitExercise} disabled={!allAnswered || isGrading} className="btn-primary flex-1">
                    {isGrading ? <><Loader2 className="w-4 h-4 animate-spin" /> Grading…</> : <>Submit answers <Check className="w-4 h-4" strokeWidth={3} /></>}
                  </button>
                ) : (
                  <button onClick={() => setQuestionIndex(i => i + 1)} disabled={!answered(q.id)} className="btn-primary flex-1">
                    Next question <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              {isLast && !allAnswered && <p className="text-xs text-ink-3 text-center">Answer every question to submit.</p>}
            </section>
          ) : (
            <section className="card p-5 sm:p-6 space-y-5 animate-slideUp">
              <div className="flex items-center gap-4">
                <div
                  className="relative h-20 w-20 shrink-0 rounded-full flex items-center justify-center"
                  style={{ background: `conic-gradient(var(--color-${gradingResult.score >= 85 ? "accent" : gradingResult.score >= 60 ? "xp" : "critical"}) ${gradingResult.score * 3.6}deg, var(--color-surface-2) 0deg)` }}
                >
                  <span className="absolute inset-1.5 rounded-full bg-surface flex items-center justify-center font-mono text-xl font-bold">{gradingResult.score}%</span>
                </div>
                <div>
                  <p className="eyebrow">{gradingResult.score >= 85 ? "Excellent work" : gradingResult.score >= 60 ? "Good effort" : "Keep practising"}</p>
                  <p className="text-lg font-bold mt-1">+{gradingResult.score >= 90 ? 100 : gradingResult.score >= 70 ? 75 : 50} XP earned</p>
                  <p className="text-sm text-ink-3">Solved in {formatClock(elapsed)}</p>
                </div>
              </div>

              <p className="text-[15px] text-ink-2 leading-relaxed">{gradingResult.summary}</p>

              <ul className="space-y-2.5">
                {gradingResult.questionFeedback.map((fb, i) => (
                  <li key={fb.id} className="flex gap-3 rounded-xl bg-surface-2 p-3.5">
                    {fb.correct ? <CheckCircle2 className="w-5 h-5 text-normal shrink-0" /> : <XCircle className="w-5 h-5 text-critical shrink-0" />}
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-bold">Question {i + 1}</p>
                      <p className="text-sm text-ink-2 leading-relaxed">{fb.feedback}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {gradingResult.pearlOfWisdom && (
                <div className="rounded-xl border border-xp/30 bg-xp/8 p-4 flex gap-3">
                  <Sparkles className="w-5 h-5 text-xp shrink-0" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-xp">Lab pearl</p>
                    <p className="text-sm text-ink-2 leading-relaxed mt-1">{gradingResult.pearlOfWisdom}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2.5">
                <button onClick={leaveCase} className="btn-secondary flex-1">All disciplines</button>
                <button onClick={() => loadCase(category.id)} className="btn-primary flex-1">
                  <RotateCcw className="w-4 h-4" /> Next case
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
