import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { PDFParse } from "pdf-parse";
// @ts-ignore
import mammoth from "mammoth";

dotenv.config();

const app = express();
// Raise the body limit: /api/parse-file and /api/chat receive base64-encoded
// files and images. Express's default json limit is 100kb, which would reject
// almost any real upload. NOTE: Vercel's platform still caps request bodies at
// ~4.5MB regardless of this setting (see README "Known limitations").
app.use(express.json({ limit: "25mb" }));

// Lazy initialize Gemini AI client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY environment variable is not set with a real key.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Check if Gemini is fully operational
app.get("/api/status", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  res.json({
    status: hasKey ? "online" : "simulation",
    engine: hasKey ? "Gemini 3.5 Flash" : "Local Lab Engine",
  });
});

// Parse Study Material endpoint for RAG
app.post("/api/parse-file", async (req, res) => {
  try {
    const { fileName, fileType, base64Data } = req.body;
    if (!fileName || !fileType || !base64Data) {
      return res.status(400).json({ error: "Missing fileName, fileType, or base64Data." });
    }

    const fileBuffer = Buffer.from(base64Data, "base64");
    let extractedText = "";
    let wordCount = 0;
    let pageCount = 1;

    if (fileType === "pdf") {
      let parser: PDFParse | null = null;
      try {
        // pdf-parse v2 API: construct with { data }, then getText() -> { text, total }.
        parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
        const parsed = await parser.getText();
        extractedText = parsed.text || "";
        pageCount = parsed.total || 1;
        wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;
      } catch (pdfErr: any) {
        console.error("PDF Parsing error:", pdfErr);
        return res.status(500).json({ error: "Failed to parse PDF file. Ensure it is not password-protected or corrupted." });
      } finally {
        // Release the pdfjs worker/handles so the serverless invocation can exit cleanly.
        if (parser) {
          try { await parser.destroy(); } catch { /* noop */ }
        }
      }
    } else if (fileType === "docx") {
      try {
        const mammothProcessor = (mammoth as any).default || mammoth;
        const parsed = await mammothProcessor.extractRawText({ buffer: fileBuffer });
        extractedText = parsed.value || "";
        wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;
        pageCount = Math.max(1, Math.ceil(wordCount / 300));
      } catch (docxErr: any) {
        console.error("DOCX extraction error:", docxErr);
        return res.status(500).json({ error: "Failed to extract text from DOCX file." });
      }
    } else if (["txt", "md", "csv", "json"].includes(fileType)) {
      extractedText = fileBuffer.toString("utf-8");
      wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;
      pageCount = Math.max(1, Math.ceil(wordCount / 350));
    } else {
      extractedText = `[IMAGE REFERENCE: ${fileName}]`;
      wordCount = 0;
      pageCount = 1;
    }

    const originalLength = extractedText.length;
    const isTruncated = originalLength > 150000;
    if (isTruncated) {
      extractedText = extractedText.substring(0, 150000) + "\n\n[Content truncated due to size limits]";
    }

    let summary = "";
    if (wordCount > 0) {
      const snippets = extractedText.substring(0, 200).replace(/\s+/g, " ").trim();
      summary = snippets ? snippets + "..." : "Empty reference file.";
    } else {
      summary = `Multimodal visual study reference (${fileType.toUpperCase()})`;
    }

    res.json({
      success: true,
      extractedText,
      wordCount,
      pageCount,
      summary,
      isTruncated
    });

  } catch (err: any) {
    console.error("Error in parse-file:", err);
    res.status(500).json({ error: err.message });
  }
});

