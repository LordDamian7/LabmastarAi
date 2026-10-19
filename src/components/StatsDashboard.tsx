import React, { useEffect, useState } from "react";
import { UserProgress, Badge } from "../types";
import {
  Flame,
  Zap,
  Target,
  Trophy,
  Clock,
  ArrowRight,
  Check,
  TestTube,
  Droplet,
  Microscope,
  Syringe,
  Dna,
  Gift
} from "lucide-react";
import { motion } from "motion/react";
import BadgeMedal from "./BadgeMedal";
import { BADGE_MIN_QUESTIONS } from "./QuizExercise";
import { TOPIC_ICONS, TOPIC_BADGE_SCORE, TOPIC_BADGE_MIN_QUESTIONS, findTopic } from "../lib/badges";

const BADGE_SCORE = 85;
/** Earned badges spin once on load, then again every this many ms. */
const SPIN_INTERVAL_MS = 45_000;

const topicName = (topicId: string) => findTopic(topicId)?.topic.name ?? "";

/** Ticks every SPIN_INTERVAL_MS while the tab is visible. */
function useSpinTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) setTick(n => n + 1);
    }, SPIN_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);
  return tick;
}

interface StatsDashboardProps {
  progress: UserProgress;
  userName: string;
  onClaimGoal: (goalId: string) => void;
  allBadges: Badge[];
  onStartCase: (category: string) => void;
  onNavigate: (tab: "dashboard" | "simulator" | "professor" | "library") => void;
}

const DISCIPLINES = [
  { id: "chemistry", name: "Clinical Chemistry", key: "chemistryScore", bar: "bg-accent", icon: TestTube, blurb: "electrolytes, enzymes and delta checks" },
  { id: "hematology", name: "Hematology", key: "hematologyScore", bar: "bg-critical", icon: Droplet, blurb: "CBC differentials, smears and coagulation" },
  { id: "microbiology", name: "Microbiology", key: "microbiologyScore", bar: "bg-normal", icon: Microscope, blurb: "stains, cultures and biochemical ID" },
  { id: "bloodbank", name: "Blood Bank", key: "bloodbankScore", bar: "bg-low", icon: Syringe, blurb: "ABO typing, antibody ID and crossmatching" },
  { id: "immunology", name: "Immunology", key: "immunologyScore", bar: "bg-violet", icon: Dna, blurb: "ANA patterns, titers and ELISA" }
] as const;

const rankTitle = (level: number) =>
  level >= 7 ? "Chief Resident" : level >= 5 ? "Senior Scientist" : level >= 3 ? "Lab Resident" : "Trainee Tech";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

