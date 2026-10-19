// Exam topics per discipline. Shared by the API (question focus) and the
// frontend (topic exams and topic badges), so ids must stay stable: earned
// topic badges are stored as `topic:<id>` in the user's progress.

export interface ExamTopic {
  id: string;
  /** Short label shown in the UI. */
  name: string;
  /** What the question writer is told to focus on. */
  focus: string;
  /** Name of the badge earned for passing this topic's exam. */
  badge: string;
  /** Matching `topic` labels in the offline question bank. */
  bankTopics: string[];
}

export const EXAM_TOPICS: Record<string, ExamTopic[]> = {
  chemistry: [
    { id: "chem-electrolytes", name: "Electrolytes & Acid–Base", focus: "electrolytes and acid–base balance", badge: "Acid–Base Ace", bankTopics: ["Electrolytes & acid–base"] },
    { id: "chem-enzymes", name: "Enzymes & Liver", focus: "enzymes and liver function", badge: "Enzyme Hunter", bankTopics: ["Enzymes", "Liver function"] },
    { id: "chem-cardiac", name: "Carbs, Lipids & Cardiac", focus: "carbohydrates, lipids and cardiac markers", badge: "Heart Marker", bankTopics: ["Carbohydrates", "Cardiac markers"] },
    { id: "chem-renal", name: "Renal, Proteins & Endocrine", focus: "renal function, proteins and endocrinology", badge: "Nephron Navigator", bankTopics: [] },
    { id: "chem-qc", name: "QC & Pre-analytical", focus: "quality control, interferences and pre-analytical errors", badge: "Quality Guardian", bankTopics: ["Interferences", "Pre-analytical errors"] }
  ],
  hematology: [
    { id: "hem-anemia", name: "Red Cells & Anemias", focus: "red cell disorders and anemias", badge: "Red Cell Ranger", bankTopics: ["Anemias", "Red cell morphology"] },
    { id: "hem-leukemia", name: "White Cells & Leukemias", focus: "white cell disorders and leukemias", badge: "Blast Buster", bankTopics: ["Leukemias", "White cell disorders"] },
    { id: "hem-coag", name: "Hemostasis & Coagulation", focus: "hemostasis and coagulation testing", badge: "Clot Commander", bankTopics: ["Hemostasis"] },
    { id: "hem-morphology", name: "Smears & Instruments", focus: "blood smear morphology and instrumentation", badge: "Smear Sleuth", bankTopics: ["Instrumentation"] },
    { id: "hem-fluids", name: "Body Fluids & Urinalysis", focus: "body fluids and urinalysis", badge: "Fluid Finder", bankTopics: [] }
  ],
  microbiology: [
    { id: "micro-gpos", name: "Gram-Positive", focus: "gram-positive organisms", badge: "Purple Prodigy", bankTopics: ["Gram-positive organisms"] },
    { id: "micro-gneg", name: "Gram-Negative", focus: "gram-negative organisms", badge: "Pink Pathfinder", bankTopics: ["Gram-negative organisms"] },
    { id: "micro-anaerobes", name: "Anaerobes & Mycobacteria", focus: "anaerobes, mycobacteria and specimen handling", badge: "Acid-Fast Ace", bankTopics: ["Mycobacteria"] },
    { id: "micro-myco", name: "Mycology & Parasitology", focus: "mycology and parasitology", badge: "Parasite Patrol", bankTopics: [] },
    { id: "micro-ast", name: "Susceptibility & Virology", focus: "antimicrobial susceptibility and virology", badge: "Resistance Reader", bankTopics: [] }
  ],
  bloodbank: [
    { id: "bb-abo", name: "ABO & Rh", focus: "ABO and Rh typing and discrepancies", badge: "Type Specialist", bankTopics: ["ABO typing"] },
    { id: "bb-antibody", name: "Antibody ID", focus: "antibody screening and identification", badge: "Panel Master", bankTopics: ["Antibody identification"] },
    { id: "bb-compat", name: "Compatibility & Reactions", focus: "compatibility testing and transfusion reactions", badge: "Crossmatch Keeper", bankTopics: ["Transfusion reactions"] },
    { id: "bb-hdfn", name: "HDFN & Prenatal", focus: "HDFN and prenatal testing", badge: "Newborn Guardian", bankTopics: ["HDFN"] },
    { id: "bb-components", name: "Components & Donors", focus: "blood components, storage and donor screening", badge: "Component Curator", bankTopics: ["Blood components", "Component storage"] }
  ],
  immunology: [
    { id: "imm-auto", name: "Autoantibodies & ANA", focus: "autoantibodies and ANA patterns", badge: "Pattern Reader", bankTopics: ["Autoantibodies"] },
    { id: "imm-serology", name: "Infectious Serology", focus: "infectious disease serology (hepatitis, syphilis, HIV)", badge: "Serology Scout", bankTopics: ["Hepatitis serology", "Syphilis serology"] },
    { id: "imm-assays", name: "Immunoassays", focus: "immunoassay principles (ELISA, agglutination, precipitation)", badge: "Assay Architect", bankTopics: ["Immunoassay principles"] },
    { id: "imm-complement", name: "Complement & Igs", focus: "complement, immunoglobulins and hypersensitivity", badge: "Antibody Artisan", bankTopics: ["Immunoglobulins"] },
    { id: "imm-transplant", name: "Transplant & Tumor", focus: "transplant and tumor immunology", badge: "HLA Handler", bankTopics: [] }
  ]
};

export const findTopic = (topicId: string | null | undefined) => {
  if (!topicId) return null;
  for (const [category, topics] of Object.entries(EXAM_TOPICS)) {
    const topic = topics.find(t => t.id === topicId);
    if (topic) return { category, topic };
  }
  return null;
};

/** Pass mark for a topic exam to earn its badge. */
export const TOPIC_BADGE_SCORE = 70;
/** Minimum answered questions for a topic exam to count. */
export const TOPIC_BADGE_MIN_QUESTIONS = 10;