// Preset high-fidelity clinical cases for offline/simulation mode
const PRESET_CASES: Record<string, any[]> = {
  chemistry: [
    {
      id: "chem-001",
      title: "Delta Check Failure in Hyperkalemia",
      difficulty: "Advanced",
      scenario: "An ICU patient's daily morning basic metabolic panel (BMP) shows a potassium level of 7.2 mmol/L. Only 2 hours ago, the potassium was 4.1 mmol/L. There is no history of renal failure, cardiovascular events, or potassium infusion. A delta check alert is flagged by the Laboratory Information System (LIS).",
      labData: [
        { parameter: "Potassium (K+)", result: "7.2 mmol/L", referenceRange: "3.5 - 5.1 mmol/L", status: "Critical High" },
        { parameter: "Sodium (Na+)", result: "139 mmol/L", referenceRange: "135 - 145 mmol/L", status: "Normal" },
        { parameter: "Calcium (ionized)", result: "1.18 mmol/L", referenceRange: "1.15 - 1.30 mmol/L", status: "Normal" },
        { parameter: "Glucose", result: "105 mg/dL", referenceRange: "70 - 99 mg/dL", status: "High" },
        { parameter: "Serum Color Observation", result: "Slight Pinkish-Red Discoloration", referenceRange: "Clear / Straw Coloured", status: "High" }
      ],
      questions: [
        {
          id: 1,
          text: "What is the most likely pre-analytical explanation for this extreme potassium delta check failure?",
          hint: "Look at the serum color observation and consider what intracellular cation leaks out.",
          type: "multiple-choice",
          options: [
            "Patient was infused with saline line",
            "In vitro hemolysis due to poor venipuncture technique or syringe shear",
            "Slight contamination with anticoagulant EDTA from purple top tube",
            "Contamination with Heparin anticoagulant"
          ],
          correctAnswer: "In vitro hemolysis due to poor venipuncture technique or syringe shear"
        },
        {
          id: 2,
          text: "Which of the following analytes would also be artifactually elevated along with Potassium in a hemolyzed specimen?",
          hint: "Consider other enzymes or ions highly concentrated inside erythrocytes.",
          type: "multiple-choice",
          options: [
            "Amylase and Lipase",
            "Lactate Dehydrogenase (LD) and AST",
            "Alkaline Phosphatase and GGT",
            "Bilirubin and Urine blood"
          ],
          correctAnswer: "Lactate Dehydrogenase (LD) and AST"
        },
        {
          id: 3,
          text: "What corrective action should the Medical Laboratory Scientist take before releasing these results?",
          hint: "Think about LIS standards and safety instructions.",
          type: "multiple-choice",
          options: [
            "Approve the critical result immediately since it is an ICU patient",
            "Add a delta-check description note and report the critical potassium value",
            "Reject the sample due to hemolysis, request a redraw, and inform the nursing staff",
            "Dilute the serum sample 1:2 with saline and program a rerun on the analyzer"
          ],
          correctAnswer: "Reject the sample due to hemolysis, request a redraw, and inform the nursing staff"
        }
      ]
    }
  ],
  hematology: [
    {
      id: "hem-001",
      title: "Left Shift and Neutrophilic Inclusion",
      difficulty: "Intermediate",
      scenario: "A 45-year-old male with a high-grade fever (39.2°C), productive cough, and tachypnea is admitted. A CBC is ordered. The automated hematology analyzer flags WBC abnormalities, trigger-forcing a manual differential blood smear inspection.",
      labData: [
        { parameter: "White Blood Cells (WBC)", result: "18.5 x 10³/µL", referenceRange: "4.5 - 11.0 x 10³/µL", status: "High" },
        { parameter: "Hemoglobin", result: "13.8 g/dL", referenceRange: "13.5 - 17.5 g/dL", status: "Normal" },
        { parameter: "Platelets", result: "240 x 10³/µL", referenceRange: "150 - 450 x 10³/µL", status: "Normal" },
        { parameter: "Band Neutrophils", result: "14%", referenceRange: "0% - 5%", status: "High" },
        { parameter: "Toxic Granulation & Döhle Bodies", result: "Obvious in segmented neutrophils", referenceRange: "None Observed", status: "High" }
      ],
      questions: [
        {
          id: 1,
          text: "What do the elevated Band Neutrophils and Döhle bodies clinically indicate in this patient?",
          hint: "Think about the bone marrow rushing cells into circulation during acute bacterial response.",
          type: "multiple-choice",
          options: [
            "Chronic lymphocytic leukemia",
            "Severe systemic infection or septicemia (Left Shift)",
            "Immune thrombocytopenia",
            "Megaloblastic anemia"
          ],
          correctAnswer: "Severe systemic infection or septicemia (Left Shift)"
        },
        {
          id: 2,
          text: "What material makes up Döhle bodies inside neutrophils?",
          hint: "This cellular organelle synthesizes proteins.",
          type: "multiple-choice",
          options: [
            "Aggregates of rough endoplasmic reticulum (RER)",
            "Precipitated cell membrane lipids",
            "Deoxyribonucleic acid (DNA) fragments",
            "Precipitated iron granules"
          ],
          correctAnswer: "Aggregates of rough endoplasmic reticulum (RER)"
        },
        {
          id: 3,
          text: "If you also observed small, blue-black cytoplasmic granules resembling bacteria inside the neutrophils, what are they called?",
          hint: "These are primary lysosomes.",
          type: "short-answer",
          correctAnswer: "Toxic granulation"
        }
      ]
    }
  ],
  microbiology: [
    {
      id: "micro-001",
      title: "Urinary Tract Gram Negative Rod",
      difficulty: "Beginner",
      scenario: "A urine specimen from a 26-year-old outpatient female complaining of dysuria and frequency is cultured. After 24 hours of incubation, the MacConkey agar plate shows large, flat pink colonies with a dark pink ring around them, producing a distinct sweetish-sour odor. The blood agar shows beta-hemolysis.",
      labData: [
        { parameter: "Gram Stain of Colony", result: "Gram-Negative Bacilli (Rods)", referenceRange: "No Growth", status: "High" },
        { parameter: "MacConkey Agar", result: "Lactose Fermenting, Flat Pink", referenceRange: "No Growth", status: "High" },
        { parameter: "Oxidase Test", result: "Negative", referenceRange: "Not Applicable", status: "Normal" },
        { parameter: "Indole Test", result: "Positive", referenceRange: "Not Applicable", status: "Normal" }
      ],
      questions: [
        {
          id: 1,
          text: "Which Gram-negative rod is the most common cause of UTI and fits these exact colony morphologies and biochemical results?",
          hint: "Think of a lactose-fermenting, oxidase-negative, indole-positive enterobacteriaceae.",
          type: "multiple-choice",
          options: [
            "Pseudomonas aeruginosa",
            "Escherichia coli",
            "Klebsiella pneumoniae",
            "Proteus mirabilis"
          ],
          correctAnswer: "Escherichia coli"
        },
        {
          id: 2,
          text: "Why do colonies of this organism appear pink on MacConkey agar?",
          hint: "Consider what sugar is fermented to release acid which alters the pH indicator neutral red.",
          type: "multiple-choice",
          options: [
            "The organism ferments Glucose",
            "The organism ferments Lactose",
            "The organism produces H2S gas",
            "The organism breaks down peptone"
          ],
          correctAnswer: "The organism ferments Lactose"
        },
        {
          id: 3,
          text: "What rapid biochemical test can distinguish Proteus species (urine pathogen) from Escherichia coli based on active enzyme release that splits urea?",
          hint: "Proteus is famously alkaline on urine screens.",
          type: "short-answer",
          correctAnswer: "Urease test"
        }
      ]
    }
  ],
  bloodbank: [
    {
      id: "bb-001",
      title: "ABO Red Blood Cell Discrepancy",
      difficulty: "Advanced",
      scenario: "During pre-transfusion testing for a 62-year-old patient scheduled for hip replacement, the laboratory scientist obtains discrepant results in ABO typing. Immediate forward typing shows a strong agglutination with Anti-A, but reverse typing also shows moderate agglutination with A1 cells.",
      labData: [
        { parameter: "Forward: Anti-A", result: "4+", referenceRange: "Strong Agglutination", status: "Normal" },
        { parameter: "Forward: Anti-B", result: "0 (Negative)", referenceRange: "Negative", status: "Normal" },
        { parameter: "Forward: Anti-D (Rh)", result: "3+", referenceRange: "Agglutination", status: "Normal" },
        { parameter: "Reverse: A1 Cells", result: "2+ Agglutination", referenceRange: "Negative for Type A", status: "High" },
        { parameter: "Reverse: B Cells", result: "4+ Agglutination", referenceRange: "Agglutination", status: "Normal" }
      ],
      questions: [
        {
          id: 1,
          text: "What subgroup of 'A' or cold-reactive antibody could cause a patient who forward types as 'A' to agglutinate A1 reagent cells in the reverse grouping?",
          hint: "Consider typing subgroups of A (especially A2 vs A1) or anti-A1 antibodies.",
          type: "multiple-choice",
          options: [
            "Bombay phenotype",
            "A2 subgroup with naturally-occurring Anti-A1 antibody in their serum",
            "Agglutination due to severe rouleaux formation",
            "Inadequate washing of donor erythrocytes"
          ],
          correctAnswer: "A2 subgroup with naturally-occurring Anti-A1 antibody in their serum"
        },
        {
          id: 2,
          text: "What reagent lectin can be used to resolve this discrepancy by confirming if the patient's red blood cells carry the true A1 antigen?",
          hint: "This lectin extracted from Dolichos biflorus acts as Anti-A1.",
          type: "multiple-choice",
          options: [
            "Dolichos biflorus lectin (Anti-A1)",
            "Ulex europaeus lectin (Anti-H)",
            "Bandeiraea simplicifolia (Anti-B)",
            "Anti-human globulin (AHG)"
          ],
          correctAnswer: "Dolichos biflorus lectin (Anti-A1)"
        },
        {
          id: 3,
          text: "What is the standard incubation protocol to enhance or resolve weak/discrepant antibody reactions that may be due to cold-reacting IgM autoantibodies like Anti-I?",
          hint: "Cold autoantibodies react best at lower temperature than 37°C.",
          type: "short-answer",
          correctAnswer: "Prewarm technique"
        }
      ]
    }
  ],
  immunology: [
    {
      id: "imm-001",
      title: "Antinuclear Antibody (ANA) Pattern Recognition",
      difficulty: "Intermediate",
      scenario: "A 31-year-old female complaining of joint stiffness, exhaustion, and a persistent butterfly rash on her cheek is screened for rheumatologic markers. An Indirect Immunofluorescence Assay (IFA) is performed using HEp-2 cells to identify anti-nuclear antibodies (ANA).",
      labData: [
        { parameter: "ANA Titer (IFA)", result: "1:640", referenceRange: "< 1:40", status: "High" },
        { parameter: "ANA Homogeneous Pattern", result: "Positive", referenceRange: "Negative", status: "High" },
        { parameter: "Anti-dsDNA Antibody", result: "Positive (80 IU/mL)", referenceRange: "< 30 IU/mL", status: "High" },
        { parameter: "Rheumatoid Factor (RF)", result: "15 IU/mL", referenceRange: "< 14 IU/mL", status: "Normal" }
      ],
      questions: [
        {
          id: 1,
          text: "Which complex autoimmune disease is highly suspected based on a combination of high titer homogeneous ANA, positive anti-dsDNA, and butterfly rash?",
          hint: "Think Systemic Lupus...",
          type: "multiple-choice",
          options: [
            "Rheumatoid Arthritis",
            "Systemic Lupus Erythematosus (SLE)",
            "Sjögren's Syndrome",
            "Scleroderma (Systemic Sclerosis)"
          ],
          correctAnswer: "Systemic Lupus Erythematosus (SLE)"
        },
        {
          id: 2,
          text: "What nuclear components are targeted in an indirect immunofluorescence ANA assay showing a Homogeneous pattern?",
          hint: "These proteins act as spools around which DNA winds.",
          type: "multiple-choice",
          options: [
            "Nucleolar RNA polymerase",
            "Centromere kinetochore proteins",
            "Double-stranded DNA and histones",
            "Extractable Nuclear Antigens (ENA) like Sm or RNP"
          ],
          correctAnswer: "Double-stranded DNA and histones"
        },
        {
          id: 3,
          text: "Which antibodies are considered the most specific diagnostic marker for SLE, alongside anti-dsDNA?",
          hint: "It targets a core nuclear protein, abbreviated as anti-Sm.",
          type: "short-answer",
          correctAnswer: "Anti-Smith"
        }
      ]
    }
  ]
};