function ProgressBar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={`h-full rounded-full ${className}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export default function StatsDashboard({ progress, userName, onClaimGoal, allBadges, onStartCase, onNavigate }: StatsDashboardProps) {
  const xpToNext = progress.xpNeededForNextLevel - progress.xp;
  const xpPct = (progress.xp / progress.xpNeededForNextLevel) * 100;

  // Recommend the weakest discipline as today's exam.
  const scored = DISCIPLINES.map(d => ({ ...d, score: (progress[d.key] as number) || 0 }));
  const focus = [...scored].sort((a, b) => a.score - b.score)[0];

  const goalsDone = progress.dailyGoals.filter(g => g.current >= g.target).length;
  const medals = allBadges.filter(b => !b.topicId);
  const topicBadges = allBadges.filter(b => b.topicId);
  const nextBadge = medals.find(b => !progress.unlockedBadges.includes(b.id)) || topicBadges.find(b => !progress.unlockedBadges.includes(b.id));
  const spinTick = useSpinTick();
  const firstName = userName.split(/\s+/)[0];

  return (
    <div className="space-y-6 lg:space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="text-[15px] text-ink-2 mt-1">
            You're {xpToNext} XP away from Level {progress.level + 1}. One practice exam should do it.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full border border-xp/35 bg-xp/12 px-3.5 py-2">
          <Flame className="w-[18px] h-[18px] text-xp" />
          <span className="text-sm font-bold text-xp">
            {progress.streakCount}-day streak
          </span>
        </div>
      </div>

      {/* Today's exam */}
      <section className="relative overflow-hidden rounded-2xl border border-accent/35 bg-surface p-6 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/15 via-transparent to-transparent" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold tracking-[0.06em] text-accent">
              <Zap className="w-3.5 h-3.5" /> TODAY'S FOCUS · {focus.name.toUpperCase()}
            </span>
            <h2 className="text-xl sm:text-[22px] font-bold tracking-tight">
              Sharpen your {focus.name} skills — your lowest score at {focus.score}%
            </h2>
            <p className="text-[15px] text-ink-2 leading-relaxed max-w-2xl">
              A board-style practice exam covering {focus.blurb}. Instant feedback on every question and a full score report at the end.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink-3">
              <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" /> ~45 min</span>
              <span className="inline-flex items-center gap-1.5"><Target className="w-4 h-4" /> 50 questions</span>
              <span className="inline-flex items-center gap-1.5"><Zap className="w-4 h-4" /> up to +175 XP</span>
            </div>
          </div>
          <button onClick={() => onStartCase(focus.id)} className="btn-primary self-start md:self-center px-6 py-3.5 text-[15px]">
            Start exam <ArrowRight className="w-[18px] h-[18px]" />
          </button>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5">
        <div className="card p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-accent/14 flex items-center justify-center"><Zap className="w-[18px] h-[18px] text-accent" /></span>
            <span className="text-sm font-semibold text-ink-2">Level {progress.level} · {rankTitle(progress.level)}</span>
          </div>
          <p className="text-3xl font-extrabold tracking-tight">
            {progress.xp}<span className="text-ink-3 text-xl font-bold"> / {progress.xpNeededForNextLevel} XP</span>
          </p>
          <ProgressBar pct={xpPct} className="bg-accent" />
          <p className="text-sm text-ink-3">{xpToNext} XP to Level {progress.level + 1}</p>
        </div>

        <div className="card p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-violet/14 flex items-center justify-center"><Target className="w-[18px] h-[18px] text-violet" /></span>
            <span className="text-sm font-semibold text-ink-2">Exams completed</span>
          </div>
          <p className="text-3xl font-extrabold tracking-tight">{progress.completedExercisesCount}</p>
          <p className="text-sm text-ink-3">
            {progress.completedExercisesCount === 0 ? "Finish your first exam to start your record." : "Every exam adds XP and sharpens your scores."}
          </p>
        </div>

        <div className="card p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-xp/14 flex items-center justify-center"><Trophy className="w-[18px] h-[18px] text-xp" /></span>
            <span className="text-sm font-semibold text-ink-2">Badges earned</span>
          </div>
          <p className="text-3xl font-extrabold tracking-tight">
            {progress.unlockedBadges.length}<span className="text-ink-3 text-xl font-bold"> of {allBadges.length}</span>
          </p>
          <ProgressBar pct={(progress.unlockedBadges.length / allBadges.length) * 100} className="bg-xp" />
          <p className="text-sm text-ink-3">{nextBadge ? `Next: ${nextBadge.name} — ${nextBadge.requirement.charAt(0).toLowerCase()}${nextBadge.requirement.slice(1)}` : "All badges earned. Legendary."}</p>
        </div>
      </div>

      {/* Goals + competency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        <section className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center">
            <h3 className="text-lg font-bold flex-1">Today's goals</h3>
            <span className="text-sm font-semibold text-accent">{goalsDone} of {progress.dailyGoals.length} done</span>
          </div>
          <ul className="space-y-3">
            {progress.dailyGoals.map(goal => {
              const reached = goal.current >= goal.target;
              const claimable = reached && !goal.completed;
              return (
                <li key={goal.id} className="flex items-center gap-3.5 rounded-xl bg-surface-2 p-3.5">
                  <span className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center ${reached ? "bg-accent" : "border border-line"}`}>
                    {reached && <Check className="w-4 h-4 text-accent-ink" strokeWidth={3} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[15px] font-semibold ${goal.completed ? "text-ink-2" : "text-ink"}`}>{goal.title}</p>
                    <p className="text-xs font-bold text-xp mt-0.5">+{goal.rewardXp} XP</p>
                  </div>
                  {claimable ? (
                    <button onClick={() => onClaimGoal(goal.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-xp px-3 py-2 text-xs font-bold text-accent-ink hover:bg-xp/90 cursor-pointer">
                      <Gift className="w-3.5 h-3.5" /> Claim
                    </button>
                  ) : (
                    <span className="font-mono text-sm font-medium text-ink-3">{goal.current}/{goal.target}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center">
            <h3 className="text-lg font-bold flex-1">Competency by discipline</h3>
            <button onClick={() => onNavigate("simulator")} className="text-sm font-semibold text-accent hover:underline cursor-pointer">Practice</button>
          </div>
          <ul className="space-y-4">
            {scored.map(d => (
              <li key={d.id}>
                <button onClick={() => onStartCase(d.id)} className="w-full text-left group cursor-pointer space-y-2">
                  <div className="flex items-center">
                    <span className="flex-1 text-sm font-semibold group-hover:text-accent transition-colors">{d.name}</span>
                    <span className="font-mono text-sm font-medium text-ink-2">{d.score}%</span>
                  </div>
                  <ProgressBar pct={d.score} className={d.bar} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Badges */}
      <section className="card p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold">Discipline medals</h3>
            <p className="text-sm text-ink-3 mt-0.5">Score {BADGE_SCORE}%+ on a {BADGE_MIN_QUESTIONS}+ question discipline exam to earn each medal.</p>
          </div>
          <span className="text-sm font-semibold text-xp">{medals.filter(b => progress.unlockedBadges.includes(b.id)).length} / {medals.length} earned</span>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {medals.map((badge, i) => {
            const earned = progress.unlockedBadges.includes(badge.id);
            const discipline = DISCIPLINES.find(d => d.id === badge.category);
            const best = discipline ? (progress[discipline.key] as number) || 0 : 0;
            return (
              <li key={badge.id}>
                <button
                  onClick={() => !earned && onStartCase(badge.category)}
                  disabled={earned}
                  title={earned ? badge.description : `${badge.requirement} — start an exam`}
                  className={`group w-full h-full rounded-2xl border p-4 pt-6 flex flex-col items-center text-center gap-3 transition-colors ${
                    earned ? "border-xp/40 bg-gradient-to-b from-xp/10 to-transparent cursor-default" : "border-line bg-surface-2 hover:border-accent/50"
                  }`}
                >
                  <BadgeMedal category={badge.category} earned={earned} progress={best / BADGE_SCORE} size={84} spinKey={spinTick} spinDelay={i * 0.15} />
                  <div className="space-y-1 mt-1">
                    <p className={`text-sm font-bold leading-tight ${earned ? "text-ink" : "text-ink-2"}`}>{badge.name}</p>
                    <p className="text-xs text-ink-3">{discipline?.name}</p>
                  </div>
                  {earned ? (
                    <span className="mt-auto inline-flex items-center gap-1 rounded-full bg-xp/15 px-2.5 py-1 text-xs font-bold text-xp">
                      <Check className="w-3.5 h-3.5" /> Earned
                    </span>
                  ) : (
                    <span className="mt-auto w-full space-y-1.5">
                      <span className="flex justify-between text-xs font-semibold">
                        <span className="text-ink-3">Best {best}%</span>
                        <span className="text-ink-2">{BADGE_SCORE}%</span>
                      </span>
                      <ProgressBar pct={(best / BADGE_SCORE) * 100} className="bg-accent" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Topic badges */}
      <section className="card p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold">Topic badges</h3>
            <p className="text-sm text-ink-3 mt-0.5">Pass a single-topic exam ({TOPIC_BADGE_SCORE}%+ on {TOPIC_BADGE_MIN_QUESTIONS}+ questions) to earn its badge.</p>
          </div>
          <span className="text-sm font-semibold text-xp">{topicBadges.filter(b => progress.unlockedBadges.includes(b.id)).length} / {topicBadges.length} earned</span>
        </div>
        <div className="space-y-5">
          {DISCIPLINES.map((d, di) => {
            const badges = topicBadges.filter(b => b.category === d.id);
            return (
              <div key={d.id} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <d.icon className="w-4 h-4 text-ink-3" />
                  <h4 className="text-sm font-bold text-ink-2">{d.name}</h4>
                  <span className="text-xs text-ink-3">· {badges.filter(b => progress.unlockedBadges.includes(b.id)).length}/{badges.length}</span>
                </div>
                <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                  {badges.map((badge, i) => {
                    const earned = progress.unlockedBadges.includes(badge.id);
                    const best = progress.topicScores?.[badge.topicId!];
                    return (
                      <li key={badge.id}>
                        <button
                          onClick={() => !earned && onStartCase(badge.topicId!)}
                          disabled={earned}
                          title={earned ? `${badge.name} — ${badge.description}` : `${badge.requirement} — start this topic exam`}
                          className={`group w-full h-full rounded-xl border px-2 pt-4 pb-3 flex flex-col items-center text-center gap-2 transition-colors ${
                            earned ? "border-xp/35 bg-gradient-to-b from-xp/8 to-transparent cursor-default" : "border-line bg-surface-2 hover:border-accent/50"
                          }`}
                        >
                          <BadgeMedal
                            category={badge.category}
                            earned={earned}
                            shape="coin"
                            icon={TOPIC_ICONS[badge.topicId!]}
                            progress={(best || 0) / TOPIC_BADGE_SCORE}
                            size={60}
                            spinKey={spinTick}
                            spinDelay={0.8 + di * 0.25 + i * 0.08}
                          />
                          <span className={`mt-1 text-xs font-bold leading-tight ${earned ? "text-ink" : "text-ink-2"}`}>{badge.name}</span>
                          <span className="text-[11px] leading-tight text-ink-3">
                            {earned ? "Earned" : best !== undefined ? `Best ${best}%` : topicName(badge.topicId!)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
