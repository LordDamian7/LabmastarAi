import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExamQuestion, StudyMaterial } from "../types";
import { apiFetch, apiError } from "../lib/api";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Clock,
  Loader2,
  TestTube,
  Droplet,
  Microscope,
  Syringe,
  Dna,
  TriangleAlert,
  RotateCcw,
  BookOpen,
  Flag as FlagIcon,
  LayoutGrid,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import BadgeMedal from "./BadgeMedal";
import { EXAM_TOPICS, findTopic, topicBadgeId, TOPIC_ICONS, TOPIC_BADGE_SCORE, TOPIC_BADGE_MIN_QUESTIONS } from "../lib/badges";

interface QuizExerciseProps {
  /** amount, discipline, score %, number of questions answered, topic id for topic exams */
  onAwardXp: (amount: number, categoryKey?: string, achievedScore?: number, questionCount?: number, topicId?: string) => void;
  onIncrementGoal: (actionType: string) => void;
  studyMaterials: StudyMaterial[];
  /** Discipline (or topic id) the dashboard asked to open immediately. */
  pendingCategory?: string | null;
  unlockedBadges: string[];
  topicScores: Record<string, number>;
  onPendingCategoryHandled?: () => void;
}

export const CATEGORIES = [
  { id: "chemistry", name: "Clinical Chemistry", desc: "Electrolytes, enzymes, liver, cardiac and QC", icon: TestTube, tint: "text-accent bg-accent/14" },
  { id: "hematology", name: "Hematology & Coag", desc: "Anemias, leukemias, morphology and hemostasis", icon: Droplet, tint: "text-critical bg-critical/14" },
  { id: "microbiology", name: "Microbiology", desc: "Bacteria ID, mycology, parasitology, susceptibility", icon: Microscope, tint: "text-normal bg-normal/14" },
  { id: "bloodbank", name: "Blood Bank", desc: "ABO/Rh, antibody ID, crossmatch and HDFN", icon: Syringe, tint: "text-low bg-low/14" },
  { id: "immunology", name: "Immunology", desc: "Autoantibodies, serology and immunoassays", icon: Dna, tint: "text-violet bg-violet/14" }
];

const LENGTHS = [10, 25, 50];
const DEFAULT_LENGTH = 50;
const BATCH = 10;
const LETTERS = ["A", "B", "C", "D"];
/** Exams shorter than this don't count toward badges. */
export const BADGE_MIN_QUESTIONS = 25;

type Phase = "setup" | "loading" | "exam" | "results";

function flagTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("critical")) return "text-critical bg-critical/14 border-critical/40";
  if (s.includes("low") || s.includes("negative")) return "text-low bg-low/14 border-low/40";
  if (s.includes("normal") || s === "—") return "text-normal bg-normal/14 border-normal/40";
  return "text-high bg-high/14 border-high/40";
}

const formatClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const examXp = (correct: number, score: number) => correct * 3 + (score >= 90 ? 25 : score >= 70 ? 10 : 0);