// 1. CHAT ENDPOINT
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, studyMaterials } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    // Construct standard system prompt
    const systemPrompt = `You are dynamic, patient, and highly knowledgeable Professor of Medical Laboratory Science (MLS). 
You teach concepts like Clinical Chemistry, Hematology & Urinalysis, Microbiology, Immunology, and Immunohematology (Blood Banking).
Guidelines:
1. Explain clinical concepts, biochemistries, reference ranges, pre-analytical & analytical errors, or delta check failures thoroughly.
2. If appropriate, write clear lists, chemical reactions, or interpret lab results tables.
3. Be conversational and highly supportive. Tailor to students' learning speed.
4. Keep paragraphs readable. Use markdown formatting. Use bullet points for steps.`;

    let finalSystemPrompt = systemPrompt;
    let activeImagesCount = 0;

    if (studyMaterials && Array.isArray(studyMaterials) && studyMaterials.length > 0) {
      const textDocs = studyMaterials.filter((m: any) => m.fileType !== "image");
      const imageDocs = studyMaterials.filter((m: any) => m.fileType === "image");
      activeImagesCount = imageDocs.length;

      if (textDocs.length > 0) {
        let docContext = "\n\n[=== STUDENT UPLOADED STUDY GUIDES & REFERENCE FILES (RAG) ===]\n";
        textDocs.forEach((doc: any, idx: number) => {
          docContext += `\nDocument idx: ${idx}\nFile Name: "${doc.fileName}" (${doc.fileType.toUpperCase()})\nText Extract Content:\n"""\n${doc.fullContent}\n"""\n`;
        });
        docContext += "\n[=== END OF STUDY RESOURCES ===]\n\n";
        docContext += "CRITICAL RAG INSTRUCTION FOR PROFESSOR:\n";
        docContext += "The user has provided the above study documents. Ground your teaching, logic, answers, and interpretations inside this referenced text! Cite source file names in brackets like [Source: fileName] if you reference explicit parameters. Be highly interactive, helping the user understand, parse, and review these guidelines.";
        
        finalSystemPrompt += docContext;
      }

      if (imageDocs.length > 0) {
        finalSystemPrompt += `\n\n[MULTI-MODAL IMAGE ASSISTANCE] The user has provided microscope or analyzer images. Review and describe whatever structures or patterns are present in these visual inputs to teach the student.`;
      }
    }

    try {
      const client = getGeminiClient();
      
      const contents = messages.map((m: any, idx: number) => {
        const role = m.role === "assistant" ? "model" : "user";
        const parts: any[] = [{ text: m.content }];

        // Attach visual images to the absolute last student message
        if (role === "user" && idx === messages.length - 1 && studyMaterials && Array.isArray(studyMaterials)) {
          const imageDocs = studyMaterials.filter((m: any) => m.fileType === "image");
          imageDocs.forEach((img: any) => {
            let cleanBase64 = img.fullContent;
            let mimeType = "image/jpeg";
            if (img.fullContent.includes(";base64,")) {
              const splitPayload = img.fullContent.split(";base64,");
              mimeType = splitPayload[0].replace("data:", "");
              cleanBase64 = splitPayload[1];
            }
            parts.push({
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64
              }
            });
          });
        }

        return { role, parts };
      });

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: finalSystemPrompt,
          temperature: 0.7,
        }
      });

      const text = response.text || "I was unable to formulate a response. Please check your query.";
      res.json({ content: text });
    } catch (apiError: any) {
      console.warn("Falling back to local simulation because Gemini API or RAG call failed:", apiError.message);
      
      const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
      let responseText = "";

      // Try searching client materials for simulation RAG
      let matchedDoc: any = null;
      let matchedExcerpt = "";

      if (studyMaterials && Array.isArray(studyMaterials) && studyMaterials.length > 0) {
        const textDocs = studyMaterials.filter((m: any) => m.fileType !== "image");
        for (const doc of textDocs) {
          if (doc.fullContent) {
            // Check for words from query
            const wordsMatch = lastUserMsg.split(/\s+/).filter((w: string) => w.length > 4);
            for (const word of wordsMatch) {
              const cleanWord = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
              const findIndex = doc.fullContent.toLowerCase().indexOf(cleanWord);
              if (findIndex !== -1 && cleanWord.length > 3) {
                matchedDoc = doc;
                const start = Math.max(0, findIndex - 120);
                const end = Math.min(doc.fullContent.length, findIndex + 250);
                matchedExcerpt = doc.fullContent.substring(start, end).replace(/\s+/g, " ").trim();
                break;
              }
            }
          }
          if (matchedDoc) break;
        }
      }

      if (matchedDoc) {
        responseText = `### 📚 [RAG Simulated Analysis: ${matchedDoc.fileName}]
Prof. LabMaster has localized key medical descriptors inside your uploaded textbook reference!

**Relevant Diagnostic Fragment Retrieved:**
"... ${matchedExcerpt} ..."

**Interactive Teaching Guidance:**
Based on your uploaded source **"${matchedDoc.fileName}"**, can you clarify how this parameter correlates with normal clinical ranges? To learn thoroughly, consider if this guides pre-analytical handling or analytical quality control!`;
      } else if (activeImagesCount > 0 && (lastUserMsg.includes("image") || lastUserMsg.includes("photo") || lastUserMsg.includes("picture") || lastUserMsg.includes("view") || lastUserMsg.includes("look"))) {
        responseText = `### 🔬 [RAG Image Diagnostic Simulation]
Prof. LabMaster has loaded your diagnostic microscopic photo / workspace capture!

**Visual Input Calibrations:**
* Actively processing: **${activeImagesCount} clinical images**.
* *Pre-analysis observations:* Typical cell count density or raw laboratory spectrums identified.

To interactively discuss this: Can you clarify if this sample slide was drawn under clean venipuncture, or what specific bacterial colonies/smears you expected to review at 100x oil immersion? Let's analyze it!`;
      } else if (lastUserMsg.includes("potassium") || lastUserMsg.includes("electrolyte") || lastUserMsg.includes("hemolysis")) {
        responseText = `### 🧬 Prof. LabMaster says: Excellent question about electrolyte imbalances!
In Medical Laboratory Science, **Potassium ($K^+$)** is the single most dangerous electrolyte when falsely elevated.
1. **Intracellular vs. Extracellular Concentration**: Inside RBCs, potassium is around **150 mmol/L** compared to only **3.5 - 5.0 mmol/L** in normal serum.
2. **Hemolysis**: If a red blood cell lyses due to rough drawing, dropping or drawing through a narrow line (pre-analytical error), just a fraction of cells releasing potassium alters the test.
3. **Delta Checks**: LIS systems catch this via a Delta Check (comparing the specimen against the patient's previous raw data within a specified hour range).

Would you like us to generate an interactive Hemolysis / Delta Check case to test your diagnostics skills?`;
      } else if (lastUserMsg.includes("micro") || lastUserMsg.includes("coli") || lastUserMsg.includes("gram")) {
        responseText = `### 🧫 Prof. LabMaster says: Greetings, aspiring Microbiologist!
Let us discuss **Gram Staining** and culture characteristics:
* **The Gram-Negative Outer Membrane**: Cell walls contain lipopolysaccharide (LPS). When rinsed with alcohol/acetone, the thin peptidoglycan layer loses the Crystal Violet-Iodine complex, and absorbs the pink counterstain (**Safranin**).
* **MacConkey Agar**: This selective/differential medium contains crystal violet and bile salts to inhibit Gram-positives, and lactose to highlight lactose fermenters (like *E. coli*, which produces pink, flat colonies with precipitates).

What specific microbial test can I clarify for you or simulate next?`;
      } else if (lastUserMsg.includes("blood") || lastUserMsg.includes("typing") || lastUserMsg.includes("transfusion")) {
        responseText = `### 🩸 Prof. LabMaster says: ABO discrepancies are the ultimate laboratory gold-standard puzzle!
A **Transfusion Medicine discrepancy** occurs when forward typing (patient's cells mixed with Anti-A & Anti-B antisera) does not match reverse typing (patient's serum mixed with reagent A1 & B cells).
* **Forward typing** tells you what antigens are on the patient's RBCs.
* **Reverse typing** tells you what isohemagglutinins are present in the serum. If discrepant, never transfuse non-emergency type-specific blood; always issue type O-negative packed red cells until solved!

How can I help you troubleshoot your Blood Bank gel cards or antibody screening panel?`;
      } else {
        responseText = `### 🔬 Prof. LabMaster AI Tutor
Welcome to your Clinical Lab Science workstation! I am ready to guide you or teach you based on your **uploaded study resources (PDF, DOCX, Images, Text)**!

1. **RAG active study**: Upload any files to ground our interactive discussion.
2. Ask me about **Clinical Chemistry, Hematology, Microbiology, Blood Bank, or Immunology**.
3. Generate simulation cases dynamically by clicking **Lab Specimen Simulator**!`;
      }

      res.json({ content: responseText, simulation: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GENERATE EXERCISE ENDPOINT
app.post("/api/generate-exercise", async (req, res) => {
  try {
    const { category, studyMaterials } = req.body; // chemistry, hematology, microbiology, bloodbank, immunology
    const validCategories = ["chemistry", "hematology", "microbiology", "bloodbank", "immunology"];
    const activeCategory = validCategories.includes(category) ? category : "chemistry";

    let ragPromptModifier = "";
    if (studyMaterials && Array.isArray(studyMaterials) && studyMaterials.length > 0) {
      const texts = studyMaterials.filter((m: any) => m.fileType !== "image");
      if (texts.length > 0) {
        ragPromptModifier = `\n\nCRITICAL DIRECTIVE: Create this exercise specifically based on the analytical characteristics, concepts, case patterns, or rules found in the uploaded reference manuals below:\n` +
          texts.map((t: any) => `Source File: "${t.fileName}"\n${t.fullContent.substring(0, 15000)}`).join("\n---\n") +
          `\n\nAnchor the scenario, the biochemical data, and the multiple choice/short answer questions on the material described. The questions must test if the student understands the guidelines and facts in these specific documents.`;
      }
    }

    try {
      const client = getGeminiClient();
      
      const prompt = `Generate a realistic clinical laboratory case study for the category "${activeCategory}".
The output must represent a genuine, challenging medical laboratory case of high educational value.${ragPromptModifier}

Return the case study as high-quality JSON according to this structure:
{
  "id": "chem-abc",
  "title": "A short engaging case title",
  "difficulty": "Beginner OR Intermediate OR Advanced",
  "scenario": "A rich clinic scenario describing patient demographics, LIS alarm warnings, symptoms, and physiological parameters that students must review.",
  "labData": [
    { "parameter": "Lab Analyte Name", "result": "Analyte value", "referenceRange": "Standard references range", "status": "Low/Normal/High/Critical High" }
  ],
  "questions": [
    {
      "id": 1,
      "text": "Critical interpretation question for this laboratory scientist",
      "hint": "A guiding clinical hint pointing to physiological pathways or pre-analytical errors.",
      "type": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B"
    },
    {
      "id": 2,
      "text": "Scientific or quality assurance question",
      "hint": "A hint explaining what reagents, controls, or physiological corrections are needed.",
      "type": "multiple-choice",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "Option 1"
    },
    {
      "id": 3,
      "text": "A clinical troubleshooting diagnostic question",
      "hint": "Hint pointing to a short keyword answer.",
      "type": "short-answer",
      "options": [],
      "correctAnswer": "Exact short-answer target keyword"
    }
  ]
}

Ensure the laboratory values are physiologically realistic and scientifically accurate for MLS training. Remember to return raw valid JSON matching this schema exactly.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              scenario: { type: Type.STRING },
              labData: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    parameter: { type: Type.STRING },
                    result: { type: Type.STRING },
                    referenceRange: { type: Type.STRING },
                    status: { type: Type.STRING }
                  },
                  required: ["parameter", "result", "referenceRange", "status"]
                }
              },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    text: { type: Type.STRING },
                    hint: { type: Type.STRING },
                    layer: { type: Type.STRING },
                    type: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    correctAnswer: { type: Type.STRING }
                  },
                  required: ["id", "text", "hint", "type", "correctAnswer"]
                }
              }
            },
            required: ["id", "title", "difficulty", "scenario", "labData", "questions"]
          }
        }
      });

      const dataText = response.text || "";
      const caseJson = JSON.parse(dataText.trim());
      res.json(caseJson);
    } catch (apiError: any) {
      console.warn("Generating preset fallback clinical case. Reason:", apiError.message);
      
      // Serve random preset case corresponding to the category
      const casesList = PRESET_CASES[activeCategory] || PRESET_CASES["chemistry"];
      const randomCase = casesList[Math.floor(Math.random() * casesList.length)];
      res.json(randomCase);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GRADE EXERCISE ENDPOINT
app.post("/api/grade-exercise", async (req, res) => {
  try {
    const { scenario, questions, rawLabData, studentAnswers } = req.body;
    if (!scenario || !questions || !studentAnswers) {
      return res.status(400).json({ error: "Missing required payload variables." });
    }

    try {
      const client = getGeminiClient();
      
      const evaluatorPrompt = `Review this Medical Laboratory Science clinical case performance.
Scenario: "${scenario}"
Laboratory Data: "${JSON.stringify(rawLabData)}"
Questions and Expected Answers: "${JSON.stringify(questions)}"
Student Submissions: "${JSON.stringify(studentAnswers)}"

Perform a rigorous evaluation. Return a JSON matching this structure:
{
  "score": 85,
  "summary": "Full clinical breakdown of their performance, praising correct points and giving medical rationale for gaps.",
  "questionFeedback": [
    {
      "id": 1,
      "correct": true,
      "feedback": "Why the student's answer is correct/incorrect, citing details such as chemical reaction, intracellular ion leakage rules, LIS alerts, or bacteriology staining patterns."
    }
  ],
  "pearlOfWisdom": "A highly memorable clinical rule of thumb for MLS students when working on similar cases in a live hospital setting."
}`;

      const gradingResponse = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: evaluatorPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER },
              summary: { type: Type.STRING },
              questionFeedback: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    correct: { type: Type.BOOLEAN },
                    feedback: { type: Type.STRING }
                  },
                  required: ["id", "correct", "feedback"]
                }
              },
              pearlOfWisdom: { type: Type.STRING }
            },
            required: ["score", "summary", "questionFeedback", "pearlOfWisdom"]
          }
        }
      });

      const outcomeText = gradingResponse.text || "{}";
      res.json(JSON.parse(outcomeText.trim()));
    } catch (apiError: any) {
      console.warn("Grading on-server offline fallback simulation. Reason:", apiError.message);
      
      // Build an automated rule-based grader for a beautiful offline experience
      let correctCount = 0;
      const questionFeedback = questions.map((q: any) => {
        const studentAns = studentAnswers[q.id] || "";
        const expected = q.correctAnswer || "";
        
        // Loose check for match
        const isMatch = studentAns.toString().trim().toLowerCase() === expected.toString().trim().toLowerCase() ||
                        expected.toString().trim().toLowerCase().includes(studentAns.toString().trim().toLowerCase()) && studentAns.toString().trim().length > 3;

        if (isMatch) {
          correctCount++;
        }

        return {
          id: q.id,
          correct: isMatch,
          feedback: isMatch 
            ? `Fantastic! You answered: "${studentAns}". This is exactly correct. Your diagnostic rationale matches standard CLSI guidelines.` 
            : `Plausible trial, but incorrect. You answered: "${studentAns || "Nothing"}". The key clinical expectation was: "${expected}". Re-examine the physiological levels or pre-analytical contamination characteristics.`
        };
      });

      const pctScore = Math.round((correctCount / questions.length) * 100);
      res.json({
        score: pctScore,
        summary: `You successfully analyzed ${correctCount} out of ${questions.length} diagnostics checkpoints! This case study reviews core protocols regarding automated flags, pre-analytical sample status, and biochemical results.`,
        questionFeedback,
        pearlOfWisdom: "Clinical Laboratory Rule: Always correlate extreme biochemical results with morphology (e.g., blood smear, specimen inspection) and previous patient records before reporting."
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// On Vercel, this Express app runs as a single serverless function. All `/api/*`
// requests are routed here by vercel.json. Static frontend assets (the Vite build
// in dist/) are served directly by Vercel's edge, so no static/Vite handling here.
// Local development uses ../server.ts, which imports this app and adds the Vite
// dev middleware + app.listen.
export default app;
