import React, { useState, useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { UserProgress, Badge, DailyGoal, Message, StudyMaterial } from "./types";
import { supabase, STUDY_BUCKET } from "./lib/supabase";
import { apiFetch, apiError } from "./lib/api";
import StatsDashboard from "./components/StatsDashboard";
import QuizExercise from "./components/QuizExercise";
import MLSProfessorChat from "./components/MLSProfessorChat";
import RAGStudyLibrary from "./components/RAGStudyLibrary";
import LoginPage from "./components/LoginPage";
import {
  LayoutDashboard,
  FlaskConical,
  MessageSquare,
  BookOpen,
  LogOut,
  Loader2,
  Trophy,
  GraduationCap,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const INITIAL_BADGES: Badge[] = [
  {
    id: "chem_badge",
    name: "Enzyme Detective",
    description: "Successfully diagnosed pre-analytical hemolysis delta-checks and severe isolated potassium discrepancies.",
    unlockedAt: null,
    iconName: "test-tube",
    requirement: "Score 85% or higher on Clinical Chemistry",
    category: "chemistry"
  },
  {
    id: "hem_badge",
    name: "WBC Smear Specialist",
    description: "Identified neutrophilic left shift Döhle bodies and rough endoplasmic reticulum sheets under slide magnification.",
    unlockedAt: null,
    iconName: "droplet",
    requirement: "Score 85% or higher on Hematology",
    category: "hematology"
  },
  {
    id: "micro_badge",
    name: "Microbial Profiler",
    description: "Successfully differentiated enterogenous Gram-negative rods on MacConkey agar cultures using indole profiling.",
    unlockedAt: null,
    iconName: "virus",
    requirement: "Score 85% or higher on Medical Microbiology",
    category: "microbiology"
  },
  {
    id: "bb_badge",
    name: "Immunohematology Officer",
    description: "Sorted ABO typing discrepancies and resolved cold autoantibodies using the prewarm procedure.",
    unlockedAt: null,
    iconName: "shield",
    requirement: "Score 85% or higher on Blood Bank",
    category: "bloodbank"
  },
  {
    id: "imm_badge",
    name: "Autoantibody Diagnostician",
    description: "Classified indirect IFA antinuclear homogeneous patterns and double-stranded DNA lupus parameters.",
    unlockedAt: null,
    iconName: "dna",
    requirement: "Score 85% or higher on Immunology",
    category: "immunology"
  }
];

type Tab = "dashboard" | "simulator" | "professor" | "library";

const NAV: { id: Tab; label: string; short: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { id: "simulator", label: "Lab Simulator", short: "Lab", icon: FlaskConical },
  { id: "professor", label: "AI Professor", short: "Professor", icon: MessageSquare },
  { id: "library", label: "Study Library", short: "Library", icon: BookOpen }
];

// Which badge each exercise category unlocks.
const CATEGORY_BADGE: Record<string, string> = {
  chemistry: "chem_badge",
  hematology: "hem_badge",
  microbiology: "micro_badge",
  bloodbank: "bb_badge",
  immunology: "imm_badge"
};

const freshDailyGoals = (): DailyGoal[] => [
  { id: "goal_quiz", title: "Solve a clinical lab specimen case", target: 1, current: 0, rewardXp: 50, completed: false, icon: "🔬" },
  { id: "goal_chat", title: "Discuss 2 diagnostic concepts with Professor", target: 2, current: 0, rewardXp: 40, completed: false, icon: "💬" },
  { id: "goal_perfect", title: "Achieve 90%+ in any clinical simulation", target: 1, current: 0, rewardXp: 60, completed: false, icon: "🏆" }
];

const freshProgress = (): UserProgress => ({
  level: 1,
  xp: 0,
  xpNeededForNextLevel: 100,
  streakCount: 1,
  lastDailyReset: new Date().toISOString(),
  chemistryScore: 35,
  hematologyScore: 25,
  microbiologyScore: 40,
  bloodbankScore: 20,
  immunologyScore: 50,
  unlockedBadges: [],
  completedExercisesCount: 0,
  dailyGoals: freshDailyGoals()
});

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// New calendar day since the last visit: refresh daily goals and update the streak
// (consecutive day keeps it going, a missed day restarts it at 1).
const rollDailyState = (p: UserProgress): UserProgress => {
  const now = new Date();
  const last = new Date(p.lastDailyReset);
  if (dayKey(last) === dayKey(now)) return p;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const streakCount = dayKey(last) === dayKey(yesterday) ? p.streakCount + 1 : 1;
  return { ...p, streakCount, lastDailyReset: now.toISOString(), dailyGoals: freshDailyGoals() };
};

// Adds XP, rolling over as many levels as the amount covers.
const applyXp = (p: UserProgress, amount: number): UserProgress => {
  let xp = p.xp + amount;
  let level = p.level;
  let threshold = p.xpNeededForNextLevel;
  while (xp >= threshold) {
    xp -= threshold;
    level += 1;
    threshold = Math.round(threshold * 1.35); // level scalable limits
  }
  return { ...p, xp, level, xpNeededForNextLevel: threshold };
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  // Category the dashboard asked the simulator to open straight away.
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Gamified Milestones animations
  const [levelUpModal, setLevelUpModal] = useState<number | null>(null);
  const [newBadgeModal, setNewBadgeModal] = useState<Badge | null>(null);

  // Last progress snapshot seen, used to detect level-ups/badges and skip redundant saves.
  const lastProgressRef = useRef<UserProgress | null>(null);

  const userId = session?.user.id ?? null;
  const currentUser = session
    ? {
        email: session.user.email ?? "",
        name: (session.user.user_metadata?.full_name as string | undefined) || (session.user.email ?? "").split("@")[0].toUpperCase()
      }
    : null;

  // Track the Supabase auth session.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      // Arrived from a "forgot password" email link: let the user choose a new one.
      if (event === "PASSWORD_RECOVERY") {
        setTimeout(async () => {
          const newPassword = window.prompt("Choose a new password (at least 8 characters):");
          if (!newPassword) return;
          if (newPassword.length < 8) {
            alert("Password must be at least 8 characters. Request another reset link to try again.");
            return;
          }
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          alert(error ? `Could not update password: ${error.message}` : "Password updated.");
        }, 0);
      }
    });

    // Verify Gemini backend engine mode
    fetch("/api/status")
      .then(res => res.json())
      .then(data => {
        setIsSimulationMode(data.status === "simulation");
      })
      .catch(() => setIsSimulationMode(true));

    return () => listener.subscription.unsubscribe();
  }, []);

  // Load the signed-in user's progress, chat history, and study library.
  useEffect(() => {
    if (!userId) {
      setProgress(null);
      setMessages([]);
      setStudyMaterials([]);
      lastProgressRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadError(null);
      const [progressRes, chatRes, materialsRes] = await Promise.all([
        supabase.from("user_progress").select("data").eq("user_id", userId).maybeSingle(),
        supabase.from("chat_messages").select("id, role, content, created_at").order("created_at", { ascending: true }).limit(500),
        supabase
          .from("study_materials")
          .select("id, file_name, file_type, file_size, storage_path, summary, pages, words, created_at")
          .order("created_at", { ascending: false })
      ]);
      if (cancelled) return;
      const failure = progressRes.error || chatRes.error || materialsRes.error;
      if (failure) {
        setLoadError(failure.message);
        return;
      }

      let loaded = progressRes.data?.data as UserProgress | undefined;
      if (!loaded) {
        // First sign-in: carry over progress from the old browser-only version if present.
        try {
          const legacy = localStorage.getItem("labmaster_progress_v2");
          loaded = legacy ? JSON.parse(legacy) : undefined;
        } catch {
          loaded = undefined;
        }
        loaded = loaded ?? freshProgress();
        await supabase.from("user_progress").upsert({ user_id: userId, data: loaded });
        try {
          ["labmaster_progress_v2", "labmaster_chats", "labmaster_user_v2"].forEach(k => localStorage.removeItem(k));
        } catch { /* storage unavailable */ }
      }
      if (cancelled) return;
      lastProgressRef.current = loaded;
      // Applied as a normal update so the daily rollover gets saved.
      setProgress(rollDailyState(loaded));

      setMessages((chatRes.data || []).map(row => ({
        id: row.id,
        role: row.role as Message["role"],
        content: row.content,
        timestamp: new Date(row.created_at)
      })));

      setStudyMaterials((materialsRes.data || []).map(row => ({
        id: row.id,
        fileName: row.file_name,
        fileType: row.file_type,
        fileSize: row.file_size,
        storagePath: row.storage_path,
        summary: row.summary ?? undefined,
        uploadedAt: row.created_at,
        pages: row.pages ?? undefined,
        words: row.words ?? undefined
      })));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Persist progress whenever it changes (debounced), and surface level-ups / new badges.
  useEffect(() => {
    if (!progress || !userId) return;
    const previous = lastProgressRef.current;
    if (previous === progress) return;
    lastProgressRef.current = progress;

    if (previous) {
      if (progress.level > previous.level) setLevelUpModal(progress.level);
      const newBadgeId = progress.unlockedBadges.find(id => !previous.unlockedBadges.includes(id));
      const newBadge = newBadgeId && INITIAL_BADGES.find(b => b.id === newBadgeId);
      if (newBadge) setNewBadgeModal(newBadge);
    }

    const timer = setTimeout(() => {
      supabase
        .from("user_progress")
        .upsert({ user_id: userId, data: progress, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error("Failed to save progress:", error.message);
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [progress, userId]);

  // All progress changes go through a functional update so back-to-back changes
  // (e.g. XP award followed by goal increments) never overwrite each other.
  const updateProgress = (fn: (p: UserProgress) => UserProgress) => {
    setProgress(prev => (prev ? fn(prev) : prev));
  };

  const handleLogout = async () => {
    if (confirm("Disconnect and log out of this working clinical session?")) {
      await supabase.auth.signOut();
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !progress || !userId) return;

    // Build the user message object
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date()
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsGenerating(true);
    supabase.from("chat_messages").insert({ id: userMsg.id, user_id: userId, role: "user", content: text })
      .then(({ error }) => { if (error) console.error("Failed to save message:", error.message); });

    const assistantId = crypto.randomUUID();
    let assistantText = "";
    const showAssistant = (content: string) => {
      setMessages(prev => {
        const without = prev.filter(m => m.id !== assistantId);
        return [...without, { id: assistantId, role: "assistant", content, timestamp: new Date() }];
      });
    };

    try {
      const response = await apiFetch("/api/chat", {
        messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        materialIds: studyMaterials.map(m => m.id)
      });

      if (!response.ok || !response.body) throw await apiError(response, "Could not relay query to professor.");

      // Render the reply as it streams in.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        showAssistant(assistantText);
      }
      assistantText += decoder.decode();
      showAssistant(assistantText);

      if (assistantText.trim()) {
        const { error } = await supabase
          .from("chat_messages")
          .insert({ id: assistantId, user_id: userId, role: "assistant", content: assistantText });
        if (error) console.error("Failed to save reply:", error.message);
      }
    } catch (err: any) {
      console.error(err);
      // Shown in the chat but not saved, so a retry starts clean.
      showAssistant(`⚠️ ${err.message || "Could not reach the professor. Please try again."}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearChatHistory = async () => {
    if (confirm("Reset conversation logs with Professor LabMaster?")) {
      const { error } = await supabase.from("chat_messages").delete().eq("user_id", userId);
      if (error) {
        alert(`Could not clear chat: ${error.message}`);
        return;
      }
      setMessages([]);
    }
  };

  const handleRemoveMaterial = async (id: string) => {
    const material = studyMaterials.find(m => m.id === id);
    if (!material) return;
    const { error } = await supabase.from("study_materials").delete().eq("id", id);
    if (error) {
      alert(`Could not remove file: ${error.message}`);
      return;
    }
    setStudyMaterials(prev => prev.filter(m => m.id !== id));
    const { error: storageError } = await supabase.storage.from(STUDY_BUCKET).remove([material.storagePath]);
    if (storageError) console.error("Failed to delete stored file:", storageError.message);
  };

  const handleClaimGoalReward = (goalId: string) => {
    updateProgress(p => {
      const goal = p.dailyGoals.find(g => g.id === goalId);
      if (!goal || goal.completed) return p;
      const dailyGoals = p.dailyGoals.map(g => (g.id === goalId ? { ...g, completed: true } : g));
      return applyXp({ ...p, dailyGoals }, goal.rewardXp);
    });
  };

  const handleIncrementGoalValue = (actionType: string) => {
    const goalForAction: Record<string, string> = {
      chat_ask: "goal_chat",
      exercise_complete: "goal_quiz",
      score_90: "goal_perfect"
    };
    const goalId = goalForAction[actionType];
    if (!goalId) return;
    updateProgress(p => ({
      ...p,
      dailyGoals: p.dailyGoals.map(g => (g.id === goalId ? { ...g, current: Math.min(g.target, g.current + 1) } : g))
    }));
  };

  const handleAwardXpOnExerciseScore = (amount: number, categoryKey: string = "chemistry", score: number = 0) => {
    updateProgress(p => {
      const scoreKey = `${categoryKey}Score` as keyof UserProgress;
      const originalScore = (p[scoreKey] as number | undefined) || 0;
      const updated: UserProgress = {
        ...p,
        completedExercisesCount: p.completedExercisesCount + 1,
        [scoreKey]: Math.max(originalScore, score)
      };

      // Badge qualification: score threshold >= 85%
      const badgeId = CATEGORY_BADGE[categoryKey];
      if (score >= 85 && badgeId && !p.unlockedBadges.includes(badgeId)) {
        updated.unlockedBadges = [...p.unlockedBadges, badgeId];
      }

      return applyXp(updated, amount);
    });
  };

  const startCase = (category: string) => {
    setPendingCategory(category);
    setActiveTab("simulator");
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md p-6 text-center space-y-4">
          <p className="text-ink">Couldn't load your lab data.</p>
          <p className="text-sm text-ink-3">{loadError}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">Try again</button>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <span className="text-sm text-ink-3">Loading your lab…</span>
      </div>
    );
  }

  const initials = currentUser.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "ST";

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-line bg-surface px-5 py-7">
        <div className="flex items-center gap-3 px-1">
          <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-accent-ink" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight leading-none">LabMaster</p>
            <p className="text-xs font-medium text-ink-3 mt-1">MLS training lab</p>
          </div>
        </div>

        <nav className="mt-8 space-y-1" aria-label="Main">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={active ? "page" : undefined}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] transition-colors cursor-pointer ${
                  active ? "bg-accent/12 text-accent font-bold" : "text-ink-2 font-medium hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            );
          })}
        </nav>

        {isSimulationMode && (
          <div className="mt-6 rounded-xl border border-xp/30 bg-xp/8 p-3.5">
            <p className="text-xs font-bold text-xp">Demo AI mode</p>
            <p className="text-xs text-ink-3 mt-1 leading-relaxed">Answers and cases come from a built-in set until a Gemini key is added.</p>
          </div>
        )}

        <div className="mt-auto flex items-center gap-3 rounded-xl bg-surface-2 p-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-violet text-accent-ink flex items-center justify-center text-sm font-bold">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{currentUser.name}</p>
            <p className="text-xs text-ink-3">Level {progress.level}</p>
          </div>
          <button onClick={handleLogout} title="Sign out" aria-label="Sign out" className="p-1.5 rounded-lg text-ink-3 hover:text-critical hover:bg-critical/10 cursor-pointer">
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/90 backdrop-blur px-4 py-3">
        <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
          <FlaskConical className="w-[18px] h-[18px] text-accent-ink" />
        </div>
        <p className="font-extrabold tracking-tight flex-1">LabMaster</p>
        {isSimulationMode && <span className="rounded-full border border-xp/30 bg-xp/10 px-2.5 py-1 text-xs font-bold text-xp">Demo AI</span>}
        <button onClick={handleLogout} aria-label="Sign out" className="p-2 rounded-lg text-ink-3 hover:text-critical cursor-pointer">
          <LogOut className="w-[18px] h-[18px]" />
        </button>
      </header>

      <main className="flex-1 lg:ml-64 min-w-0">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 pt-6 lg:pt-9 pb-28 lg:pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "dashboard" && (
                <StatsDashboard
                  progress={progress}
                  userName={currentUser.name}
                  onClaimGoal={handleClaimGoalReward}
                  allBadges={INITIAL_BADGES}
                  onStartCase={startCase}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === "simulator" && (
                <QuizExercise
                  onAwardXp={handleAwardXpOnExerciseScore}
                  onIncrementGoal={handleIncrementGoalValue}
                  studyMaterials={studyMaterials}
                  pendingCategory={pendingCategory}
                  onPendingCategoryHandled={() => setPendingCategory(null)}
                />
              )}

              {activeTab === "professor" && (
                <MLSProfessorChat
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isGeneratingMessage={isGenerating}
                  onIncrementGoal={handleIncrementGoalValue}
                  onClearHistory={clearChatHistory}
                  materialCount={studyMaterials.length}
                  onOpenLibrary={() => setActiveTab("library")}
                />
              )}

              {activeTab === "library" && (
                <RAGStudyLibrary
                  userId={userId!}
                  studyMaterials={studyMaterials}
                  onAddMaterial={(mat) => setStudyMaterials(prev => [mat, ...prev])}
                  onRemoveMaterial={handleRemoveMaterial}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        {NAV.map(({ id, short, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 pt-2.5 pb-3 text-xs cursor-pointer ${active ? "text-accent font-bold" : "text-ink-3 font-medium"}`}
            >
              <Icon className="w-[22px] h-[22px]" />
              {short}
            </button>
          );
        })}
      </nav>

      {/* Level up */}
      <AnimatePresence>
        {levelUpModal !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-md p-4"
            role="dialog" aria-modal="true" aria-labelledby="levelup-title"
          >
            <motion.div initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} className="card max-w-sm w-full p-8 text-center space-y-5 border-accent/40">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-accent/15 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-accent" />
              </div>
              <div className="space-y-1">
                <p className="eyebrow text-accent">Level up</p>
                <h2 id="levelup-title" className="text-3xl font-extrabold tracking-tight">Level {levelUpModal}</h2>
                <p className="text-sm text-ink-2">Nice work — harder cases are now in your rotation.</p>
              </div>
              <button onClick={() => setLevelUpModal(null)} className="btn-primary w-full">Keep going</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New badge */}
      <AnimatePresence>
        {newBadgeModal !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-md p-4"
            role="dialog" aria-modal="true" aria-labelledby="badge-title"
          >
            <motion.div initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} className="card max-w-sm w-full p-8 text-center space-y-5 border-xp/40">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-xp/15 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-xp" />
              </div>
              <div className="space-y-1">
                <p className="eyebrow text-xp flex items-center justify-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Badge earned</p>
                <h2 id="badge-title" className="text-2xl font-extrabold tracking-tight">{newBadgeModal.name}</h2>
                <p className="text-sm text-ink-2 leading-relaxed">{newBadgeModal.description}</p>
              </div>
              <button onClick={() => setNewBadgeModal(null)} className="btn-primary w-full bg-xp hover:bg-xp/90">Add to my badges</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
