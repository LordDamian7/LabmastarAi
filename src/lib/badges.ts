import type { Badge } from "../types";
import { EXAM_TOPICS, TOPIC_BADGE_MIN_QUESTIONS, TOPIC_BADGE_SCORE } from "../../api/_topics";
import {
  Zap, Beaker, HeartPulse, Filter, ShieldCheck,
  Droplet, CircleDot, Bandage, Microscope, TestTubes,
  Grape, Bug, Wind, Sprout, ShieldAlert,
  Droplets, Grid3x3, Link, Baby, Package,
  Fingerprint, Shield, FlaskRound, Puzzle, HeartHandshake
} from "lucide-react";

export { EXAM_TOPICS, findTopic, TOPIC_BADGE_MIN_QUESTIONS, TOPIC_BADGE_SCORE } from "../../api/_topics";
export type { ExamTopic } from "../../api/_topics";

export const topicBadgeId = (topicId: string) => `topic:${topicId}`;

export const TOPIC_ICONS: Record<string, typeof Zap> = {
  "chem-electrolytes": Zap, "chem-enzymes": Beaker, "chem-cardiac": HeartPulse, "chem-renal": Filter, "chem-qc": ShieldCheck,
  "hem-anemia": Droplet, "hem-leukemia": CircleDot, "hem-coag": Bandage, "hem-morphology": Microscope, "hem-fluids": TestTubes,
  "micro-gpos": Grape, "micro-gneg": Bug, "micro-anaerobes": Wind, "micro-myco": Sprout, "micro-ast": ShieldAlert,
  "bb-abo": Droplets, "bb-antibody": Grid3x3, "bb-compat": Link, "bb-hdfn": Baby, "bb-components": Package,
  "imm-auto": Fingerprint, "imm-serology": Shield, "imm-assays": FlaskRound, "imm-complement": Puzzle, "imm-transplant": HeartHandshake
};

/** One medal per discipline: 85%+ on a 25+ question discipline exam. */
export const DISCIPLINE_BADGES: Badge[] = [
  {
    id: "chem_badge",
    name: "Enzyme Detective",
    description: "Mastered clinical chemistry: enzymes, electrolytes, acid–base and endocrine interpretation.",
    unlockedAt: null,
    iconName: "test-tube",
    requirement: "Score 85%+ on a 25+ question Clinical Chemistry exam",
    category: "chemistry"
  },
  {
    id: "hem_badge",
    name: "WBC Smear Specialist",
    description: "Mastered hematology: cell morphology, anemias, leukemias and hemostasis.",
    unlockedAt: null,
    iconName: "droplet",
    requirement: "Score 85%+ on a 25+ question Hematology exam",
    category: "hematology"
  },
  {
    id: "micro_badge",
    name: "Microbial Profiler",
    description: "Mastered microbiology: organism identification, media, biochemicals and susceptibility.",
    unlockedAt: null,
    iconName: "virus",
    requirement: "Score 85%+ on a 25+ question Microbiology exam",
    category: "microbiology"
  },
  {
    id: "bb_badge",
    name: "Immunohematology Officer",
    description: "Mastered blood bank: ABO/Rh discrepancies, antibody ID, crossmatch and transfusion reactions.",
    unlockedAt: null,
    iconName: "shield",
    requirement: "Score 85%+ on a 25+ question Blood Bank exam",
    category: "bloodbank"
  },
  {
    id: "imm_badge",
    name: "Autoantibody Diagnostician",
    description: "Mastered immunology: autoantibodies, serology, complement and immunodeficiency.",
    unlockedAt: null,
    iconName: "dna",
    requirement: "Score 85%+ on a 25+ question Immunology exam",
    category: "immunology"
  }
];

/** One badge per exam topic: pass a topic exam. */
export const TOPIC_BADGES: Badge[] = Object.entries(EXAM_TOPICS).flatMap(([category, topics]) =>
  topics.map(t => ({
    id: topicBadgeId(t.id),
    name: t.badge,
    description: `Passed the ${t.name} topic exam.`,
    unlockedAt: null,
    iconName: t.id,
    requirement: `Score ${TOPIC_BADGE_SCORE}%+ on a ${TOPIC_BADGE_MIN_QUESTIONS}+ question ${t.name} exam`,
    category,
    topicId: t.id
  }))
);

export const ALL_BADGES: Badge[] = [...DISCIPLINE_BADGES, ...TOPIC_BADGES];
