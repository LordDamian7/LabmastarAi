import React, { useState, useEffect } from "react";
import { UserProgress, Badge, DailyGoal, Message, StudyMaterial } from "./types";
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

// Safe Storage adapter protecting against Secure cross-origin iframe storage restrictions
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage access blocked inside sandboxed iframe context, using memory fallback.", e);
      return (window as any).__memStorage?.[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      if (!(window as any).__memStorage) {
        (window as any).__memStorage = {};
      }
      (window as any).__memStorage[key] = value;
    }
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      if ((window as any).__memStorage) {
        delete (window as any).__memStorage[key];
      }
    }
  }
};

// Safe Dialog Wrappers safeguarding against DOM exceptions in secure iframes
const safeConfirm = (message: string): boolean => {
  try {
    return window.confirm(message);
  } catch (e) {
    console.warn("window.confirm blocked in sandboxed iframe, auto-approving action for continuity:", message);
    return true; // Auto-approve action in standard preview if dialogue is blocked
  }
};

const safeAlert = (message: string): void => {
  try {
    window.alert(message);
  } catch (e) {
    console.warn("window.alert blocked in sandboxed iframe:", message);
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "exercises" | "chat">("dashboard");
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string; photoUrl?: string } | null>(null);

  // Gamified Milestones animations
  const [levelUpModal, setLevelUpModal] = useState<number | null>(null);
  const [newBadgeModal, setNewBadgeModal] = useState<Badge | null>(null);

  // Initialize and load saved state from safeStorage
  useEffect(() => {
    const savedUser = safeStorage.getItem("labmaster_user_v2");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        setCurrentUser(null);
      }
    }

    const savedProgress = safeStorage.getItem("labmaster_progress_v2");
    if (savedProgress) {
      try {
        setProgress(JSON.parse(savedProgress));
      } catch (e) {
        setupFreshRookie();
      }
    } else {
      setupFreshRookie();
    }

    const savedChats = safeStorage.getItem("labmaster_chats");
    if (savedChats) {
      try {
        setMessages(JSON.parse(savedChats));
      } catch (e) {
        setMessages([]);
      }
    }

    // Verify Gemini backend engine mode
    fetch("/api/status")
      .then(res => res.json())
      .then(data => {
        setIsSimulationMode(data.status === "simulation");
      })
      .catch(() => setIsSimulationMode(true));
  }, []);

  const handleLoginSuccess = (userData: { email: string; name: string; photoUrl?: string }) => {
    setCurrentUser(userData);
    safeStorage.setItem("labmaster_user_v2", JSON.stringify(userData));
  };

  const handleLogout = () => {
    if (safeConfirm("Disconnect and log out of this working clinical session?")) {
      setCurrentUser(null);
      safeStorage.removeItem("labmaster_user_v2");
    }
  };

  const setupFreshRookie = () => {
    const fresh: UserProgress = {
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
      dailyGoals: [
        { id: "goal_quiz", title: "Solve a clinical lab specimen case", target: 1, current: 0, rewardXp: 50, completed: false, icon: "🔬" },
        { id: "goal_chat", title: "Discuss 2 diagnostic concepts with Professor", target: 2, current: 0, rewardXp: 40, completed: false, icon: "💬" },
        { id: "goal_perfect", title: "Achieve 90%+ in any clinical simulation", target: 1, current: 0, rewardXp: 60, completed: false, icon: "🏆" }
      ]
    };
    setProgress(fresh);
    safeStorage.setItem("labmaster_progress_v2", JSON.stringify(fresh));
  };

  // Synchronize state back onto client browser storage
  const syncProgress = (updated: UserProgress) => {
    setProgress(updated);
    safeStorage.setItem("labmaster_progress_v2", JSON.stringify(updated));
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !progress) return;

    // Build the user message object
    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date()
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    safeStorage.setItem("labmaster_chats", JSON.stringify(nextMessages));
    setIsGenerating(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          studyMaterials: studyMaterials
        })
      });

      if (!response.ok) throw new Error("Could not relay query to professor.");
      
      const payload = await response.json();
      const assistantMsg: Message = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content: payload.content,
        timestamp: new Date()
      };

      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      safeStorage.setItem("labmaster_chats", JSON.stringify(finalMessages));
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearChatHistory = () => {
    if (safeConfirm("Reset conversation logs with Professor LabMaster?")) {
      setMessages([]);
      safeStorage.removeItem("labmaster_chats");
    }
  };

  const handleClaimGoalReward = (goalId: string) => {
    if (!progress) return;

    const goal = progress.dailyGoals.find(g => g.id === goalId);
    if (!goal || goal.completed) return;

    // Create shallow copies
    const updatedGoals = progress.dailyGoals.map(g => {
      if (g.id === goalId) {
        return { ...g, completed: true };
      }
      return g;
    });

    handleIncrementXp(goal.rewardXp, updatedGoals);
  };

  const handleIncrementXp = (amount: number, optionalGoalsOverride?: DailyGoal[]) => {
    if (!progress) return;

    let newXp = progress.xp + amount;
    let currentLevel = progress.level;
    let nextThreshold = progress.xpNeededForNextLevel;
    let leveledUp = false;

    while (newXp >= nextThreshold) {
      newXp -= nextThreshold;
      currentLevel += 1;
      nextThreshold = Math.round(nextThreshold * 1.35); // level scalable limits
      leveledUp = true;
    }

    const updatedProgress = {
      ...progress,
      xp: newXp,
      level: currentLevel,
      xpNeededForNextLevel: nextThreshold,
      dailyGoals: optionalGoalsOverride || progress.dailyGoals
    };

    syncProgress(updatedProgress);

    if (leveledUp) {
      setLevelUpModal(currentLevel);
    }
  };

  const handleIncrementGoalValue = (actionType: string) => {
    if (!progress) return;

    const mappedGoals = progress.dailyGoals.map(g => {
      if (actionType === "chat_ask" && g.id === "goal_chat") {
        return { ...g, current: Math.min(g.target, g.current + 1) };
      }
      if (actionType === "exercise_complete" && g.id === "goal_quiz") {
        return { ...g, current: Math.min(g.target, g.current + 1) };
      }
      if (actionType === "score_90" && g.id === "goal_perfect") {
        return { ...g, current: Math.min(g.target, g.current + 1) };
      }
      return g;
    });

    syncProgress({
      ...progress,
      dailyGoals: mappedGoals
    });
  };

  const handleAwardXpOnExerciseScore = (amount: number, categoryKey: string, score: number) => {
    if (!progress) return;

    // Update the targeted competency index score conditionally
    const originalScore = (progress as any)[`${categoryKey}Score`] || 0;
    const newSavedScore = Math.max(originalScore, score);

    // Collect score adjustments
    const modifiedProgress: any = {
      ...progress,
      completedExercisesCount: progress.completedExercisesCount + 1,
      [`${categoryKey}Score`]: newSavedScore
    };

    // Check Badge Qualification rules (Score thresholds >= 85%)
    let newlyUnlockedBadge: Badge | null = null;
    if (score >= 85) {
      const targetBadgeId = `${categoryKey.substring(0, 4)}_badge`; // matching e.g. chem_badge, hema_badge
      const targetBadgeDef = INITIAL_BADGES.find(b => b.id === targetBadgeId || b.id.includes(categoryKey.substring(0, 3)));
      
      if (targetBadgeDef && !progress.unlockedBadges.includes(targetBadgeDef.id)) {
        modifiedProgress.unlockedBadges = [...progress.unlockedBadges, targetBadgeDef.id];
        newlyUnlockedBadge = targetBadgeDef;
      }
    }

    setProgress(modifiedProgress);
    safeStorage.setItem("labmaster_progress_v2", JSON.stringify(modifiedProgress));

    // Claim exercise basic XP rewards
    handleIncrementXp(amount);

    if (newlyUnlockedBadge) {
      setNewBadgeModal(newlyUnlockedBadge);
    }
  };

  const forceRefillGoals = () => {
    if (!progress) return;
    const refilledGoals: DailyGoal[] = [
      { id: "goal_quiz", title: "Verify a clinical lab specimen case", target: 1, current: 0, rewardXp: 50, completed: false, icon: "🔬" },
      { id: "goal_chat", title: "Discuss 2 diagnostic concepts with AI Prof", target: 2, current: 0, rewardXp: 40, completed: false, icon: "💬" },
      { id: "goal_perfect", title: "Achieve 90%+ in any clinical simulation", target: 1, current: 0, rewardXp: 60, completed: false, icon: "🏆" }
    ];
    syncProgress({
      ...progress,
      dailyGoals: refilledGoals
    });
    safeAlert("Daily Calibration Protocols have been manually recalculated & refreshed!");
  };

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
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
    <div className="min-h-screen bg-slate-950 font-normal selection:bg-teal-500 selection:text-slate-950 text-slate-100 flex flex-col antialiased">
      
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
                      studyMaterials={studyMaterials}
                      onAddMaterial={(mat) => setStudyMaterials(prev => [mat, ...prev])}
                      onRemoveMaterial={(id) => setStudyMaterials(prev => prev.filter(m => m.id !== id))}
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
