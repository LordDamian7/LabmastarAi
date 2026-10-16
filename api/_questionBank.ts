// Offline, board-style question bank used when Gemini is unavailable (no API key,
// quota errors, network failures). Files prefixed with "_" are not deployed as
// separate Vercel functions; this module is bundled into api/index.ts.

export interface BankLabValue {
  parameter: string;
  result: string;
  referenceRange: string;
  status: string;
}

export interface BankQuestion {
  topic: string;
  stem: string;
  labData?: BankLabValue[];
  options: string[];
  answerIndex: number;
  explanation: string;
}

export const QUESTION_BANK: Record<string, BankQuestion[]> = {
  chemistry: [
    {
      topic: "Pre-analytical errors",
      stem: "An ICU patient's potassium rises from 4.1 to 7.2 mmol/L in two hours with no clinical change, and the serum has a pink-red tinge. What is the most likely cause?",
      labData: [
        { parameter: "Potassium", result: "7.2 mmol/L", referenceRange: "3.5 – 5.1", status: "Critical High" },
        { parameter: "Serum appearance", result: "Pink-red", referenceRange: "Clear, straw", status: "Abnormal" }
      ],
      options: ["In vitro hemolysis during collection", "Acute renal failure", "Potassium infusion", "Metabolic alkalosis"],
      answerIndex: 0,
      explanation: "Red cells contain roughly 25× more potassium than plasma. Hemolysis releases it into the specimen, producing a falsely high result with a visibly pink serum. Recollect the sample with good technique."
    },
    {
      topic: "Pre-analytical errors",
      stem: "A chemistry panel shows potassium 9.8 mmol/L and total calcium 2.1 mg/dL in a patient who is alert and has a normal ECG. What most likely happened?",
      labData: [
        { parameter: "Potassium", result: "9.8 mmol/L", referenceRange: "3.5 – 5.1", status: "Critical High" },
        { parameter: "Calcium, total", result: "2.1 mg/dL", referenceRange: "8.6 – 10.2", status: "Critical Low" }
      ],
      options: ["K₂EDTA contamination of the specimen", "Hypoparathyroidism", "Rhabdomyolysis", "Prolonged tourniquet time only"],
      answerIndex: 0,
      explanation: "K₂EDTA (lavender-top additive) adds potassium and chelates calcium. An impossibly high K⁺ with very low Ca²⁺ in a stable patient points to EDTA carry-over or a wrong-tube transfer."
    },
    {
      topic: "Electrolytes & acid–base",
      stem: "Calculate the anion gap: Na⁺ 140 mmol/L, Cl⁻ 100 mmol/L, HCO₃⁻ 24 mmol/L (without potassium).",
      options: ["12 mmol/L", "16 mmol/L", "20 mmol/L", "40 mmol/L"],
      answerIndex: 1,
      explanation: "Anion gap = Na⁺ − (Cl⁻ + HCO₃⁻) = 140 − (100 + 24) = 16 mmol/L. That is mildly elevated; the usual range is about 8–16 mmol/L depending on the method."
    },
    {
      topic: "Cardiac markers",
      stem: "Which biomarker is the most specific laboratory indicator of myocardial injury?",
      options: ["Cardiac troponin I or T", "Total creatine kinase", "Myoglobin", "Lactate dehydrogenase"],
      answerIndex: 0,
      explanation: "Cardiac troponins are found almost only in heart muscle and are the guideline marker for myocardial infarction. CK, myoglobin and LD are also released by skeletal muscle and other tissues."
    },
    {
      topic: "Enzymes",
      stem: "A patient has severe epigastric pain radiating to the back. Which test is more specific for acute pancreatitis?",
      options: ["Serum lipase", "Serum amylase", "Alkaline phosphatase", "Gamma-glutamyl transferase"],
      answerIndex: 0,
      explanation: "Lipase is more specific to the pancreas and stays elevated longer than amylase, which is also produced by the salivary glands."
    },
    {
      topic: "Liver function",
      stem: "Which enzyme pattern best fits acute viral hepatitis?",
      labData: [
        { parameter: "ALT", result: "1,200 U/L", referenceRange: "7 – 56", status: "Critical High" },
        { parameter: "AST", result: "900 U/L", referenceRange: "10 – 40", status: "High" },
        { parameter: "ALP", result: "150 U/L", referenceRange: "44 – 147", status: "High" }
      ],
      options: ["Hepatocellular injury", "Cholestatic (obstructive) injury", "Bone disease", "Normal liver function"],
      answerIndex: 0,
      explanation: "Aminotransferases in the hundreds to thousands with only a slight ALP rise indicate hepatocellular damage. Obstruction instead raises ALP and GGT disproportionately."
    },
    {
      topic: "Interferences",
      stem: "A milky, turbid serum gives erratic photometric results. What is the best way to remove this interference before testing?",
      options: ["High-speed ultracentrifugation", "Adding EDTA", "Warming the sample to 37 °C", "Diluting with water only"],
      answerIndex: 0,
      explanation: "Lipemia scatters light. Ultracentrifugation (or a lipid-clearing agent) separates the chylomicron layer so the clear infranatant can be tested."
    },
    {
      topic: "Carbohydrates",
      stem: "Hemoglobin A1c reflects a patient's average blood glucose over approximately what period?",
      options: ["2–3 months", "2–3 weeks", "24 hours", "6–12 months"],
      answerIndex: 0,
      explanation: "Glucose binds hemoglobin irreversibly for the red cell's ~120-day lifespan, so HbA1c reflects glycemic control over the previous 2–3 months."
    }
  ],
  hematology: [
    {
      topic: "White cell disorders",
      stem: "A febrile patient's smear shows increased band neutrophils, toxic granulation and Döhle bodies. What do these findings most suggest?",
      labData: [
        { parameter: "WBC", result: "18.5 × 10³/µL", referenceRange: "4.5 – 11.0", status: "High" },
        { parameter: "Bands", result: "14 %", referenceRange: "0 – 5", status: "High" }
      ],
      options: ["Bacterial infection (left shift)", "Chronic lymphocytic leukemia", "Viral infection", "Megaloblastic anemia"],
      answerIndex: 0,
      explanation: "A left shift with toxic changes is the classic reactive response to bacterial infection or sepsis."
    },
    {
      topic: "Anemias",
      stem: "Which diagnosis fits these results?",
      labData: [
        { parameter: "Hemoglobin", result: "8.9 g/dL", referenceRange: "12.0 – 15.5", status: "Low" },
        { parameter: "MCV", result: "68 fL", referenceRange: "80 – 100", status: "Low" },
        { parameter: "Ferritin", result: "6 ng/mL", referenceRange: "15 – 150", status: "Low" }
      ],
      options: ["Iron deficiency anemia", "Beta-thalassemia minor", "Anemia of chronic disease", "Vitamin B12 deficiency"],
      answerIndex: 0,
      explanation: "Microcytic anemia with low ferritin means depleted iron stores. Thalassemia trait and anemia of chronic disease have normal or high ferritin."
    },
    {
      topic: "Anemias",
      stem: "A smear shows macro-ovalocytes and hypersegmented neutrophils. MCV is 112 fL. What is the most likely cause?",
      options: ["Vitamin B12 or folate deficiency", "Iron deficiency", "Hereditary spherocytosis", "Acute blood loss"],
      answerIndex: 0,
      explanation: "Megaloblastic anemia from impaired DNA synthesis (B12 or folate deficiency) gives macro-ovalocytes and neutrophils with six or more lobes."
    },
    {
      topic: "Red cell morphology",
      stem: "Numerous schistocytes and a platelet count of 22 × 10³/µL are most consistent with which process?",
      options: ["Microangiopathic hemolytic anemia (e.g., TTP or DIC)", "Iron deficiency", "Aplastic anemia", "Lead poisoning"],
      answerIndex: 0,
      explanation: "Schistocytes form when red cells are sheared by fibrin strands in small vessels. Combined with thrombocytopenia this suggests TTP, HUS or DIC, which are emergencies."
    },
    {
      topic: "Hemostasis",
      stem: "A patient has a prolonged PT, a normal aPTT and a normal platelet count. What is the most likely explanation?",
      options: ["Early warfarin therapy or factor VII deficiency", "Hemophilia A", "Heparin therapy", "von Willebrand disease"],
      answerIndex: 0,
      explanation: "Factor VII is only in the extrinsic pathway (PT) and has the shortest half-life, so it falls first with warfarin. Hemophilia and heparin prolong the aPTT."
    },
    {
      topic: "Hemostasis",
      stem: "A prolonged aPTT corrects when mixed 1:1 with normal pooled plasma. This indicates:",
      options: ["A factor deficiency", "A lupus anticoagulant", "A specific factor inhibitor", "Heparin contamination"],
      answerIndex: 0,
      explanation: "Normal plasma supplies the missing factor, so the time corrects. An inhibitor (lupus anticoagulant, factor VIII inhibitor) would also inhibit the normal plasma and fail to correct."
    },
    {
      topic: "Leukemias",
      stem: "Auer rods seen in blasts are characteristic of which lineage?",
      options: ["Myeloid (e.g., AML)", "Lymphoid (e.g., ALL)", "Plasma cell", "Erythroid only"],
      answerIndex: 0,
      explanation: "Auer rods are fused primary (azurophilic) granules and are found only in myeloid blasts, confirming myeloid lineage."
    },
    {
      topic: "Instrumentation",
      stem: "An analyzer reports platelets of 45 × 10³/µL, but the smear shows large platelet clumps. What is the best next step?",
      options: ["Recollect in sodium citrate and repeat the count", "Report the result as critical", "Order a bone marrow biopsy", "Transfuse platelets"],
      answerIndex: 0,
      explanation: "EDTA-dependent platelet clumping causes pseudothrombocytopenia. A citrate tube (corrected for dilution) usually gives the true count."
    }
  ],
  microbiology: [
    {
      topic: "Gram-positive organisms",
      stem: "Gram-positive cocci in clusters are catalase positive and coagulase positive. Which organism is most likely?",
      options: ["Staphylococcus aureus", "Staphylococcus epidermidis", "Streptococcus pyogenes", "Enterococcus faecalis"],
      answerIndex: 0,
      explanation: "Staphylococci are catalase positive. Coagulase separates S. aureus from coagulase-negative species such as S. epidermidis."
    },
    {
      topic: "Gram-positive organisms",
      stem: "A throat isolate is a beta-hemolytic, catalase-negative gram-positive coccus in chains that is susceptible to bacitracin and PYR positive. Identify it.",
      options: ["Streptococcus pyogenes (group A)", "Streptococcus agalactiae (group B)", "Streptococcus pneumoniae", "Enterococcus faecalis"],
      answerIndex: 0,
      explanation: "Group A strep is beta-hemolytic, bacitracin susceptible and PYR positive. Group B is bacitracin resistant and CAMP positive."
    },
    {
      topic: "Gram-negative organisms",
      stem: "A urine isolate forms pink, flat colonies on MacConkey agar and is indole positive and oxidase negative. Most likely:",
      options: ["Escherichia coli", "Pseudomonas aeruginosa", "Proteus mirabilis", "Klebsiella pneumoniae"],
      answerIndex: 0,
      explanation: "E. coli ferments lactose (pink on MacConkey), is indole positive and oxidase negative. Klebsiella is indole negative and mucoid; Proteus is a non-fermenter of lactose."
    },
    {
      topic: "Gram-negative organisms",
      stem: "A non-lactose-fermenting, oxidase-positive gram-negative rod produces a blue-green pigment and a grape-like odor. Identify it.",
      options: ["Pseudomonas aeruginosa", "Escherichia coli", "Salmonella enterica", "Acinetobacter baumannii"],
      answerIndex: 0,
      explanation: "Pyocyanin pigment, a fruity grape odor and a positive oxidase test are classic for P. aeruginosa. Acinetobacter is oxidase negative."
    },
    {
      topic: "Mycobacteria",
      stem: "Which stain is used to detect Mycobacterium tuberculosis in a sputum smear?",
      options: ["Acid-fast stain (Ziehl–Neelsen or Kinyoun)", "Gram stain", "India ink", "Giemsa stain"],
      answerIndex: 0,
      explanation: "Mycolic acids in the cell wall retain carbol fuchsin after acid-alcohol decolorization, so mycobacteria appear red on a blue background."
    },
    {
      topic: "Gram-negative organisms",
      stem: "Gram-negative intracellular diplococci are seen in a urethral discharge. The isolate grows on Thayer–Martin agar and is oxidase positive. Most likely:",
      options: ["Neisseria gonorrhoeae", "Neisseria meningitidis", "Moraxella catarrhalis", "Haemophilus influenzae"],
      answerIndex: 0,
      explanation: "N. gonorrhoeae is an oxidase-positive gram-negative diplococcus that ferments glucose only and is selectively grown on Thayer–Martin medium."
    },
    {
      topic: "Gram-positive organisms",
      stem: "A vaginal–rectal screening isolate is CAMP positive and hippurate hydrolysis positive. Identify it.",
      options: ["Streptococcus agalactiae (group B)", "Streptococcus pyogenes (group A)", "Listeria monocytogenes", "Enterococcus faecalis"],
      answerIndex: 0,
      explanation: "Group B strep enhances S. aureus beta-hemolysis (CAMP positive) and hydrolyzes hippurate. Prenatal screening prevents neonatal sepsis."
    },
    {
      topic: "Gram-positive organisms",
      stem: "An alpha-hemolytic gram-positive diplococcus from sputum is optochin susceptible and bile soluble. Identify it.",
      options: ["Streptococcus pneumoniae", "Viridans streptococci", "Enterococcus faecalis", "Staphylococcus aureus"],
      answerIndex: 0,
      explanation: "S. pneumoniae is lysed by bile and inhibited by optochin. Viridans streptococci are also alpha-hemolytic but resistant to both."
    }
  ],
  bloodbank: [
    {
      topic: "ABO typing",
      stem: "What is the ABO group?",
      labData: [
        { parameter: "Anti-A", result: "4+", referenceRange: "Forward type", status: "Positive" },
        { parameter: "Anti-B", result: "0", referenceRange: "Forward type", status: "Normal" },
        { parameter: "A₁ cells", result: "0", referenceRange: "Reverse type", status: "Normal" },
        { parameter: "B cells", result: "4+", referenceRange: "Reverse type", status: "Positive" }
      ],
      options: ["Group A", "Group B", "Group AB", "Group O"],
      answerIndex: 0,
      explanation: "The cells carry A antigen (react with anti-A) and the plasma contains anti-B (agglutinates B cells), which is group A. Forward and reverse types agree."
    },
    {
      topic: "Blood components",
      stem: "In an emergency when the patient's type is unknown, which red cells are given?",
      options: ["Group O, Rh-negative", "Group AB, Rh-positive", "Group A, Rh-negative", "Group B, Rh-negative"],
      answerIndex: 0,
      explanation: "Group O red cells lack A and B antigens, so they are compatible with any recipient's ABO antibodies. Rh-negative avoids D sensitization."
    },
    {
      topic: "Blood components",
      stem: "Which ABO group is the universal donor for plasma?",
      options: ["Group AB", "Group O", "Group A", "Group B"],
      answerIndex: 0,
      explanation: "AB plasma contains neither anti-A nor anti-B, so it will not damage the red cells of any recipient."
    },
    {
      topic: "HDFN",
      stem: "A group A newborn of a group O mother is jaundiced at 20 hours with a weakly positive DAT. What is the most likely cause?",
      options: ["ABO hemolytic disease of the fetus and newborn", "Rh (anti-D) HDFN", "Physiologic jaundice", "G6PD deficiency"],
      answerIndex: 0,
      explanation: "Group O mothers make IgG anti-A,B that crosses the placenta. ABO HDFN is common, usually mild, and gives a weakly positive DAT."
    },
    {
      topic: "HDFN",
      stem: "Rh immune globulin (anti-D) is indicated for which patient?",
      options: ["An Rh-negative mother with an Rh-positive fetus", "An Rh-positive mother with an Rh-negative fetus", "Any Rh-positive recipient of plasma", "An Rh-negative mother already producing anti-D"],
      answerIndex: 0,
      explanation: "RhIG is given at ~28 weeks and within 72 hours of delivering an Rh-positive baby to prevent sensitization. It does not help once active anti-D has formed."
    },
    {
      topic: "Antibody identification",
      stem: "Which antibody is typically IgM, reacts at room temperature and is usually clinically insignificant?",
      options: ["Anti-Leᵃ", "Anti-K", "Anti-Fyᵃ", "Anti-Jkᵃ"],
      answerIndex: 0,
      explanation: "Lewis antibodies are naturally occurring IgM and rarely cause hemolysis. Kell, Duffy and Kidd antibodies are IgG and clinically significant."
    },
    {
      topic: "Transfusion reactions",
      stem: "Which antibody is notorious for showing dosage, dropping below detectable levels, and causing delayed hemolytic transfusion reactions?",
      options: ["Anti-Jkᵃ (Kidd)", "Anti-M", "Anti-P1", "Anti-Leᵇ"],
      answerIndex: 0,
      explanation: "Kidd antibodies are evanescent and often missed on later screens. A re-exposure triggers a brisk anamnestic response days after transfusion."
    },
    {
      topic: "Component storage",
      stem: "How are platelet concentrates stored?",
      options: ["20–24 °C with continuous agitation", "1–6 °C without agitation", "−18 °C or colder", "37 °C in a water bath"],
      answerIndex: 0,
      explanation: "Platelets are stored at room temperature with gentle agitation (usually for 5–7 days). Refrigeration shortens their survival after transfusion."
    }
  ],
  immunology: [
    {
      topic: "Autoantibodies",
      stem: "A homogeneous (diffuse) ANA pattern on HEp-2 cells is most associated with antibodies to:",
      options: ["dsDNA and histones", "Centromere proteins", "Scl-70", "Ribonucleoproteins (speckled)"],
      answerIndex: 0,
      explanation: "Homogeneous staining reflects antibodies to chromatin components such as dsDNA and histones, seen in SLE and drug-induced lupus."
    },
    {
      topic: "Autoantibodies",
      stem: "A discrete speckled (centromere) ANA pattern is most associated with which condition?",
      options: ["Limited cutaneous systemic sclerosis (CREST)", "Systemic lupus erythematosus", "Rheumatoid arthritis", "Sjögren syndrome"],
      answerIndex: 0,
      explanation: "Anti-centromere antibodies give 40–60 discrete dots per nucleus and are a hallmark of the CREST variant of scleroderma."
    },
    {
      topic: "Immunoassay principles",
      stem: "A strongly suspected positive serum tests negative undiluted but positive at higher dilutions. This is called:",
      options: ["Prozone (antibody excess)", "Postzone (antigen excess)", "Zone of equivalence", "Cross-reactivity"],
      answerIndex: 0,
      explanation: "Excess antibody saturates antigen sites so lattices cannot form, causing false negatives. Diluting the serum restores the zone of equivalence."
    },
    {
      topic: "Syphilis serology",
      stem: "A reactive RPR screen should be confirmed with which test?",
      options: ["A treponemal test such as TP-PA or FTA-ABS", "A repeat RPR on the same sample", "A VDRL on serum", "A monospot test"],
      answerIndex: 0,
      explanation: "RPR and VDRL are non-treponemal and can be falsely positive (pregnancy, autoimmune disease). Treponemal tests detect antibodies to T. pallidum itself."
    },
    {
      topic: "Immunoglobulins",
      stem: "Which immunoglobulin class is the first to appear in a primary immune response?",
      options: ["IgM", "IgG", "IgA", "IgE"],
      answerIndex: 0,
      explanation: "IgM rises first, so specific IgM indicates a recent or acute infection. IgG follows and persists."
    },
    {
      topic: "Hepatitis serology",
      stem: "Interpret this hepatitis B panel.",
      labData: [
        { parameter: "HBsAg", result: "Reactive", referenceRange: "Nonreactive", status: "Abnormal" },
        { parameter: "Anti-HBc IgM", result: "Reactive", referenceRange: "Nonreactive", status: "Abnormal" },
        { parameter: "Anti-HBs", result: "Nonreactive", referenceRange: "—", status: "Normal" }
      ],
      options: ["Acute hepatitis B infection", "Immunity from vaccination", "Resolved past infection", "Chronic infection with low replication"],
      answerIndex: 0,
      explanation: "Surface antigen plus IgM anti-core with no anti-HBs indicates an acute infection."
    },
    {
      topic: "Hepatitis serology",
      stem: "A healthcare worker has anti-HBs reactive, HBsAg nonreactive and total anti-HBc nonreactive. What does this mean?",
      options: ["Immune from hepatitis B vaccination", "Acute infection", "Resolved natural infection", "Chronic carrier"],
      answerIndex: 0,
      explanation: "Vaccination produces only anti-HBs. Natural infection would also leave anti-HBc."
    },
    {
      topic: "Immunoglobulins",
      stem: "Which immunoglobulin crosses the placenta to protect the newborn?",
      options: ["IgG", "IgM", "IgA", "IgD"],
      answerIndex: 0,
      explanation: "IgG is actively transported across the placenta via the neonatal Fc receptor. This is also why maternal IgG antibodies can cause HDFN."
    }
  ]
};
