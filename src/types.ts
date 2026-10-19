export interface LabResultItem {
  parameter: string;
  result: string;
  referenceRange: string;
  status: "Normal" | "High" | "Low" | "Critical High" | "Critical Low" | string;
}

/** One board-style multiple-choice question in a Lab Simulator exam. */
export interface ExamQuestion {
  topic: string;
  stem: string;
  labData: LabResultItem[];
  options: string[];
  answerIndex: number;
  explanation: string;
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
  /** Set on topic badges. */
  topicId?: string;
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
  /** Best score per exam topic id. */
  topicScores?: Record<string, number>;
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