export default function QuizExercise({ onAwardXp, onIncrementGoal, studyMaterials, pendingCategory, onPendingCategoryHandled, unlockedBadges, topicScores }: QuizExerciseProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [length, setLength] = useState(DEFAULT_LENGTH);
  const [useRag, setUseRag] = useState(true);
  const [examType, setExamType] = useState<"full" | "topic">("full");
  const [topicId, setTopicId] = useState<string | null>(null);

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [target, setTarget] = useState(DEFAULT_LENGTH);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [awarded, setAwarded] = useState<{ xp: number; badgeEligible: boolean } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(true);

  // Increments whenever an exam starts or is abandoned, so a background batch loop
  // from an old exam can tell it is stale and stop.
  const runRef = useRef(0);

  const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
  const topic = findTopic(topicId)?.topic ?? null;
  const examTitle = topic ? `${topic.name} topic` : cat.name;

  const fetchBatch = async (cat: string, topic: string | null, count: number, batch: number, avoid: string[]) => {
    const response = await apiFetch("/api/generate-questions", {
      category: cat,
      topicId: topic,
      count,
      batch,
      avoid,
      materialIds: useRag ? studyMaterials.map(m => m.id) : []
    });
    if (!response.ok) throw await apiError(response, "Couldn't load questions. Please try again.");
    return (await response.json()) as { questions: ExamQuestion[]; simulation?: boolean; exhausted?: boolean };
  };

  const startExam = async (catId: string, total = length, topicKey: string | null = null) => {
    const run = ++runRef.current;
    setCategory(catId);
    setTopicId(topicKey);
    setPhase("loading");
    setError(null);
    setNotice(null);
    setQuestions([]);
    setAnswers({});
    setChecked({});
    setCurrent(0);
    setAwarded(null);
    setTarget(total);
    setIsDemo(false);

    let loaded: ExamQuestion[] = [];
    try {
      const first = await fetchBatch(catId, topicKey, Math.min(BATCH, total), 0, []);
      if (run !== runRef.current) return;
      if (!first.questions.length) throw new Error("No questions are available right now. Please try again shortly.");
      loaded = first.questions;
      setQuestions(loaded);
      setIsDemo(!!first.simulation);
      setStartedAt(Date.now());
      setElapsed(0);
      setPhase("exam");
      if (first.questions.length < Math.min(BATCH, total) || first.exhausted) {
        setTarget(loaded.length);
        if (first.simulation) setNotice(`Demo mode has ${loaded.length} question${loaded.length === 1 ? "" : "s"} for this ${topicKey ? "topic" : "discipline"}. Add a Gemini key for full ${total}-question exams.`);
        return;
      }
    } catch (err: any) {
      if (run !== runRef.current) return;
      setError(err.message || "Couldn't load questions. Please try again.");
      setPhase("setup");
      return;
    }

    // Load the rest in the background while the student works.
    setLoadingMore(true);
    try {
      for (let batch = 1; loaded.length < total; batch++) {
        const want = Math.min(BATCH, total - loaded.length);
        const result = await fetchBatch(catId, topicKey, want, batch, loaded.map(q => q.stem.slice(0, 90)));
        if (run !== runRef.current) return;
        if (result.simulation) setIsDemo(true);
        if (!result.questions.length) {
          setTarget(loaded.length);
          if (result.simulation) setNotice(`Demo mode ran out of questions — this exam has ${loaded.length}. Add a Gemini key for full ${total}-question exams.`);
          break;
        }
        loaded = [...loaded, ...result.questions];
        setQuestions(loaded);
        if (result.exhausted) {
          setTarget(loaded.length);
          setNotice(`Demo mode ran out of questions — this exam has ${loaded.length}.`);
          break;
        }
      }
    } catch (err: any) {
      if (run !== runRef.current) return;
      setTarget(loaded.length);
      setNotice(`${err.message || "Couldn't load more questions."} You can finish with the ${loaded.length} loaded so far.`);
    } finally {
      if (run === runRef.current) setLoadingMore(false);
    }
  };

  // Open the discipline the dashboard asked for.
  useEffect(() => {
    if (pendingCategory) {
      const pendingTopic = findTopic(pendingCategory);
      if (pendingTopic) startExam(pendingTopic.category, length, pendingCategory);
      else startExam(pendingCategory);
      onPendingCategoryHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCategory]);

  // Stop background loading if the component goes away.
  useEffect(() => () => { runRef.current++; }, []);

  // Exam timer.
  useEffect(() => {
    if (phase !== "exam" || !startedAt) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase, startedAt]);

  const answeredIdx = Object.keys(checked).map(Number);
  const correctCount = answeredIdx.filter(i => answers[i] === questions[i]?.answerIndex).length;
  const answeredCount = answeredIdx.length;
  const total = Math.max(target, questions.length);
  const q = questions[current];
  const isChecked = !!checked[current];
  const selected = answers[current];

  const finishExam = () => {
    if (answeredCount === 0) {
      setPhase("setup");
      runRef.current++;
      return;
    }
    if (answeredCount < total && !confirm(`You've answered ${answeredCount} of ${total}. Finish and score what you've answered?`)) return;
    runRef.current++;
    setLoadingMore(false);
    const score = Math.round((correctCount / answeredCount) * 100);
    const xp = examXp(correctCount, score);
    const badgeEligible = answeredCount >= (topicId ? TOPIC_BADGE_MIN_QUESTIONS : BADGE_MIN_QUESTIONS);
    onAwardXp(xp, category, score, answeredCount, topicId ?? undefined);
    onIncrementGoal("exercise_complete");
    if (score >= 90) onIncrementGoal("score_90");
    setAwarded({ xp, badgeEligible });
    setPhase("results");
  };

  const goNext = () => {
    if (current + 1 < total) setCurrent(current + 1);
    else finishExam();
  };

  const leaveExam = () => {
    if (phase === "exam" && answeredCount > 0 && !confirm("Leave this exam? Your progress won't be saved.")) return;
    runRef.current++;
    setLoadingMore(false);
    setPhase("setup");
  };

  // Keyboard: 1–4 / A–D pick an answer, Enter checks or moves on.
  useEffect(() => {
    if (phase !== "exam" || !q) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      const idx = ["1", "2", "3", "4"].indexOf(k) >= 0 ? Number(k) - 1 : ["a", "b", "c", "d"].indexOf(k);
      if (idx >= 0 && !isChecked) setAnswers(prev => ({ ...prev, [current]: idx }));
      if (k === "enter") {
        if (!isChecked && selected !== undefined) setChecked(prev => ({ ...prev, [current]: true }));
        else if (isChecked) goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const topicStats = useMemo(() => {
    const m = new Map<string, { correct: number; total: number }>();
    answeredIdx.forEach(i => {
      const t = questions[i]?.topic || "General";
      const s = m.get(t) || { correct: 0, total: 0 };
      s.total++;
      if (answers[i] === questions[i].answerIndex) s.correct++;
      m.set(t, s);
    });
    return [...m.entries()].map(([topic, s]) => ({ topic, ...s, pct: Math.round((s.correct / s.total) * 100) })).sort((a, b) => a.pct - b.pct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---------- Setup ----------
  if (phase === "setup") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight">Lab Simulator</h1>
          <p className="text-[15px] text-ink-2 mt-1">Board-style practice exams. Instant feedback and an explanation for every question.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-critical/40 bg-critical/10 p-4 text-sm text-critical flex items-start gap-2.5" role="alert">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold">Exam length</p>
            <p className="text-sm text-ink-3">Discipline medals need {BADGE_MIN_QUESTIONS}+ questions, topic badges {TOPIC_BADGE_MIN_QUESTIONS}+.</p>
          </div>
          <div className="grid grid-cols-3 rounded-xl border border-line bg-surface-2 p-1" role="radiogroup" aria-label="Exam length">
            {LENGTHS.map(n => (
              <button
                key={n}
                role="radio"
                aria-checked={length === n}
                onClick={() => setLength(n)}
                className={`rounded-lg px-5 py-2 text-sm font-bold cursor-pointer ${length === n ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold">Exam type</p>
            <p className="text-sm text-ink-3">
              {examType === "full" ? "Questions from every topic in the discipline." : `One topic. Pass with ${TOPIC_BADGE_SCORE}%+ on ${TOPIC_BADGE_MIN_QUESTIONS}+ questions to earn its badge.`}
            </p>
          </div>
          <div className="grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1" role="radiogroup" aria-label="Exam type">
            {([["full", "Full discipline"], ["topic", "Single topic"]] as const).map(([id, label]) => (
              <button
                key={id}
                role="radio"
                aria-checked={examType === id}
                onClick={() => setExamType(id)}
                className={`rounded-lg px-4 py-2 text-sm font-bold cursor-pointer whitespace-nowrap ${examType === id ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {studyMaterials.length > 0 && (
          <label className="card flex items-center gap-4 p-4 cursor-pointer">
            <span className="h-10 w-10 shrink-0 rounded-xl bg-accent/14 flex items-center justify-center"><BookOpen className="w-5 h-5 text-accent" /></span>
            <span className="flex-1">
              <span className="block text-sm font-bold">Base questions on my study files</span>
              <span className="block text-sm text-ink-3">{studyMaterials.length} file{studyMaterials.length === 1 ? "" : "s"} in your library</span>
            </span>
            <input type="checkbox" checked={useRag} onChange={e => setUseRag(e.target.checked)} className="h-5 w-5 accent-accent cursor-pointer" />
          </label>
        )}

        {examType === "topic" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {CATEGORIES.map(c => (
              <section key={c.id} className="card p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon className="w-[18px] h-[18px]" /></span>
                  <h2 className="flex-1 text-base font-bold">{c.name}</h2>
                  <span className="text-xs font-semibold text-ink-3">
                    {EXAM_TOPICS[c.id].filter(t => unlockedBadges.includes(topicBadgeId(t.id))).length}/{EXAM_TOPICS[c.id].length} badges
                  </span>
                </div>
                <ul className="divide-y divide-line">
                  {EXAM_TOPICS[c.id].map(t => {
                    const earned = unlockedBadges.includes(topicBadgeId(t.id));
                    const best = topicScores[t.id];
                    return (
                      <li key={t.id}>
                        <button onClick={() => startExam(c.id, length, t.id)} className="w-full flex items-center gap-3 py-2.5 text-left cursor-pointer group">
                          <BadgeMedal category={c.id} earned={earned} shape="coin" icon={TOPIC_ICONS[t.id]} size={36} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold group-hover:text-accent transition-colors">{t.name}</span>
                            <span className="block text-xs text-ink-3">
                              {earned ? `${t.badge} · earned` : best !== undefined ? `${t.badge} · best ${best}%` : t.badge}
                            </span>
                          </span>
                          <span className="hidden sm:inline text-xs font-bold text-accent">{length} Qs</span>
                          <ArrowRight className="w-4 h-4 shrink-0 text-accent transition-transform group-hover:translate-x-1" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(c => (
            <motion.button
              key={c.id}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => startExam(c.id)}
              className="card p-4 sm:p-5 text-left flex sm:flex-col items-center sm:items-start gap-4 hover:border-accent/50 transition-colors cursor-pointer group"
            >
              <span className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon className="w-[22px] h-[22px]" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-base font-bold group-hover:text-accent transition-colors">{c.name}</span>
                <span className="block text-sm text-ink-3 mt-1 leading-relaxed">{c.desc}</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-accent">
                Start {length}-question exam <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
              <ArrowRight className="sm:hidden w-5 h-5 shrink-0 text-accent" aria-hidden="true" />
            </motion.button>
          ))}
        </div>
        )}
      </div>
    );
  }

  // ---------- Loading first batch ----------
  if (phase === "loading") {
    return (
      <div className="card p-10 sm:p-14 flex flex-col items-center text-center gap-5 min-h-[420px] justify-center" aria-live="polite">
        <span className={`h-14 w-14 rounded-2xl flex items-center justify-center ${cat.tint}`}><cat.icon className="w-7 h-7" /></span>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold">Preparing your {examTitle} exam</h2>
          <p className="text-sm text-ink-3">Writing the first questions — the rest load while you work.</p>
        </div>
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
        <button onClick={leaveExam} className="text-sm font-semibold text-ink-3 hover:text-ink cursor-pointer">Cancel</button>
      </div>
    );
  }

  // ---------- Results ----------
  if (phase === "results") {
    const score = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;
    const ringColor = score >= 85 ? "accent" : score >= 60 ? "xp" : "critical";
    const missed = answeredIdx.filter(i => answers[i] !== questions[i].answerIndex).sort((a, b) => a - b);
    return (
      <div className="space-y-6">
        <button onClick={() => setPhase("setup")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink cursor-pointer">
          <ArrowLeft className="w-[18px] h-[18px]" /> All disciplines
        </button>

        <section className="card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6 animate-slideUp">
          <div
            className="relative h-32 w-32 shrink-0 rounded-full flex items-center justify-center self-center"
            style={{ background: `conic-gradient(var(--color-${ringColor}) ${score * 3.6}deg, var(--color-surface-2) 0deg)` }}
            role="img"
            aria-label={`Score ${score}%`}
          >
            <span className="absolute inset-2.5 rounded-full bg-surface flex flex-col items-center justify-center">
              <span className="font-mono text-3xl font-bold">{score}%</span>
              <span className="text-xs text-ink-3">{correctCount}/{answeredCount} correct</span>
            </span>
          </div>
          <div className="flex-1 space-y-2">
            <p className="eyebrow">{examTitle} exam</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {score >= 85 ? "Board-ready performance" : score >= 60 ? "Solid — keep pushing" : "Good practice — review the misses"}
            </h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4 text-ink-3" /> {formatClock(elapsed)}</span>
              <span className="font-bold text-xp">+{awarded?.xp ?? 0} XP</span>
              {awarded && !awarded.badgeEligible && <span className="text-ink-3">Badges need {topicId ? TOPIC_BADGE_MIN_QUESTIONS : BADGE_MIN_QUESTIONS}+ answered questions</span>}
            </div>
          </div>
          <div className="flex sm:flex-col gap-2.5">
            <button onClick={() => startExam(category, length, topicId)} className="btn-primary flex-1"><RotateCcw className="w-4 h-4" /> New exam</button>
            <button onClick={() => setPhase("setup")} className="btn-secondary flex-1">Change discipline</button>
          </div>
        </section>

        {topicStats.length > 0 && (
          <section className="card p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold">By topic <span className="text-sm font-medium text-ink-3">· weakest first</span></h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {topicStats.map(t => (
                <li key={t.topic} className="space-y-2">
                  <div className="flex items-center text-sm">
                    <span className="flex-1 font-semibold">{t.topic}</span>
                    <span className="font-mono text-ink-2">{t.correct}/{t.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className={`h-full rounded-full ${t.pct >= 85 ? "bg-accent" : t.pct >= 60 ? "bg-xp" : "bg-critical"}`} style={{ width: `${Math.max(3, t.pct)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {missed.length > 0 && (
          <section className="card overflow-hidden">
            <button onClick={() => setReviewOpen(o => !o)} className="w-full flex items-center gap-3 p-5 sm:p-6 text-left cursor-pointer" aria-expanded={reviewOpen}>
              <span className="flex-1 text-lg font-bold">Review your misses <span className="text-sm font-medium text-ink-3">· {missed.length}</span></span>
              <ChevronDown className={`w-5 h-5 text-ink-3 transition-transform ${reviewOpen ? "rotate-180" : ""}`} />
            </button>
            {reviewOpen && (
              <ul className="border-t border-line divide-y divide-line">
                {missed.map(i => {
                  const mq = questions[i];
                  return (
                    <li key={i} className="p-5 sm:p-6 space-y-3">
                      <p className="text-xs font-bold text-ink-3">Question {i + 1} · {mq.topic}</p>
                      <p className="text-[15px] font-semibold leading-relaxed">{mq.stem}</p>
                      <div className="grid gap-2 text-sm">
                        <p className="flex gap-2 text-critical"><X className="w-4 h-4 mt-0.5 shrink-0" /> Your answer: {mq.options[answers[i]]}</p>
                        <p className="flex gap-2 text-normal"><Check className="w-4 h-4 mt-0.5 shrink-0" /> Correct: {mq.options[mq.answerIndex]}</p>
                      </div>
                      <p className="text-sm text-ink-2 leading-relaxed">{mq.explanation}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    );
  }

  // ---------- Exam ----------
  const progressPct = (answeredCount / total) * 100;

  const navigator = (
    <div className="space-y-4">
      <div className="flex items-center text-sm">
        <span className="flex-1 font-bold">Questions</span>
        <span className="text-ink-3">{answeredCount}/{total} answered</span>
      </div>
      <div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-6 gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const loaded = i < questions.length;
          const done = checked[i];
          const right = done && answers[i] === questions[i]?.answerIndex;
          return (
            <button
              key={i}
              disabled={!loaded}
              onClick={() => { setCurrent(i); setShowMap(false); }}
              aria-label={`Question ${i + 1}${done ? (right ? ", correct" : ", incorrect") : ""}`}
              aria-current={i === current ? "true" : undefined}
              className={`h-8 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer disabled:cursor-wait ${
                !loaded ? "border border-dashed border-line text-ink-3/50" :
                done ? (right ? "bg-normal/20 text-normal" : "bg-critical/20 text-critical") :
                "bg-surface-2 text-ink-2 hover:text-ink"
              } ${i === current ? "ring-2 ring-accent" : ""}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {loadingMore && (
        <p className="flex items-center gap-2 text-xs text-ink-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading more questions…</p>
      )}
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm">
        <span className="text-ink-2">Score so far</span>
        <span className="font-mono font-bold">{answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0}%</span>
      </div>
      <button onClick={finishExam} className="btn-secondary w-full"><FlagIcon className="w-4 h-4" /> Finish exam</button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={leaveExam} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink cursor-pointer" aria-label="Leave exam">
            <ArrowLeft className="w-[18px] h-[18px]" /> <span className="hidden sm:inline">{topic ? topic.name : cat.name}</span>
          </button>
          <span className="flex-1 text-sm font-bold sm:text-center">Question {current + 1} of {total}</span>
          <button onClick={() => setShowMap(s => !s)} className="lg:hidden p-2 rounded-lg border border-line bg-surface text-ink-2 cursor-pointer" aria-label="Question map" aria-expanded={showMap}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm text-ink-2">
            <Clock className="w-4 h-4" /> {formatClock(elapsed)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={answeredCount} aria-valuemin={0} aria-valuemax={total}>
          <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {(notice || isDemo) && (
        <div className="rounded-xl border border-xp/30 bg-xp/8 p-3.5 text-sm text-ink-2 flex items-start gap-2.5" role="status">
          <TriangleAlert className="w-4 h-4 text-xp shrink-0 mt-0.5" />
          {notice || "Demo mode: questions come from the built-in bank."}
        </div>
      )}

      {showMap && <div className="lg:hidden card p-4">{navigator}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 lg:gap-6 items-start">
        <section className="card p-5 sm:p-7 min-h-[420px]" aria-live="polite">
          {!q ? (
            <div className="h-full min-h-[360px] flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
              <p className="text-sm text-ink-3">Loading the next questions…</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={current} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.18 }} className="space-y-5">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${cat.tint}`}>{q.topic}</span>
                <h2 className="text-lg sm:text-xl font-bold leading-relaxed">{q.stem}</h2>

                {q.labData.length > 0 && (
                  <div className="rounded-xl border border-line overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
                        <tr>
                          <th className="px-4 py-2 font-bold">Test</th>
                          <th className="px-3 py-2 font-bold">Result</th>
                          <th className="hidden sm:table-cell px-3 py-2 font-bold">Reference</th>
                          <th className="px-4 py-2 font-bold text-right sm:text-left">Flag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.labData.map((r, i) => (
                          <tr key={i} className="border-t border-line">
                            <td className="px-4 py-2.5 font-semibold">
                              {r.parameter}
                              <span className="sm:hidden block font-mono text-xs font-normal text-ink-3 mt-0.5">Ref {r.referenceRange}</span>
                            </td>
                            <td className="px-3 py-2.5 font-mono font-bold">{r.result}</td>
                            <td className="hidden sm:table-cell px-3 py-2.5 font-mono text-[13px] text-ink-3">{r.referenceRange}</td>
                            <td className="px-4 py-2.5 text-right sm:text-left">
                              <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${flagTone(r.status)}`}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="space-y-2.5" role="radiogroup" aria-label="Answer options">
                  {q.options.map((opt, i) => {
                    const isSel = selected === i;
                    const isRight = i === q.answerIndex;
                    let cls = "border-line bg-surface-2 hover:border-ink-3";
                    let badge = "border border-line bg-surface text-ink-2";
                    if (!isChecked && isSel) { cls = "border-accent border-2 bg-accent/10"; badge = "bg-accent text-accent-ink"; }
                    if (isChecked && isRight) { cls = "border-normal border-2 bg-normal/10"; badge = "bg-normal text-accent-ink"; }
                    if (isChecked && isSel && !isRight) { cls = "border-critical border-2 bg-critical/10"; badge = "bg-critical text-accent-ink"; }
                    if (isChecked && !isSel && !isRight) cls = "border-line bg-surface-2 opacity-60";
                    return (
                      <button
                        key={i}
                        role="radio"
                        aria-checked={isSel}
                        disabled={isChecked}
                        onClick={() => setAnswers(prev => ({ ...prev, [current]: i }))}
                        className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer disabled:cursor-default ${cls}`}
                      >
                        <span className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-[13px] font-bold ${badge}`}>
                          {isChecked && isRight ? <Check className="w-4 h-4" strokeWidth={3} /> : isChecked && isSel ? <X className="w-4 h-4" strokeWidth={3} /> : LETTERS[i]}
                        </span>
                        <span className={`text-[15px] leading-snug ${isSel || (isChecked && isRight) ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {isChecked && (
                  <div className={`rounded-xl border p-4 space-y-1.5 animate-fadeIn ${selected === q.answerIndex ? "border-normal/40 bg-normal/8" : "border-critical/40 bg-critical/8"}`}>
                    <p className={`text-sm font-bold ${selected === q.answerIndex ? "text-normal" : "text-critical"}`}>
                      {selected === q.answerIndex ? "Correct" : `Not quite — the answer is ${LETTERS[q.answerIndex]}`}
                    </p>
                    <p className="text-sm text-ink-2 leading-relaxed">{q.explanation}</p>
                  </div>
                )}

                <div className="flex items-center gap-2.5 pt-1">
                  {current > 0 && (
                    <button onClick={() => setCurrent(current - 1)} className="btn-secondary px-3.5" aria-label="Previous question"><ArrowLeft className="w-4 h-4" /></button>
                  )}
                  {!isChecked ? (
                    <button onClick={() => setChecked(prev => ({ ...prev, [current]: true }))} disabled={selected === undefined} className="btn-primary flex-1">
                      Check answer
                    </button>
                  ) : (
                    <button onClick={goNext} className="btn-primary flex-1">
                      {current + 1 < total ? <>Next question <ArrowRight className="w-4 h-4" /></> : <>See results <FlagIcon className="w-4 h-4" /></>}
                    </button>
                  )}
                </div>
                <p className="hidden sm:block text-xs text-ink-3 text-center">Tip: press 1–4 to choose and Enter to check.</p>
              </motion.div>
            </AnimatePresence>
          )}
        </section>

        <aside className="hidden lg:block card p-5 lg:sticky lg:top-6">{navigator}</aside>
      </div>
    </div>
  );
}
