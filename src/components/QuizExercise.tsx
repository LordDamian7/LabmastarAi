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

// Safe Dialogue Fallbacks for sandboxed iframes
const safeConfirm = (message: string): boolean => {
  try {
    return window.confirm(message);
  } catch (e) {
    console.warn("window.confirm blocked in sandboxed iframe, automatically allowing action:", message);
    return true;
  }
};

const safeAlert = (message: string): void => {
  try {
    window.alert(message);
  } catch (e) {
    console.warn("window.alert blocked in sandboxed iframe:", message);
  }
};

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

  // Tactile Interactive Virtual Workbench States
  const [hemolysisDilution, setHemolysisDilution] = useState<number>(1); // Chemistry
  const [spectroBlanked, setSpectroBlanked] = useState<boolean>(false); // Chemistry
  const [microscopeObjective, setMicroscopeObjective] = useState<string>("10x"); // Hematology
  const [microscopeFocus, setMicroscopeFocus] = useState<number>(33); // Hematology
  const [indoleInoculated, setIndoleInoculated] = useState<boolean>(false); // Microbiology
  const [kovacsAdded, setKovacsAdded] = useState<boolean>(false); // Microbiology
  const [ureaseInoculated, setUreaseInoculated] = useState<boolean>(false); // Microbiology
  const [citrateInoculated, setCitrateInoculated] = useState<boolean>(false); // Microbiology
  const [microIncubated, setMicroIncubated] = useState<boolean>(false); // Microbiology
  const [bbReagentsDispensed, setBbReagentsDispensed] = useState<boolean>(false); // Blood Bank
  const [immunoTiter, setImmunoTiter] = useState<string>("1:40"); // Immunology
  const [immunoZoom, setImmunoZoom] = useState<number>(1); // Immunology

  // Computed local lab data state with on-the-fly interactive additions
  const renderedLabData = React.useMemo(() => {
    if (!currentCase) return [];
    
    return currentCase.labData.map(row => {
      // Chemistry dilution corrections
      if (selectedCategory === "chemistry") {
        if (row.parameter.includes("Potassium")) {
          if (hemolysisDilution === 5) {
            return { ...row, result: "3.9 mmol/L", status: "Normal [Dilution 1:5 applied]" };
          }
          if (hemolysisDilution === 10) {
            return { ...row, result: "3.8 mmol/L", status: "Normal [Dilution 1:10 applied]" };
          }
        }
        if (row.parameter.includes("Serum Color")) {
          if (hemolysisDilution > 1) {
            return { ...row, result: "Clear straw color (hemolysis eliminated)", status: "Normal" };
          }
        }
      }
      
      // Hematology microscope focus unlocks
      if (selectedCategory === "hematology" && row.parameter.includes("Toxic Granulation")) {
        const isFocused = microscopeObjective === "100x" && microscopeFocus >= 75 && microscopeFocus <= 90;
        if (isFocused) {
          return { ...row, result: "🔬 Segmented neutrophil with 4 lobes, showing bright blue-black toxic lysosomes and fine pale-blue Döhle bodies (Microscope calibration standard unlocked!)", status: "High [Calibrated]" };
        } else {
          return { ...row, result: "Microscope objective lens uncalibrated or blurred. Toggle 100x magnification & slide focus (75%-90%) to reveal cell morphology.", status: "Normal [Uncalibrated]" };
        }
      }
      
      // Microbiology biochemical calibrations
      if (selectedCategory === "microbiology") {
        if (row.parameter.includes("Indole Test")) {
          if (kovacsAdded && indoleInoculated) {
            return { ...row, result: "Deep Cherry-Red Ring layered on top (POSITIVE +)", status: "Normal [Calibration verified]" };
          } else if (indoleInoculated) {
            return { ...row, result: "Inoculated (Yellow straw, pending Kovac's reagent)", status: "Normal" };
          }
        }
        if (row.parameter.includes("MacConkey Agar")) {
          if (microIncubated) {
            return { ...row, result: "Vibrant flat dark-pink colonies (Lactose-Fermentation active)", status: "High" };
          } else {
            return { ...row, result: "No reaction (awaiting 24h incubation cycle)", status: "Normal" };
          }
        }
      }

      // Blood bank grouping dispenser
      if (selectedCategory === "bloodbank") {
        if (row.parameter.includes("Reverse: A1")) {
          if (bbReagentsDispensed) {
            return { ...row, result: "2+ Agglutination [clumped] (Type A2 discrepant A1 cells confirmed)", status: "High" };
          } else {
            return { ...row, result: "Pending reagent dispense", status: "Normal" };
          }
        }
        if (row.parameter.includes("Reverse: B")) {
          if (bbReagentsDispensed) {
            return { ...row, result: "4+ Solid Agglutination clump (Type A verified)", status: "Normal" };
          } else {
            return { ...row, result: "Pending reagent dispense", status: "Normal" };
          }
        }
      }
      
      // Immunology
      if (selectedCategory === "immunology") {
        if (row.parameter.includes("ANA Homogeneous Pattern")) {
          if (immunoZoom > 1) {
            return { ...row, result: "Positive (Bright fluorescent homogeneous nucleoplasms glowing under UV lens)!", status: "High" };
          } else {
            return { ...row, result: "Positive (Uncalibrated eyepiece magnification)", status: "High" };
          }
        }
        if (row.parameter.includes("ANA Titer")) {
          return { ...row, result: immunoTiter === "1:640" ? "1:640 High Titer Active" : `${immunoTiter} (Dilution active)` };
        }
      }

      return row;
    });
  }, [currentCase, selectedCategory, hemolysisDilution, microscopeObjective, microscopeFocus, indoleInoculated, kovacsAdded, ureaseInoculated, citrateInoculated, microIncubated, bbReagentsDispensed, immunoTiter, immunoZoom]);

  const loadCase = async (category: string) => {
    setIsLoading(true);
    setCurrentCase(null);
    setGradingResult(null);
    setUserAnswers({});
    setShowHints({});
    
    // Reset custom virtual lab apparatus back to factory status
    setHemolysisDilution(1);
    setSpectroBlanked(false);
    setMicroscopeObjective("10x");
    setMicroscopeFocus(33);
    setIndoleInoculated(false);
    setKovacsAdded(false);
    setUreaseInoculated(false);
    setCitrateInoculated(false);
    setMicroIncubated(false);
    setBbReagentsDispensed(false);
    setImmunoTiter("1:40");
    setImmunoZoom(1);
    
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
      safeAlert(`Please analyze and complete all ${currentCase.questions.length} questions before committing!`);
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
                    if (safeConfirm("Rejecting this sample deletes current responses. Continue?")) {
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

            {/* MLS Interactive Specimen Laboratory Workbench */}
            <div id="mls-virtual-workbench-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛠️</span>
                  <h3 className="font-sans font-extrabold text-xs uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    MLS Virtual Diagnostics Workbench
                    <span className="text-[9px] font-mono bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded font-normal normal-case">
                      Active Apparatus
                    </span>
                  </h3>
                </div>
                <span className="text-[10px] text-slate-450 font-mono font-bold hidden sm:block">
                  {selectedCategory === "chemistry" && "Spectrophotometry Unit"}
                  {selectedCategory === "hematology" && "Binocular Optical Scope"}
                  {selectedCategory === "microbiology" && "Enteric Inoculation Board"}
                  {selectedCategory === "bloodbank" && "Agglutination Well Tray"}
                  {selectedCategory === "immunology" && "Indirect UV IFA scope"}
                </span>
              </div>

              {/* Chemistry interactive desk */}
              {selectedCategory === "chemistry" && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  <div className="md:col-span-4 flex flex-col items-center bg-slate-950 p-4 rounded-xl border border-slate-850 text-center">
                    <span className="text-xs font-mono font-bold text-slate-400 mb-2">SPECTRUM TUBE STATUS</span>
                    <div className="relative w-12 h-24 bg-slate-900 rounded-b-xl border border-slate-700 overflow-hidden flex items-end">
                      <div 
                        className={`w-full transition-all duration-700 ${
                          hemolysisDilution === 1 
                            ? "h-[75%] bg-gradient-to-t from-red-600/70 to-pink-500/50 animate-pulse" 
                            : hemolysisDilution === 5
                            ? "h-[60%] bg-gradient-to-t from-amber-400/50 to-yellow-300/30"
                            : "h-[45%] bg-gradient-to-t from-amber-100/40 to-yellow-105/20"
                        }`} 
                      />
                      <div className="absolute inset-0 border-t border-slate-705" style={{ top: "30%" }} />
                      <div className="absolute inset-0 border-t border-slate-705" style={{ top: "60%" }} />
                    </div>
                    <span className="text-[10px] font-mono text-slate-300 mt-2 font-bold uppercase truncate max-w-full">
                      {hemolysisDilution === 1 ? "⚠️ Lysed Hemolysis" : `Corrected 1:${hemolysisDilution}`}
                    </span>
                  </div>

                  <div className="md:col-span-8 space-y-3 font-sans">
                    <h4 className="text-xs font-extrabold text-slate-200">Analytical Dilution Panel</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      This ICU patient's blood sample exhibits signs of pre-analytical shear. High intracellular leakage is producing a potassium delta alarm error. Dilute the raw serum to bypass hemolysis interference.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setHemolysisDilution(1)}
                        className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          hemolysisDilution === 1 
                            ? "bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold" 
                            : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800"
                        }`}
                      >
                        1X (Raw Tube)
                      </button>
                      <button
                        onClick={() => {
                          setHemolysisDilution(5);
                          onIncrementGoal("exercise_complete"); // Mini task reward
                        }}
                        className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          hemolysisDilution === 5 
                            ? "bg-teal-500 text-slate-950 font-bold" 
                            : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800"
                        }`}
                      >
                        1:5 Saline Dilution
                      </button>
                      <button
                        onClick={() => {
                          setHemolysisDilution(10);
                          onIncrementGoal("exercise_complete");
                        }}
                        className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          hemolysisDilution === 10
                            ? "bg-teal-500 text-slate-950 font-bold" 
                            : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800"
                        }`}
                      >
                        1:10 Saline Dilution
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Hematology microscope scope */}
              {selectedCategory === "hematology" && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  <div className="md:col-span-5 flex flex-col items-center justify-center bg-slate-950 p-4 rounded-xl border border-slate-850">
                    <span className="text-[10px] font-mono text-slate-450 uppercase mb-2 font-bold tracking-widest">Scope Optical Eyepiece</span>
                    
                    {/* Simulated lens circular eyepiece */}
                    <div className="relative w-32 h-32 rounded-full bg-slate-900 border-4 border-slate-750 flex items-center justify-center overflow-hidden group shadow-inner">
                      {/* Grid crosshair guidelines */}
                      <div className="absolute inset-x-0 h-0.5 bg-sky-500/20 pointer-events-none" />
                      <div className="absolute inset-y-0 w-0.5 bg-sky-500/20 pointer-events-none" />
                      
                      {/* Microscope slide drawing */}
                      <div className="absolute inset-1 flex items-center justify-center transition-all duration-500">
                        {microscopeObjective === "100x" ? (
                          <div 
                            className="text-center font-sans transition-all duration-300"
                            style={{ filter: `blur(${Math.abs(80 - microscopeFocus) / 4}px)` }}
                          >
                            {/* Segmented Neutrophil SVG cartoon */}
                            <svg width="80" height="80" viewBox="0 0 100 100" className="mx-auto">
                              {/* Large cell body cytoplasm */}
                              <circle cx="50" cy="50" r="38" fill="#fef08a" fillOpacity="0.45" stroke="#fef08a" strokeWidth="1.5" />
                              
                              {/* Lobed nucleus */}
                              <path d="M42,35 C35,38 34,48 42,52 C50,48 50,38 42,35 Z" fill="#6b21a8" />
                              <path d="M58,62 C50,65 48,55 54,48 C62,48 64,58 58,62 Z" fill="#6b21a8" />
                              <path d="M62,38 C68,42 66,52 58,54 C54,50 54,40 62,38 Z" fill="#6b21a8" />
                              {/* Connective chromatin bridges */}
                              <line x1="42" y1="45" x2="54" y2="52" stroke="#6b21a8" strokeWidth="2.5" />
                              <line x1="58" y1="51" x2="59" y2="43" stroke="#6b21a8" strokeWidth="2.5" />

                              {/* Toxic Granules (primary lysosomes) */}
                              <circle cx="22" cy="40" r="1.5" fill="#312e81" />
                              <circle cx="28" cy="32" r="1.5" fill="#312e81" />
                              <circle cx="34" cy="56" r="1.5" fill="#312e81" />
                              <circle cx="48" cy="62" r="1.5" fill="#312e81" />
                              <circle cx="68" cy="62" r="1.5" fill="#312e81" />
                              <circle cx="72" cy="50" r="1.5" fill="#312e81" />
                              <circle cx="52" cy="24" r="1.5" fill="#312e81" />

                              {/* Döhle bodies (aggregates of RER) */}
                              <ellipse cx="25" cy="52" rx="4" ry="1.8" fill="#38bdf8" fillOpacity="0.75" />
                              <ellipse cx="64" cy="28" rx="5" ry="2.2" fill="#38bdf8" fillOpacity="0.7" />
                            </svg>
                          </div>
                        ) : microscopeObjective === "40x" ? (
                          <div className="flex flex-wrap items-center justify-center p-4 content-center gap-1.5 w-full h-full opacity-70">
                            {/* Tiny red cells and some WBCs */}
                            {Array.from({ length: 8 }).map((_, i) => (
                              <div key={i} className="h-3 w-3 rounded-full bg-red-500/30 border border-red-500/40" />
                            ))}
                            <div className="h-5 w-5 rounded-full bg-purple-900/30 border border-purple-500/40" />
                          </div>
                        ) : (
                          // 10x Low Power Scan layout
                          <div className="flex flex-wrap items-center justify-center p-2 gap-1 w-full h-full opacity-50 scale-75">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div key={i} className="h-2 w-2 rounded-full bg-red-600/20" />
                            ))}
                            <div className="h-3 w-3 rounded-full bg-violet-600/30" />
                          </div>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-300 mt-2 font-bold">
                      {microscopeObjective === "100x" && microscopeFocus >= 75 && microscopeFocus <= 90 
                        ? "❇️ OPTICAL FOCUS CALIBRATED" 
                        : microscopeObjective === "100x"
                        ? "⚠️ FOCUS BLURRED. SLIDE TO (75%-90%)"
                        : "USE 100X OIL IMMERSION"}
                    </span>
                  </div>

                  <div className="md:col-span-7 space-y-3 font-sans">
                    <h4 className="text-xs font-extrabold text-slate-205">Scope Objective & Focus Desk</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Inspect the blood smear differential. Choose the **100x oil objective lens** and click-drag the fine focus wheel to calibrate visual clarity! Look for cytoplasmic inclusions.
                    </p>
                    
                    {/* Controls */}
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-1.5">
                        {["10x", "40x", "100x"].map((lens) => (
                          <button
                            key={lens}
                            onClick={() => setMicroscopeObjective(lens)}
                            className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                              microscopeObjective === lens 
                                ? "bg-teal-500 text-slate-950 font-bold border-teal-200" 
                                : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800"
                            }`}
                          >
                            {lens} Lens {lens === "100x" ? "(Oil)" : ""}
                          </button>
                        ))}
                      </div>

                      {microscopeObjective === "100x" && (
                        <div className="space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-850/80 animate-fadeIn">
                          <div className="flex justify-between text-[10px] font-mono text-slate-400">
                            <span>Fine Focus Objective Adjuster:</span>
                            <span className="font-bold text-teal-400">{microscopeFocus}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            value={microscopeFocus}
                            onChange={(e) => setMicroscopeFocus(parseInt(e.target.value))}
                            className="w-full accent-teal-400 cursor-pointer h-1.5"
                          />
                          <p className="text-[9px] text-slate-500 font-mono italic mt-1">Calibrated focused target: 75% - 90%.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Microbiology Inoculator */}
              {selectedCategory === "microbiology" && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  <div className="md:col-span-6 flex justify-around bg-slate-950 p-4 rounded-xl border border-slate-850">
                    
                    {/* Tube 1: Indole */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-mono text-slate-400 mb-1.5 font-bold">INDOLE VIAL</span>
                      <div className="w-6 h-18 bg-slate-900 rounded-b-xl border border-slate-700 overflow-hidden flex flex-col justify-end relative">
                        <div className="h-[65%] bg-yellow-450/30 w-full" />
                        {indoleInoculated && (
                          <div className={`absolute top-0 inset-x-0 h-4 transition-all duration-700 ${
                            kovacsAdded ? "bg-rose-600 border-b border-rose-450 animate-pulse" : "bg-yellow-400/90 border-b border-yellow-350"
                          }`} />
                        )}
                      </div>
                      <span className="text-[8.5px] font-mono text-slate-400 mt-1 uppercase text-center w-full truncate font-semibold">
                        {kovacsAdded ? "Red Ring (+)" : indoleInoculated ? "Inoculated" : "sterile"}
                      </span>
                    </div>

                    {/* Tube 2: Citrate */}
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[9px] font-mono text-slate-400 mb-1.5 font-bold">CITRATE SLANT</span>
                      <div className="w-6 h-18 bg-slate-900 rounded-b-xl border border-slate-705 overflow-hidden flex flex-col justify-end relative">
                        <div className={`h-[80%] w-full slant-fill transition-colors duration-1000 ${
                          citrateInoculated && microIncubated ? "bg-cyan-900/60" : "bg-emerald-900/40"
                        }`} />
                      </div>
                      <span className="text-[8.5px] font-mono text-slate-405 mt-1 uppercase text-center w-full truncate font-semibold">
                        {citrateInoculated && microIncubated ? "Neg (Green)" : citrateInoculated ? "Inoculated" : "sterile"}
                      </span>
                    </div>

                    {/* Tube 3: Urease */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-mono text-slate-400 mb-1.5 font-bold">UREASE SLANT</span>
                      <div className="w-6 h-18 bg-slate-900 rounded-b-xl border border-slate-700 overflow-hidden flex flex-col justify-end relative">
                        <div className="h-[75%] bg-amber-400/10 w-full" />
                      </div>
                      <span className="text-[8.5px] font-mono text-slate-400 mt-1 uppercase text-center w-full truncate font-semibold">
                        {ureaseInoculated && microIncubated ? "Negative (-)" : ureaseInoculated ? "Inoculated" : "sterile"}
                      </span>
                    </div>

                  </div>

                  <div className="md:col-span-6 space-y-3 font-sans">
                    <h4 className="text-xs font-extrabold text-slate-205">Biochemical Tube Profiler</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Determine the genus species of this urinary tract Gram-negative rod. Inoculate testing media with colonies from the MacConkey agar plate, then run Kovac's reagent and incubate.
                    </p>
                    
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => {
                          setIndoleInoculated(true);
                          setCitrateInoculated(true);
                          setUreaseInoculated(true);
                        }}
                        disabled={indoleInoculated}
                        className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          indoleInoculated 
                            ? "bg-slate-950 border-slate-850 text-slate-550 opacity-50" 
                            : "bg-teal-500/10 hover:bg-teal-500/15 border-teal-500/20 text-teal-400 hover:border-teal-400"
                        }`}
                      >
                        Inoculate Slant Tubes
                      </button>

                      {indoleInoculated && (
                        <button
                          onClick={() => setKovacsAdded(true)}
                          disabled={kovacsAdded}
                          className="text-xs font-mono px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-400 hover:border-rose-400 transition-all cursor-pointer animate-fadeIn"
                        >
                          Add Kovac's Reagent
                        </button>
                      )}

                      {indoleInoculated && (
                        <button
                          onClick={() => setMicroIncubated(true)}
                          disabled={microIncubated}
                          className="text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:border-emerald-400 transition-all cursor-pointer animate-fadeIn"
                        >
                          Incubate Plates 24h
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Blood Bank crossmatching wells */}
              {selectedCategory === "bloodbank" && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  <div className="md:col-span-7 flex flex-wrap gap-2 justify-center bg-slate-950 p-4 rounded-xl border border-slate-850">
                    
                    {/* Well A */}
                    <div className="flex flex-col items-center bg-slate-900/60 p-2 rounded-lg border border-slate-850 text-center w-16">
                      <span className="text-[8.5px] font-mono text-slate-400">Anti-A</span>
                      <div className="w-10 h-10 rounded-full bg-slate-950 border-2 border-slate-750 flex items-center justify-center p-0.5 mt-1 overflow-hidden">
                        {bbReagentsDispensed ? (
                          <div className="grid grid-cols-3 gap-0.5 animate-pulse">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="h-1.5 w-1.5 bg-rose-600 rounded-full shadow" />
                            ))}
                          </div>
                        ) : (
                          <div className="h-full w-full bg-slate-900/50" />
                        )}
                      </div>
                      <span className="text-[8px] font-mono text-slate-400 mt-1 font-bold">{bbReagentsDispensed ? "++++" : "Empty"}</span>
                    </div>

                    {/* Well B */}
                    <div className="flex flex-col items-center bg-slate-900/60 p-2 rounded-lg border border-slate-850 text-center w-16">
                      <span className="text-[8.5px] font-mono text-slate-400">Anti-B</span>
                      <div className="w-10 h-10 rounded-full bg-slate-950 border-2 border-slate-750 flex items-center justify-center p-1 mt-1 overflow-hidden">
                        {bbReagentsDispensed ? (
                          <div className="h-full w-full bg-rose-300/10 rounded-full" />
                        ) : (
                          <div className="h-full w-full bg-slate-900/50" />
                        )}
                      </div>
                      <span className="text-[8px] font-mono text-slate-400 mt-1 font-bold">{bbReagentsDispensed ? "Neg" : "Empty"}</span>
                    </div>

                    {/* Well D */}
                    <div className="flex flex-col items-center bg-slate-900/60 p-2 rounded-lg border border-slate-850 text-center w-16">
                      <span className="text-[8.5px] font-mono text-slate-400">Anti-D</span>
                      <div className="w-10 h-10 rounded-full bg-slate-950 border-2 border-slate-750 flex items-center justify-center p-0.5 mt-1 overflow-hidden">
                        {bbReagentsDispensed ? (
                          <div className="grid grid-cols-2 gap-1 animate-pulse">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div key={i} className="h-1.5 w-1.5 bg-rose-700/80 rounded-full" />
                            ))}
                          </div>
                        ) : (
                          <div className="h-full w-full bg-slate-900/50" />
                        )}
                      </div>
                      <span className="text-[8px] font-mono text-slate-400 mt-1 font-bold">{bbReagentsDispensed ? "+++" : "Empty"}</span>
                    </div>

                    {/* Well A1 */}
                    <div className="flex flex-col items-center bg-slate-900/60 p-2 rounded-lg border border-slate-850 text-center w-16">
                      <span className="text-[8.5px] font-mono text-slate-400">A1 Cells</span>
                      <div className="w-10 h-10 rounded-full bg-slate-950 border-2 border-slate-750 flex items-center justify-center p-0.5 mt-1 overflow-hidden">
                        {bbReagentsDispensed ? (
                          <div className="grid grid-cols-2 gap-1 animate-pulse">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <div key={i} className="h-1.5 w-1.5 bg-rose-800 rounded-full animate-bounce" />
                            ))}
                          </div>
                        ) : (
                          <div className="h-full w-full bg-slate-900/50" />
                        )}
                      </div>
                      <span className="text-[8px] font-mono text-slate-400 mt-1 font-bold">{bbReagentsDispensed ? "2+ Clump" : "Empty"}</span>
                    </div>

                    {/* Well B Serum */}
                    <div className="flex flex-col items-center bg-slate-900 p-2 rounded-lg border border-slate-850 text-center w-16">
                      <span className="text-[8.5px] font-mono text-slate-400">B Cells</span>
                      <div className="w-10 h-10 rounded-full bg-slate-950 border-2 border-slate-750 flex items-center justify-center p-0.5 mt-1 overflow-hidden">
                        {bbReagentsDispensed ? (
                          <div className="grid grid-cols-3 gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div key={i} className="h-1.5 w-1.5 bg-rose-600 rounded-full" />
                            ))}
                          </div>
                        ) : (
                          <div className="h-full w-full bg-slate-900/50" />
                        )}
                      </div>
                      <span className="text-[8px] font-mono text-slate-400 mt-1 font-bold">{bbReagentsDispensed ? "++++" : "Empty"}</span>
                    </div>

                  </div>

                  <div className="md:col-span-5 space-y-3 font-sans">
                    <h4 className="text-xs font-extrabold text-slate-205">ABO Forward & Reverse Plate</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Evaluate ABO groupings and detect antibodies. Add patient specimen cells to anti-sera and patient serum to reagent cells to observe clumping discrepancies.
                    </p>
                    
                    <button
                      onClick={() => {
                        setBbReagentsDispensed(true);
                        onIncrementGoal("exercise_complete");
                      }}
                      disabled={bbReagentsDispensed}
                      className={`text-xs font-mono px-3 py-2 rounded-lg border transition-all cursor-pointer w-full text-center font-bold ${
                        bbReagentsDispensed 
                          ? "bg-slate-950 border-slate-850 text-slate-550 opacity-40" 
                          : "bg-teal-500 hover:bg-teal-400 text-slate-950 border-teal-200"
                      }`}
                    >
                      {bbReagentsDispensed ? "REAGENTS DISPENSED" : "DISPENSE BLOOD REAGENTS"}
                    </button>
                  </div>
                </div>
              )}

              {/* Immunology UV scale */}
              {selectedCategory === "immunology" && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  <div className="md:col-span-5 flex flex-col items-center justify-center bg-slate-950 p-4 rounded-xl border border-slate-850">
                    <span className="text-[10px] font-mono text-slate-450 uppercase mb-2 font-bold tracking-widest">UV IFA Eye Lens</span>
                    
                    {/* Simulated circular lens with green glowing pattern */}
                    <div className="relative w-28 h-28 rounded-full bg-slate-950 border-4 border-slate-800 flex items-center justify-center overflow-hidden group shadow-inner">
                      <div className="absolute inset-x-0 h-0.5 bg-green-500/10 pointer-events-none" />
                      <div className="absolute inset-y-0 w-0.5 bg-green-500/10 pointer-events-none" />
                      
                      {/* Interactive HEp-2 nuclear staining */}
                      <div 
                        className="flex flex-wrap items-center justify-center content-center gap-1.5 w-full h-full transition-all duration-300"
                        style={{ transform: `scale(${immunoZoom === 1 ? 0.9 : immunoZoom === 2 ? 1.4 : 1.95})` }}
                      >
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="relative h-6 w-6 rounded-full bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-center overflow-hidden">
                            {/* Homogeneous nuclear glow */}
                            <div className="absolute inset-1 rounded-full bg-emerald-500/25 blur-[1.5px] transition-all" />
                            {/* Chromatin / nucleolar structures inside */}
                            <circle cx="12" cy="12" r="5" fill="#34d399" fillOpacity="0.45" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-300 mt-2 font-bold uppercase">
                      {immunoZoom > 1 ? "Homogeneous Nucleoplasm ✅" : "Zoom eyepiece lens"}
                    </span>
                  </div>

                  <div className="md:col-span-7 space-y-3 font-sans">
                    <h4 className="text-xs font-extrabold text-slate-205">Indirect Immunofluorescent Desk</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Calibrate the IFA test to detect systemic lupus markers. Choose a screening serum titer ratio and dial the zoom eyepiece focus to review glowing patterns on the HEp-2 cells.
                    </p>
                    
                    <div className="space-y-3">
                      {/* Titer ratios */}
                      <div className="flex flex-wrap gap-1.5">
                        {["1:40", "1:160", "1:640"].map((t) => (
                          <button
                            key={t}
                            onClick={() => setImmunoTiter(t)}
                            className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-all cursor-pointer ${
                              immunoTiter === t 
                                ? "bg-teal-500 text-slate-950 font-bold border-teal-200" 
                                : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800"
                            }`}
                          >
                            Titer {t}
                          </button>
                        ))}
                      </div>

                      {/* Microscope eyepiece zoom */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-slate-450 block">Eyepiece Zoom Magnifier:</span>
                        <div className="flex gap-2">
                          {[1, 2, 3].map((z) => (
                            <button
                              key={z}
                              onClick={() => setImmunoZoom(z)}
                              className={`text-[10px] font-mono h-8 w-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                                immunoZoom === z 
                                  ? "bg-teal-500 text-slate-950 font-bold border-teal-200" 
                                  : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800"
                              }`}
                            >
                              {z}X
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>

            {/* Simulated Analyzer Results Table */}
            <div id="results-table-panel" className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg relative">
              {/* Automated Laser scanner beam sweep */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent blur-[2px] opacity-40 pointer-events-none animate-sweep" />
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
                    {renderedLabData.map((row, idx) => (
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
