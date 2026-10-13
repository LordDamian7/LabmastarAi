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
  Award, 
  BookOpen, 
  MessageSquare, 
  TrendingUp, 
  Zap, 
  Flame, 
  Layers, 
  Compass, 
  Sparkles,
  Volume2,
  Lock,
  Moon,
  VolumeX,
  Database,
  Loader2,
  LogOut
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
  streakCount: 4, // Nice pre-calibrated default values
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "exercises" | "chat">("dashboard");
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
      // Arrived from a "forgot passcode" email link: let the user choose a new one.
      if (event === "PASSWORD_RECOVERY") {
        setTimeout(async () => {
          const newPassword = window.prompt("Choose a new passcode (at least 8 characters):");
          if (!newPassword) return;
          if (newPassword.length < 8) {
            alert("Passcode must be at least 8 characters. Request another reset link to try again.");
            return;
          }
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          alert(error ? `Could not update passcode: ${error.message}` : "Passcode updated.");
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
      setProgress(loaded);

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

  const forceRefillGoals = () => {
    updateProgress(p => ({ ...p, dailyGoals: freshDailyGoals() }));
    alert("Daily Calibration Protocols have been manually recalculated & refreshed!");
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono p-4">
        <div className="max-w-md text-center space-y-3">
          <p className="text-sm text-rose-300">Could not load your lab data: {loadError}</p>
          <button onClick={() => window.location.reload()} className="text-xs text-teal-400 hover:underline cursor-pointer">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          <span className="text-xs text-slate-400">Loading Hematology Chambers...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-normal select-none text-slate-100 flex flex-col antialiased">
      
      {/* Dynamic Upper Top Status Bar */}
      <div className="bg-slate-950 border-b border-slate-900/80 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Database className="w-3.5 h-3.5" /> Engine:
              <span className={`px-1.5 py-0.5 rounded font-bold ${isSimulationMode ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                {isSimulationMode ? "SIMULATION MODE" : "GEMINI ENHANCED"}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-400">
              <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              Streak Count: <span className="font-bold text-slate-100">{progress.streakCount} days</span>
            </span>
            <span className="text-slate-500 font-bold">|</span>
            <button
              onClick={forceRefillGoals}
              className="text-teal-400 hover:text-teal-300 font-bold hover:underline cursor-pointer"
            >
              🔄 Recalibrate Daily Goals
            </button>
          </div>
        </div>
      </div>

      {/* Primary Header Segment */}
      <header className="bg-slate-900/60 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Brand/Logo Assembly */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-teal-500/20 border border-teal-250">
              🔬
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-extrabold tracking-tight text-white font-sans leading-none">LabMaster AI</h1>
                <span className="text-[10px] font-mono text-emerald-400 font-bold border border-emerald-500/20 px-1.5 py-0.5 rounded bg-emerald-500/5 uppercase leading-none">
                  v3.5
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-1">Medical Laboratory Science Interactive Sandbox</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Miniature telemetry parameters displayed in header */}
            <div className="flex items-center gap-5 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-850">
              <div className="text-left font-mono">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Student Rank</span>
                <p className="text-xs font-bold text-slate-200">Level {progress.level}</p>
              </div>
              <div className="h-6 w-px bg-slate-850" />
              
              <div className="text-left font-mono">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Aggregate XP</span>
                <p className="text-xs font-bold text-teal-400">{progress.xp} pts</p>
              </div>

              <div className="h-6 w-px bg-slate-850" />
              <div className="text-left font-mono">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Badges Unlocks</span>
                <p className="text-xs font-bold text-amber-500">{progress.unlockedBadges.length} / 5</p>
              </div>
            </div>

            {/* Active User session details and logout trigger */}
            {currentUser && (
              <div className="flex items-center gap-3 bg-slate-900 border border-slate-850 rounded-xl px-3 py-1.5 shadow">
                <div className="h-7 w-7 rounded-lg bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold text-[10px]">
                  {currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : "CU"}
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-slate-200 leading-3">{currentUser.name}</p>
                  <p className="text-[9px] font-mono text-slate-500 leading-3 truncate max-w-[120px]">{currentUser.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Log out of clinical session"
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Container Core */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        
        {/* Upper Segmented Navigation Deck */}
        <div className="flex border-b border-slate-850">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-5 py-3 text-sm font-bold font-sans tracking-wide border-b-2 cursor-pointer transition-all flex items-center gap-2 outline-none ${
              activeTab === "dashboard"
                ? "border-teal-400 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-250 hover:border-slate-850"
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Calibration Dashboard
          </button>
          
          <button
            onClick={() => setActiveTab("exercises")}
            className={`px-5 py-3 text-sm font-bold font-sans tracking-wide border-b-2 cursor-pointer transition-all flex items-center gap-2 outline-none ${
              activeTab === "exercises"
                ? "border-teal-400 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-250 hover:border-slate-850"
            }`}
          >
            <Layers className="w-4 h-4" /> Lab Specimen Simulator
          </button>

          <button
            onClick={() => setActiveTab("chat")}
            className={`px-5 py-3 text-sm font-bold font-sans tracking-wide border-b-2 cursor-pointer transition-all flex items-center gap-2 outline-none ${
              activeTab === "chat"
                ? "border-teal-400 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-250 hover:border-slate-850"
            }`}
          >
            <MessageSquare className="w-4 h-4" /> MLS AI Professor Q&A
          </button>
        </div>

        {/* Selected Component Viewport */}
        <div className="min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <StatsDashboard 
                  progress={progress} 
                  onClaimGoal={handleClaimGoalReward} 
                  allBadges={INITIAL_BADGES}
                />
              </motion.div>
            )}

            {activeTab === "exercises" && (
              <motion.div
                key="exercises"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <QuizExercise 
                  onAwardXp={handleAwardXpOnExerciseScore}
                  onIncrementGoal={handleIncrementGoalValue}
                  studyMaterials={studyMaterials}
                />
              </motion.div>
            )}

            {activeTab === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Professor clear option info */}
                <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 flex justify-between items-center gap-4">
                  <div className="text-xs text-slate-400 space-y-0.5">
                    <p className="font-semibold text-slate-300">Consultation Session Active</p>
                    <p className="font-sans text-slate-400">Discuss clinical results, test chemistry steps or ask hematology indicators.</p>
                  </div>
                  <button
                    onClick={clearChatHistory}
                    className="text-[11px] font-mono text-slate-450 hover:text-rose-400 hover:underline border border-dashed border-slate-800 hover:border-rose-500/20 px-2 py-1 rounded cursor-pointer transition-colors"
                  >
                    Clear Discussion Log
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: RAG Study Library */}
                  <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
                    <RAGStudyLibrary 
                      userId={userId!}
                      studyMaterials={studyMaterials}
                      onAddMaterial={(mat) => setStudyMaterials(prev => [mat, ...prev])}
                      onRemoveMaterial={handleRemoveMaterial}
                    />
                  </div>

                  {/* Right Column: AI Chat Console */}
                  <div className="lg:col-span-8">
                    <MLSProfessorChat 
                      messages={messages} 
                      onSendMessage={handleSendMessage} 
                      isGeneratingMessage={isGenerating}
                      onIncrementGoal={handleIncrementGoalValue}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Futuristic Clinical Footer */}
      <footer className="bg-slate-900 border-t border-slate-850 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-3 font-normal">
          <div className="flex justify-center items-center gap-6">
            <span className="text-xs text-slate-500 hover:text-slate-200 cursor-help flex items-center gap-1">
              🧬 Clinical Laboratory Accredited
            </span>
            <span className="text-xs text-slate-500 hover:text-slate-200 cursor-help flex items-center gap-1">
              🧪 CLSI Compliant Layout
            </span>
            <span className="text-xs text-slate-500 hover:text-slate-200 cursor-help flex items-center gap-1">
              📋 Grade Matrix Integrated
            </span>
          </div>
          <p className="text-[11px] text-slate-600 font-sans leading-relaxed block">
            Designed for educational support and sandbox practice. Values generated inside dynamic simulations are fictive for science pedagogy. 
          </p>
          <div className="text-[10px] font-mono text-slate-700">
            © 2026 LabMaster AI Tutor Workspace • All telemetry calibrated
          </div>
        </div>
      </footer>

      {/* GAMIFIED MODAL DIALOGS */}
      
      {/* 1. Level Up Celebration Prompt */}
      {levelUpModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border-2 border-teal-400 rounded-3xl max-w-sm w-full p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* Holographic glowing lines */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-400" />
            
            <div className="space-y-2">
              <span className="text-4xl animate-bounce inline-block">🎓</span>
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-450 font-sans tracking-tight">
                Academic Promotion!
              </h2>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold">Calibration Verified</p>
            </div>

            <div className="bg-slate-950/80 p-5 rounded-2xl border border-teal-500/20">
              <p className="text-slate-300 font-sans leading-relaxed">
                You have advanced in Academic Rank and successfully elevated to:
              </p>
              <div className="text-2xl font-semibold font-mono text-teal-400 mt-2">
                Level {levelUpModal}
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 font-sans">
              New clinical and diagnostic specimen files have been dispatched to your active exercises queue.
            </p>

            <button
              onClick={() => setLevelUpModal(null)}
              className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-mono font-black py-3 rounded-xl cursor-pointer shadow-lg shadow-teal-500/20"
            >
              Resume Lab Work
            </button>
          </div>
        </div>
      )}

      {/* 2. New Badge Unlocked Modal */}
      {newBadgeModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-sm w-full p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400" />
            
            <div className="space-y-2 animate-pulse">
              <span className="text-4xl inline-block">🏆</span>
              <h2 className="text-xl font-bold text-amber-400 font-sans">
                Professional Badge Discovered!
              </h2>
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Board Certificate Issued</p>
            </div>

            <div className="bg-slate-950/85 p-5 rounded-2xl border border-amber-500/20 space-y-3">
              <div className="flex justify-center text-4xl bg-slate-900 p-2.5 rounded-xl border border-amber-500/10 max-w-max mx-auto shadow-inner">
                {newBadgeModal.id === "chem_badge" ? "🧪" : newBadgeModal.id === "hem_badge" ? "🩸" : newBadgeModal.id === "micro_badge" ? "🧫" : newBadgeModal.id === "bb_badge" ? "💉" : "🧬"}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-105">{newBadgeModal.name}</h3>
                <p className="text-xs text-zinc-300 mt-1 font-sans leading-relaxed">{newBadgeModal.description}</p>
              </div>
            </div>

            <button
              onClick={() => setNewBadgeModal(null)}
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-bold py-3 rounded-xl cursor-pointer shadow-lg shadow-amber-500/25"
            >
              Pin to Credential Board
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
