import React, { useState } from "react";
import { UserProgress, Badge, DailyGoal } from "../types";
import { Award, Flame, CheckCircle, Lock, Trophy, Target, Sparkles, BookOpen, Battery, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

interface StatsDashboardProps {
  progress: UserProgress;
  onClaimGoal: (goalId: string) => void;
  allBadges: Badge[];
}

export default function StatsDashboard({ progress, onClaimGoal, allBadges }: StatsDashboardProps) {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  const xpPercentage = Math.min(100, Math.round((progress.xp / progress.xpNeededForNextLevel) * 100));

  // Determine competency ratings
  const getRating = (score: number) => {
    if (score >= 90) return { title: "Chief Resident", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    if (score >= 70) return { title: "Lead Scientist", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
    if (score >= 40) return { title: "Lab Resident", color: "text-teal-400 bg-teal-500/10 border-teal-500/30" };
    return { title: "Trainee Tech", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
  };

  const subjectMeters = [
    { name: "Clinical Chemistry", score: progress.chemistryScore, icon: "🧪" },
    { name: "Hematology & Coag", score: progress.hematologyScore, icon: "🩸" },
    { name: "Medical Microbiology", score: progress.microbiologyScore, icon: "🧫" },
    { name: "Blood Bank (Immunohematology)", score: progress.bloodbankScore, icon: "💉" },
    { name: "Immunology & Serology", score: progress.immunologyScore, icon: "🧬" }
  ];

  return (
    <div className="space-y-6">
      {/* Level and Streak Summary Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Level Unit */}
        <div className="bg-slate-900 border border-teal-500/20 rounded-xl p-5 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full -mr-10 -mt-10 blur-xl" />
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-teal-950 border border-teal-400/30 text-teal-400 flex items-center justify-center font-mono text-2xl font-bold shadow-md shadow-teal-500/10">
              Lvl {progress.level}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Academic Standing</h3>
              <p className="font-sans font-bold text-lg text-slate-100 truncate">
                {progress.level >= 5 ? "Senior Laboratory Specialist" : progress.level >= 3 ? "Clinical Technician" : "Laboratory Novice"}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>XP: {progress.xp} / {progress.xpNeededForNextLevel}</span>
              <span>{xpPercentage}% calibrated</span>
            </div>
            <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <motion.div 
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" 
                initial={{ width: 0 }}
                animate={{ width: `${xpPercentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>

        {/* Clinical Streak Unit */}
        <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-5 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-10 -mt-10 blur-xl" />
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-amber-950 border border-amber-400/30 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Flame className="w-8 h-8 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold text-slate-100">{progress.streakCount}</span>
                <span className="text-sm font-semibold text-slate-400">Day Streak</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Keep training daily to prevent case files from expiring!</p>
            </div>
          </div>
          <div className="mt-4 flex gap-1.5 justify-between">
            {Array.from({ length: 7 }).map((_, i) => (
              <div 
                key={i} 
                className={`h-5 flex-1 rounded border-t-2 text-[9px] flex items-center justify-center font-mono font-bold transition-all ${
                  progress.streakCount > i 
                    ? "bg-amber-950/40 border-amber-400 text-amber-400" 
                    : "bg-slate-950/40 border-dashed border-slate-800 text-slate-600"
                }`}
              >
                Day {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Calibration Stats Ribbon */}
        <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-5 relative overflow-hidden backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Diagnoses Solved</h3>
              <p className="text-3xl font-mono font-bold text-emerald-400">{progress.unlockedBadges.length + progress.completedExercisesCount}</p>
            </div>
            <Trophy className="w-10 h-10 text-emerald-400/40" />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Completed <span className="text-emerald-400 font-bold">{progress.completedExercisesCount}</span> interactive clinical labs and unlocked <span className="text-teal-400 font-bold">{progress.unlockedBadges.length}</span> critical competencies.
          </p>
        </div>
      </div>

      {/* Main Grid: Goals and Subject Proficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Daily Goals Board */}
        <div id="daily-goals-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-teal-400" />
              <h2 className="font-sans font-bold text-lg text-slate-100">Daily Laboratory Protocols</h2>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded">Resets every 24h</span>
          </div>

          <div className="space-y-3">
            {progress.dailyGoals.map((goal) => {
              const fraction = `${goal.current}/${goal.target}`;
              const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
              const canClaim = goal.current >= goal.target && !goal.completed;

              return (
                <div 
                  key={goal.id} 
                  className={`p-4 rounded-xl border transition-all ${
                    goal.completed 
                      ? "bg-slate-950/60 border-emerald-500/20 opacity-75" 
                      : goal.current >= goal.target 
                        ? "bg-teal-950/20 border-teal-500/40" 
                        : "bg-slate-950 border-slate-800/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{goal.icon}</span>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100">{goal.title}</h4>
                        <span className="text-xs font-mono text-amber-400 flex items-center gap-1 mt-1">
                          <Sparkles className="w-3 h-3" /> +{goal.rewardXp} XP Reward
                        </span>
                      </div>
                    </div>
                    
                    {goal.completed ? (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <CheckCircle className="w-3.5 h-3.5" /> Checked
                      </span>
                    ) : canClaim ? (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onClaimGoal(goal.id)}
                        className="text-xs font-mono font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 px-3 py-1.5 rounded-lg cursor-pointer shadow-lg shadow-teal-500/20 border border-teal-200"
                      >
                        CLAIM XP
                      </motion.button>
                    ) : (
                      <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded font-bold">
                        {fraction}
                      </span>
                    )}
                  </div>

                  {!goal.completed && (
                    <div className="mt-3 space-y-1">
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                        <div 
                          className="h-full bg-teal-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Competency Meter Dashboard */}
        <div id="competencies-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <h2 className="font-sans font-bold text-lg text-slate-100">Lab Specialization Scores</h2>
            </div>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
              <Battery className="w-4 h-4" /> Calibration Active
            </span>
          </div>

          <div className="space-y-4 h-[310px] overflow-y-auto pr-1">
            {subjectMeters.map((sub, i) => {
              const rating = getRating(sub.score);
              return (
                <div key={i} className="space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800/40">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                      <span>{sub.icon}</span> {sub.name}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${rating.color}`}>
                      {rating.title} ({sub.score}%)
                    </span>
                  </div>
                  
                  <div className="relative pt-1 flex items-center justify-between gap-3">
                    <div className="h-2 flex-grow bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <motion.div 
                        className={`h-full rounded-full ${sub.score >= 90 ? "bg-gradient-to-r from-emerald-500 to-green-400" : sub.score >= 70 ? "bg-gradient-to-r from-amber-500 to-yellow-400" : "bg-gradient-to-r from-teal-500 to-cyan-400"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${sub.score}%` }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Competency Badges Shelf */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
          <Award className="w-5 h-5 text-amber-400" />
          <h2 className="font-sans font-bold text-lg text-slate-100">Professional Credential Board</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {allBadges.map((badge) => {
            const isUnlocked = progress.unlockedBadges.includes(badge.id);
            return (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedBadge(badge)}
                key={badge.id}
                className={`flex flex-col items-center p-4 rounded-xl border text-center relative cursor-pointer outline-none transition-all ${
                  isUnlocked 
                    ? "bg-slate-950 border-amber-500/30 text-slate-100 hover:border-amber-400/50 hover:bg-slate-950/80" 
                    : "bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60"
                }`}
              >
                {/* Lock icon overlay */}
                {!isUnlocked && (
                  <div className="absolute top-2 right-2 text-slate-700 bg-slate-900/60 p-1 rounded-full border border-slate-800">
                    <Lock className="w-3 h-3" />
                  </div>
                )}
                
                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-2xl mb-2.5 shadow-inner ${
                  isUnlocked 
                    ? "bg-amber-950/50 border border-amber-400/20 text-amber-400 animate-pulse" 
                    : "bg-slate-900 text-slate-700"
                }`}>
                  <span className={isUnlocked ? "" : "grayscale"}>
                    {getUserBadgeEmoji(badge.iconName)}
                  </span>
                </div>

                <h4 className="text-xs font-bold truncate w-full">{badge.name}</h4>
                <p className="text-[10px] font-mono text-slate-400 mt-1 truncate w-full capitalize">{badge.category}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Badge Detail Modal Dialog */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-teal-500/30 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setSelectedBadge(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 text-xl font-bold cursor-pointer"
            >
              &times;
            </button>
            
            <div className="text-center space-y-3">
              <div className="inline-flex h-20 w-20 rounded-full bg-slate-950 border-2 border-amber-400/30 items-center justify-center text-4xl shadow-lg shadow-amber-500/10 mx-auto">
                {getUserBadgeEmoji(selectedBadge.iconName)}
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-slate-100">{selectedBadge.name}</h3>
                <span className="text-xs font-mono text-amber-400 px-2 py-0.5 bg-slate-950 rounded border border-amber-500/20 capitalize inline-block mt-1">
                  {selectedBadge.category} Qualification
                </span>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-sm text-slate-300">
                <p className="text-slate-200 leading-relaxed font-sans">{selectedBadge.description}</p>
                <div className="mt-3 pt-3 border-t border-slate-850 text-xs text-slate-400 flex flex-col gap-1.5 text-left font-mono">
                  <span>🎯 Achievement Requirement: <span className="text-teal-400">{selectedBadge.requirement}</span></span>
                  <span>🏆 Status: <span className={progress.unlockedBadges.includes(selectedBadge.id) ? "text-emerald-400 font-bold" : "text-slate-500"}>{progress.unlockedBadges.includes(selectedBadge.id) ? "Successfully Unlocked!" : "Locked (Incomplete)"}</span></span>
                </div>
              </div>

              <button
                onClick={() => setSelectedBadge(null)}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold font-mono py-2 rounded-lg cursor-pointer transition-colors"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getUserBadgeEmoji(iconName: string): string {
  switch (iconName) {
    case "test-tube": return "🧪";
    case "droplet": return "🩸";
    case "dna": return "🧬";
    case "virus": return "🧫";
    case "thermometer": return "🌡️";
    case "shield": return "🛡️";
    default: return "🏆";
  }
}
