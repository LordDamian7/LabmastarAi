import React, { useState } from "react";
import { CaseStudy, GradingResult, StudyMaterial } from "../types";
import { 
  Beaker, 
  HelpCircle, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Award, 
  AlertTriangle, 
  RefreshCw, 
  Cpu, 
  TrendingUp, 
  Calendar,
  Sparkles,
  Search
} from "lucide-react";
import { motion } from "motion/react";

interface QuizExerciseProps {
  onAwardXp: (amount: number, categoryKey?: string, achievedScore?: number) => void;
  onIncrementGoal: (actionType: string) => void;
  studyMaterials: StudyMaterial[];
}

const CATEGORIES = [
  { id: "chemistry", name: "Clinical Chemistry", desc: "Electrolytes, enzymes, delta check interpretation", color: "from-teal-500 to-cyan-405", bgLight: "bg-teal-900/10", icon: "🧪" },
  { id: "hematology", name: "Hematology & Coag", desc: "Differential CBC, left shift, blood smears, clotting tests", color: "from-rose-500 to-pink-500", bgLight: "bg-rose-900/10", icon: "🩸" },
  { id: "microbiology", name: "Medical Microbiology", desc: "Culture morphology, staining, biochemical identification", color: "from-emerald-500 to-green-400", bgLight: "bg-emerald-900/10", icon: "🧫" },
  { id: "bloodbank", name: "Blood Bank & ABO", desc: "Crossmatching, antibody identification, group discrepancies", color: "from-indigo-500 to-violet-500", bgLight: "bg-indigo-900/10", icon: "💉" },
  { id: "immunology", name: "Immunology / Serology", desc: "Antinuclear antibody patterns, titers, ELISA assays", color: "from-amber-500 to-orange-400", bgLight: "bg-amber-900/10", icon: "🧬" }
];

