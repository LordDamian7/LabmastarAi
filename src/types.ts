export interface LabResultItem {
  parameter: string;
  result: string;
  referenceRange: string;
  status: "Normal" | "High" | "Low" | "Critical High" | "Critical Low" | string;
}

export interface Question {
  id: number;
  text: string;
  hint: string;
  type: "multiple-choice" | "short-answer";
  options?: string[];
  correctAnswer: string;
}

export interface CaseStudy {
  id: string;
  title: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  scenario: string;
  labData: LabResultItem[];
  questions: Question[];
}

export interface QuestionFeedbackResult {
  id: number;
  correct: boolean;
  feedback: string;
}

export interface GradingResult {
  score: number;
  summary: string;
  questionFeedback: QuestionFeedbackResult[];
  pearlOfWisdom: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface DailyGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  rewardXp: number;
  completed: boolean;
  icon: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  unlockedAt: string | null;
  iconName: string;
  requirement: string;
  category: string;
}

export interface UserProgress {
  level: number;
  xp: number;
  xpNeededForNextLevel: number;
  streakCount: number;
  lastDailyReset: string;
  chemistryScore: number;
  hematologyScore: number;
  microbiologyScore: number;
  bloodbankScore: number;
  immunologyScore: number;
  unlockedBadges: string[];
  completedExercisesCount: number;
  dailyGoals: DailyGoal[];
}

export interface StudyMaterial {
  id: string;
  fileName: string;
  fileType: "pdf" | "docx" | "txt" | "image" | string;
  fileSize: number;
  storagePath: string; // Path of the original file in the Supabase "study-materials" bucket
  summary?: string;
  uploadedAt: string;
  pages?: number;
  words?: number;
}