export default function QuizExercise({ onAwardXp, onIncrementGoal, studyMaterials }: QuizExerciseProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [useRagForCase, setUseRagForCase] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCase, setCurrentCase] = useState<CaseStudy | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showHints, setShowHints] = useState<Record<number, boolean>>({});
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  
  // Custom calibration loading lines to mimic analyzer fluidics
  const [calibrationStep, setCalibrationStep] = useState("");

  const loadCase = async (category: string) => {
    setIsLoading(true);
    setCurrentCase(null);
    setGradingResult(null);
    setUserAnswers({});
    setShowHints({});
    
    // Cycle custom analyzer logs for gamified feel
    const logs = [
      "Flushing reaction cuvettes...",
      "Calibrating photometer at 340nm...",
      "Aspirating specimen aliquot...",
      "Dispensing enzymatic reagent R1...",
      "Aggregating analyzer delta checks..."
    ];
    let logIdx = 0;
    setCalibrationStep(logs[0]);
    const logInterval = setInterval(() => {
      logIdx = (logIdx + 1) % logs.length;
      setCalibrationStep(logs[logIdx]);
    }, 850);

    try {
      const response = await fetch("/api/generate-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          category,
          studyMaterials: useRagForCase ? studyMaterials : []
        })
      });
      if (!response.ok) throw new Error("Could not acquire diagnostic case.");
      const data = await response.json();
      setCurrentCase(data);
    } catch (err) {
      console.error(err);
    } finally {
      clearInterval(logInterval);
      setIsLoading(false);
    }
  };

  const handleSelectOption = (qId: number, option: string) => {
    setUserAnswers(prev => ({ ...prev, [qId]: option }));
  };

  const handleShortAnswerChange = (qId: number, text: string) => {
    setUserAnswers(prev => ({ ...prev, [qId]: text }));
  };

  const handleToggleHint = (qId: number) => {
    setShowHints(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleSubmitExercise = async () => {
    if (!currentCase) return;
    
    // Ensure all questions are answered
    const unanswered = currentCase.questions.filter(q => !userAnswers[q.id]);
    if (unanswered.length > 0) {
      alert(`Please analyze and complete all ${currentCase.questions.length} questions before committing!`);
      return;
    }

    setIsGrading(true);
    try {
      const response = await fetch("/api/grade-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: currentCase.scenario,
          questions: currentCase.questions,
          rawLabData: currentCase.labData,
          studentAnswers: userAnswers
        })
      });

      if (!response.ok) throw new Error("Grading cycle failed.");
      const result: GradingResult = await response.json();
      setGradingResult(result);

      // Reward student with custom calculated XP based on score
      const baseEarned = result.score >= 90 ? 100 : result.score >= 70 ? 75 : 50;
      onAwardXp(baseEarned, selectedCategory || "chemistry", result.score);
      
      // Keep track of goals
      onIncrementGoal("exercise_complete");
      if (result.score >= 90) {
        onIncrementGoal("score_90");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGrading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("critical")) return "text-rose-400 bg-rose-500/10 border-rose-500/30 font-bold animate-pulse";
    if (s.includes("high") || s.includes("low")) {
      if (s.includes("high")) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      return "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
    }
    return "text-emerald-400 bg-emerald-500/5 border-emerald-500/20";
  };

  return (
    <div className="space-y-6">
      
      {/* Category selector if no case study is active */}
      {!currentCase && !isLoading && (
        <div id="quiz-category-select" className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-teal-500/5 rounded-full blur-xl" />
            <div className="max-w-xl space-y-3">
              <span className="text-xs font-mono text-teal-400 font-bold uppercase tracking-wider block">CLSI Diagnostic Simulator</span>
              <h2 className="text-2xl font-sans font-bold text-slate-100 tracking-tight">Interactive Case Specimen Workstation</h2>
              <p className="text-sm text-slate-300 leading-relaxed font-sans">
                Review clinical demographics, physiological values, morphology charts, and analyzer flags. Resolve interactive questions to test your diagnostic speed.
              </p>
            </div>
          </div>

          {studyMaterials && studyMaterials.length > 0 && (
            <div className="bg-slate-905 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 text-left">
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">RAG Active Calibration Mode Available</h4>
                  <p className="text-[10.5px] font-sans text-slate-400 mt-0.5">
                    Found {studyMaterials.length} loaded source material(s). Your diagnostic case study will be compiled from this reference body.
                  </p>
                </div>
              </div>
              
              <label className="flex items-center gap-2 bg-slate-950 border border-slate-850 hover:border-teal-500/30 px-3.5 py-1.5 rounded-lg cursor-pointer transition-all select-none">
                <input 
                  type="checkbox"
                  checked={useRagForCase}
                  onChange={(e) => setUseRagForCase(e.target.checked)}
                  className="accent-teal-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-[10px] font-mono font-black text-teal-400">
                  GROUND ON UPLOADS
                </span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((cat) => (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  loadCase(cat.id);
                }}
                key={cat.id}
                className="bg-slate-900 border border-slate-850 hover:border-teal-400/30 rounded-xl p-5 text-left flex flex-col justify-between h-48 cursor-pointer shadow-md group outline-none transition-all"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-3xl bg-slate-950 p-2.5 rounded-lg mb-3 block shadow-inner">{cat.icon}</span>
                    <span className="text-[10px] font-mono text-slate-500 font-bold uppercase border border-slate-800 px-2 py-0.5 rounded">Select Protocol</span>
                  </div>
                  <h3 className="text-slate-100 font-bold font-sans text-base group-hover:text-teal-400 transition-colors">{cat.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">{cat.desc}</p>
                </div>
                
                <span className="text-xs font-mono text-teal-400 font-semibold mt-3 flex items-center gap-1">
                  Start Laboratory Specimen <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Analyzer Feed screen */}
      {isLoading && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-6 h-[450px]">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-t-teal-400 border-slate-800 animate-spin" />
            <Cpu className="w-6 h-6 text-teal-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-200">Processing Aliquot Sample</h3>
            <p className="text-xs font-mono text-teal-400 uppercase tracking-widest">{calibrationStep}</p>
            <p className="text-xs text-slate-400 max-w-sm font-sans mx-auto">
              Our AI Specimen Engine is formulating a realistic laboratory scenario containing reference indices and physiological markers...
            </p>
          </div>
        </div>
      )}

      {/* Active Clinical Case Section */}
      {currentCase && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Patient Scenario and Lab Data Panel */}
          <div className="col-span-1 lg:col-span-2 space-y-6">
            
            {/* Top Info Ribbon */}
            <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔬</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{currentCase.title}</h3>
                  <span className="text-xs font-mono text-slate-400">Case ID: <span className="text-teal-400 text-[10px]">{currentCase.id}</span></span>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/25 uppercase font-bold">
                  {currentCase.difficulty} Level
                </span>
                <button
                  onClick={() => {
                    if (confirm("Rejecting this sample deletes current responses. Continue?")) {
                      setCurrentCase(null);
                      setGradingResult(null);
                    }
                  }}
                  className="text-xs font-mono text-rose-400 hover:text-rose-300 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/25 cursor-pointer"
                >
                  Discard Sample
                </button>
              </div>
            </div>

            {/* Demographics / Scenario Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider">Demographic & Clinical Scenario</h4>
              <p className="text-sm text-slate-200 leading-relaxed font-sans">{currentCase.scenario}</p>
            </div>

            {/* Simulated Analyzer Results Table */}
            <div id="results-table-panel" className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-slate-100 uppercase tracking-widest font-bold">Cobas Analyzer Telemetry Output</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-850 px-2.5 py-1 rounded shadow-inner">Verified calibration</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-[11px] font-mono text-slate-400 bg-slate-950 uppercase border-b border-slate-850">
                    <tr>
                      <th className="px-5 py-3">Laboratory Analyte</th>
                      <th className="px-5 py-3">Result Measured</th>
                      <th className="px-5 py-3">Reference Interval</th>
                      <th className="px-5 py-3">Alarm StatusFlag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-sans">
                    {currentCase.labData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-950/40 transition-colors">
                        <td className="px-5 py-4 font-semibold text-slate-200">{row.parameter}</td>
                        <td className="px-5 py-4 font-mono font-bold text-slate-100">{row.result}</td>
                        <td className="px-5 py-4 font-mono text-slate-400 text-xs">{row.referenceRange}</td>
                        <td className="px-5 py-4 text-xs">
                          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-wide font-mono ${getStatusColor(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Question Solving Panel */}
          <div className="col-span-1 space-y-6">
            
            {/* If Not Graded - Display Question Panel */}
            {!gradingResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="font-sans font-bold text-slate-150 text-base flex items-center gap-1.5 leading-none">
                    🔬 Specimen Analysis
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-sans">Analyze values to report differentials.</p>
                </div>

                <div className="space-y-5 max-h-[500px] overflow-y-auto pr-1">
                  {currentCase.questions.map((q, qIndex) => {
                    const ans = userAnswers[q.id] || "";
                    const showHint = showHints[q.id] || false;

                    return (
                      <div key={q.id} className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-3">
                        <div className="flex items-start justify-between gap-2 border-b border-slate-900 pb-2">
                          <span className="text-xs font-mono text-teal-400 font-bold">Metric-0{qIndex + 1}</span>
                          <button
                            onClick={() => handleToggleHint(q.id)}
                            className="text-[10px] font-mono text-slate-400 hover:text-teal-400 cursor-pointer flex items-center gap-0.5"
                          >
                            <HelpCircle className="w-3 h-3" /> Hint
                          </button>
                        </div>

                        <p className="text-xs text-slate-200 font-sans leading-relaxed">{q.text}</p>

                        {/* Hint container */}
                        {showHint && (
                          <div className="p-3 bg-teal-950/20 border border-teal-500/15 rounded-lg text-xs leading-relaxed text-slate-350 italic">
                            💡 {q.hint || "Analyze clinical benchmarks carefully."}
                          </div>
                        )}

                        {/* Choice rendering */}
                        {q.type === "multiple-choice" && q.options ? (
                          <div className="flex flex-col gap-1.5 pt-1">
                            {q.options.map((opt, oIdx) => (
                              <button
                                key={oIdx}
                                onClick={() => handleSelectOption(q.id, opt)}
                                className={`text-xs text-left px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                                  ans === opt
                                    ? "bg-teal-500 border-teal-200 text-slate-950 font-bold"
                                    : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300"
                                }`}
                              >
                                {vNumToLetter(oIdx)}. {opt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          // Short Answer input box
                          <div className="space-y-1.5 pt-1">
                            <input
                              type="text"
                              value={ans}
                              onChange={(e) => handleShortAnswerChange(q.id, e.target.value)}
                              placeholder="Type scientific keyword..."
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-teal-500/50"
                            />
                            <span className="text-[9px] text-slate-500 font-mono italic">Needs precise technical term matching.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleSubmitExercise}
                  disabled={isGrading}
                  className="w-full bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-mono font-bold py-3.5 px-4 rounded-xl cursor-pointer shadow-lg shadow-teal-500/10 flex items-center justify-center gap-2 border border-teal-200 transition-colors"
                >
                  {isGrading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Evaluating Diagnostics...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Submit Report Aliquot
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Display Graded Results */}
            {gradingResult && (
              <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-5 space-y-5 animate-slideUp">
                {/* Score badge container */}
                <div className="text-center space-y-2 py-2 border-b border-slate-800">
                  <div className="inline-flex h-20 w-20 rounded-full bg-slate-950 border-4 border-amber-400 items-center justify-center font-mono font-extrabold text-2xl text-amber-400 shadow-lg shadow-amber-500/10">
                    {gradingResult.score}%
                  </div>
                  <div>
                    <h3 className="font-sans font-extrabold text-slate-100 text-base">Graded Certificate Released</h3>
                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">Academic Verification</p>
                  </div>
                </div>

                <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                  {/* Detailed overall feedback */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-1">
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase block">Summary Statement</span>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{gradingResult.summary}</p>
                  </div>

                  {/* Scientific Pearls callout card */}
                  <div className="bg-gradient-to-r from-amber-950/20 to-orange-950/20 p-4 rounded-xl border border-amber-500/20 space-y-1">
                    <span className="text-[9px] font-mono text-amber-400 font-bold uppercase flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" /> Clinical Pathology Pearl
                    </span>
                    <p className="text-xs text-amber-200 font-sans italic leading-relaxed">
                      "{gradingResult.pearlOfWisdom}"
                    </p>
                  </div>

                  {/* Question breakdown steps list */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider block">Diagnostics Breakdown</span>
                    {gradingResult.questionFeedback.map((fb) => (
                      <div key={fb.id} className="p-3 bg-slate-950 rounded-lg border border-slate-850 flex items-start gap-2.5">
                        {fb.correct ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono text-slate-400 block font-bold">Checkpoint 0{fb.id}</span>
                          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{fb.feedback}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCurrentCase(null);
                    setGradingResult(null);
                  }}
                  className="w-full bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white font-mono font-bold py-3 px-4 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 border border-slate-800 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Load Next Sample Specimen
                </button>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}

function vNumToLetter(index: number): string {
  const letters = ["A", "B", "C", "D"];
  return letters[index] || "•";
}
