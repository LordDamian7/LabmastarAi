import express from "express";
import type { Request, Response, NextFunction } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import dotenv from "dotenv";
import type { PDFParse } from "pdf-parse";
// @ts-ignore
import mammoth from "mammoth";
import { QUESTION_BANK } from "./_questionBank.js";
import { EXAM_TOPICS, findTopic } from "./_topics.js";

dotenv.config();

const app = express();
// Request bodies are small JSON now: files go straight from the browser to
// Supabase Storage, and the API only receives storage paths and material ids.
app.use(express.json({ limit: "1mb" }));

// Same public URL + publishable key the browser uses. The server never holds a
// service-role key: every query runs as the signed-in user, so row-level
// security applies to the API exactly as it does to the browser.
// Accepts the manual VITE_* names or those created by the Vercel Supabase integration.
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;
const STUDY_BUCKET = "study-materials";

// Per-user AI call quotas (rolling windows), overridable via environment variables.
const AI_HOURLY_LIMIT = Number(process.env.AI_HOURLY_LIMIT) || 40;
const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 150;

// RAG budget: how much uploaded text is sent to the model per request. Keeping this
// bounded keeps latency well inside the 60s function limit and caps token spend.
const RAG_CHAR_BUDGET = 40000;
const RAG_CHUNK_SIZE = 1500;
const MAX_CONTEXT_IMAGES = 3;
// Only the most recent turns are sent to the model; full history stays in the database.
const MAX_HISTORY_MESSAGES = 20;

type AuthedRequest = Request & { user?: User; supabase?: SupabaseClient };

// Verifies the Supabase access token and attaches a user-scoped client to the request.
async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: "Server is missing Supabase configuration." });
  }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "Please sign in." });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
  req.user = data.user;
  req.supabase = supabase;
  next();
}

// Records one AI call against the user's quota; responds 429 when exhausted.
function aiQuota(kind: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const { data, error } = await req.supabase!.rpc("consume_ai_quota", {
      p_kind: kind,
      p_hourly_limit: AI_HOURLY_LIMIT,
      p_daily_limit: AI_DAILY_LIMIT,
    });
    if (error) {
      console.error("Quota check failed:", error.message);
      return res.status(500).json({ error: "Could not verify usage quota." });
    }
    if (!data?.allowed) {
      return res.status(429).json({
        error: `You've reached the AI usage limit (${AI_HOURLY_LIMIT}/hour, ${AI_DAILY_LIMIT}/day). Please take a short break and try again later.`,
      });
    }
    next();
  };
}

interface LoadedMaterials {
  textDocs: { fileName: string; fileType: string; content: string }[];
  images: { fileName: string; mimeType: string; data: string }[];
}

// Loads the user's study materials by id (RLS guarantees they're the user's own).
async function loadMaterials(supabase: SupabaseClient, materialIds: unknown): Promise<LoadedMaterials> {
  const result: LoadedMaterials = { textDocs: [], images: [] };
  if (!Array.isArray(materialIds) || materialIds.length === 0) return result;
  const ids = materialIds.filter((id): id is string => typeof id === "string").slice(0, 50);

  const { data, error } = await supabase
    .from("study_materials")
    .select("file_name, file_type, storage_path, content")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load study materials: ${error.message}`);

  for (const row of data || []) {
    if (row.file_type !== "image") {
      if (row.content) result.textDocs.push({ fileName: row.file_name, fileType: row.file_type, content: row.content });
    } else if (result.images.length < MAX_CONTEXT_IMAGES) {
      const { data: blob, error: dlError } = await supabase.storage.from(STUDY_BUCKET).download(row.storage_path);
      if (dlError || !blob) continue;
      result.images.push({
        fileName: row.file_name,
        mimeType: blob.type || "image/jpeg",
        data: Buffer.from(await blob.arrayBuffer()).toString("base64"),
      });
    }
  }
  return result;
}

// Lightweight retrieval: split documents into chunks, score each by how many query
// terms it contains, and keep the best chunks until the character budget is spent.
// With no query, takes each document's opening chunks evenly.
function selectRagContext(docs: LoadedMaterials["textDocs"], query: string, budget = RAG_CHAR_BUDGET): string {
  if (docs.length === 0) return "";
  const terms = Array.from(new Set(query.toLowerCase().match(/[a-z0-9+-]{4,}/g) || []));
  const chunks: { fileName: string; index: number; text: string; score: number }[] = [];
  for (const doc of docs) {
    for (let i = 0, n = 0; i < doc.content.length; i += RAG_CHUNK_SIZE, n++) {
      const text = doc.content.substring(i, i + RAG_CHUNK_SIZE);
      const lower = text.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (lower.includes(t) ? 1 : 0), 0);
      chunks.push({ fileName: doc.fileName, index: n, text, score });
    }
  }
  // Rank by relevance, then prefer earlier parts of documents (spread evenly across files).
  chunks.sort((a, b) => b.score - a.score || a.index - b.index);
  const picked: typeof chunks = [];
  let used = 0;
  for (const c of chunks) {
    if (used + c.text.length > budget) continue;
    picked.push(c);
    used += c.text.length;
  }
  // Restore reading order within each file so excerpts stay coherent.
  picked.sort((a, b) => a.fileName.localeCompare(b.fileName) || a.index - b.index);
  return picked.map(c => `[Source: ${c.fileName} — excerpt ${c.index + 1}]\n${c.text}`).join("\n\n");
}

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

// Models to try in order. Gemini sometimes answers 503 "high demand" (or 429)
// for a while; we retry once, then move on to the next model instead of
// dropping straight to the offline content. GEMINI_MODEL overrides the first.
const MODEL_CHAIN = [...new Set([process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean) as string[])];

const errorText = (e: any) => `${e?.status ?? ""} ${e?.code ?? ""} ${e?.message ?? ""}`;
const isBusyError = (e: any) => /\b(429|500|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(errorText(e));
const isMissingModel = (e: any) => /\b404\b|NOT_FOUND|not found for API version|is not supported/i.test(errorText(e));

async function withModelFallback<T>(run: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await run(model);
      } catch (e: any) {
        lastError = e;
        if (isMissingModel(e)) break;
        if (!isBusyError(e)) throw e;
        if (attempt === 0) await new Promise(r => setTimeout(r, 700));
      }
    }
    console.warn(`Gemini model ${model} unavailable, trying the next one.`);
  }
  throw lastError;
}

// Check if Gemini is fully operational
app.get("/api/status", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  res.json({
    status: hasKey ? "online" : "simulation",
    engine: hasKey ? "Gemini 3.5 Flash" : "Local Lab Engine",
  });
});

// Ingest a study file for RAG. The browser has already uploaded the file to
// Supabase Storage under <userId>/...; here we download it, extract text, and
// save a study_materials row. This keeps large files out of the request body,
// which Vercel caps at ~4.5MB.
app.post("/api/materials", requireUser, async (req: AuthedRequest, res) => {
  try {
    const { fileName, fileType, fileSize, storagePath } = req.body;
    if (!fileName || !fileType || !storagePath) {
      return res.status(400).json({ error: "Missing fileName, fileType, or storagePath." });
    }
    if (typeof storagePath !== "string" || !storagePath.startsWith(`${req.user!.id}/`)) {
      return res.status(403).json({ error: "Invalid storage path." });
    }

    const supabase = req.supabase!;
    const { data: blob, error: dlError } = await supabase.storage.from(STUDY_BUCKET).download(storagePath);
    if (dlError || !blob) {
      return res.status(404).json({ error: "Uploaded file not found in storage." });
    }
    const fileBuffer = Buffer.from(await blob.arrayBuffer());

    let extractedText = "";
    let wordCount = 0;
    let pageCount = 1;

    if (fileType === "pdf") {
      let parser: PDFParse | null = null;
      try {
        // Loaded lazily: pdfjs needs the native @napi-rs/canvas polyfills (DOMMatrix etc.)
        // at import time, and a failure there must not take down every other route.
        // "pdf-parse/worker" installs those polyfills and its static import makes
        // Vercel's bundler include the native module.
        const { CanvasFactory } = await import("pdf-parse/worker");
        const { PDFParse } = await import("pdf-parse");
        // pdf-parse v2 API: construct with { data }, then getText() -> { text, total }.
        parser = new PDFParse({ data: new Uint8Array(fileBuffer), CanvasFactory });
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
      // Images keep no text; the original bytes are read from Storage when chatting.
      extractedText = "";
      wordCount = 0;
      pageCount = 1;
    }

    // Retrieval picks relevant excerpts per request, so we can afford to keep more text.
    const MAX_STORED_CHARS = 1_000_000;
    if (extractedText.length > MAX_STORED_CHARS) {
      extractedText = extractedText.substring(0, MAX_STORED_CHARS) + "\n\n[Content truncated due to size limits]";
    }

    let summary = "";
    if (wordCount > 0) {
      const snippets = extractedText.substring(0, 200).replace(/\s+/g, " ").trim();
      summary = snippets ? snippets + "..." : "Empty reference file.";
    } else {
      summary = `Multimodal visual study reference (${String(fileType).toUpperCase()})`;
    }

    const { data: row, error: insertError } = await supabase
      .from("study_materials")
      .insert({
        user_id: req.user!.id,
        file_name: fileName,
        file_type: fileType,
        file_size: Number(fileSize) || fileBuffer.length,
        storage_path: storagePath,
        content: fileType === "image" ? null : extractedText,
        summary,
        pages: pageCount,
        words: wordCount,
      })
      .select("id, file_name, file_type, file_size, storage_path, summary, pages, words, created_at")
      .single();
    if (insertError) throw new Error(insertError.message);

    res.json({ material: row });
  } catch (err: any) {
    console.error("Error in /api/materials:", err);
    res.status(500).json({ error: err.message });
  }
});

// 1. CHAT ENDPOINT
// Streams the professor's reply as plain text chunks so the student sees output
// immediately and long answers never hit the function timeout waiting on one response.
app.post("/api/chat", requireUser, aiQuota("chat"), async (req: AuthedRequest, res) => {
  try {
    const { materialIds } = req.body;
    if (!req.body.messages || !Array.isArray(req.body.messages) || req.body.messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required." });
    }
    const messages: { role: string; content: string }[] = req.body.messages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") }));
    // Gemini expects the conversation to open with a user turn; trimming history can break that.
    while (messages.length > 1 && messages[0].role === "assistant") messages.shift();
    const lastUserMsgRaw = messages[messages.length - 1]?.content || "";
    const { textDocs, images } = await loadMaterials(req.supabase!, materialIds);

    // Construct standard system prompt
    const systemPrompt = `You are dynamic, patient, and highly knowledgeable Professor of Medical Laboratory Science (MLS). 
You teach concepts like Clinical Chemistry, Hematology & Urinalysis, Microbiology, Immunology, and Immunohematology (Blood Banking).
Guidelines:
1. Explain clinical concepts, biochemistries, reference ranges, pre-analytical & analytical errors, or delta check failures thoroughly.
2. If appropriate, write clear lists, chemical reactions, or interpret lab results tables.
3. Be conversational and highly supportive. Tailor to students' learning speed.
4. Keep paragraphs readable. Use markdown formatting. Use bullet points for steps.`;

    let finalSystemPrompt = systemPrompt;
    const activeImagesCount = images.length;

    const ragContext = selectRagContext(textDocs, lastUserMsgRaw);
    if (ragContext) {
      let docContext = "\n\n[=== STUDENT UPLOADED STUDY GUIDES & REFERENCE FILES (RAG) ===]\n";
      docContext += ragContext;
      docContext += "\n[=== END OF STUDY RESOURCES ===]\n\n";
      docContext += "CRITICAL RAG INSTRUCTION FOR PROFESSOR:\n";
      docContext += "The user has provided the above study document excerpts. Ground your teaching, logic, answers, and interpretations inside this referenced text! Cite source file names in brackets like [Source: fileName] if you reference explicit parameters. Be highly interactive, helping the user understand, parse, and review these guidelines.";
      finalSystemPrompt += docContext;
    }

    if (images.length > 0) {
      finalSystemPrompt += `\n\n[MULTI-MODAL IMAGE ASSISTANCE] The user has provided microscope or analyzer images. Review and describe whatever structures or patterns are present in these visual inputs to teach the student.`;
    }

    try {
      const client = getGeminiClient();
      
      const contents = messages.map((m: any, idx: number) => {
        const role = m.role === "assistant" ? "model" : "user";
        const parts: any[] = [{ text: m.content }];

        // Attach visual images to the absolute last student message
        if (role === "user" && idx === messages.length - 1) {
          images.forEach(img => {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
          });
        }

        return { role, parts };
      });

      // Pull the first chunk inside the fallback so a busy model can still be
      // swapped out before anything has been sent to the browser.
      const { iterator, first } = await withModelFallback(async model => {
        const stream = await client.models.generateContentStream({
          model,
          contents: contents,
          config: {
            systemInstruction: finalSystemPrompt,
            temperature: 0.7,
          }
        });
        const iterator = stream[Symbol.asyncIterator]();
        return { iterator, first: await iterator.next() };
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Accel-Buffering", "no");
      let wroteAny = false;
      try {
        for (let step = first; !step.done; step = await iterator.next()) {
          const text = step.value.text;
          if (text) {
            res.write(text);
            wroteAny = true;
          }
        }
      } catch (streamError: any) {
        // Headers are already sent, so we can't fall back to a JSON error; tell the reader inline.
        console.error("Gemini stream interrupted:", streamError.message);
        res.write("\n\n_[The professor's response was interrupted. Please try again.]_");
        return res.end();
      }
      if (!wroteAny) res.write("I was unable to formulate a response. Please check your query.");
      res.end();
    } catch (apiError: any) {
      console.warn("Falling back to local simulation because Gemini API or RAG call failed:", apiError.message);
      
      const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
      let responseText = "";

      // Try searching client materials for simulation RAG
      let matchedDoc: any = null;
      let matchedExcerpt = "";

      if (textDocs.length > 0) {
        for (const doc of textDocs) {
          if (doc.content) {
            // Check for words from query
            const wordsMatch = lastUserMsg.split(/\s+/).filter((w: string) => w.length > 4);
            for (const word of wordsMatch) {
              const cleanWord = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
              const findIndex = doc.content.toLowerCase().indexOf(cleanWord);
              if (findIndex !== -1 && cleanWord.length > 3) {
                matchedDoc = doc;
                const start = Math.max(0, findIndex - 120);
                const end = Math.min(doc.content.length, findIndex + 250);
                matchedExcerpt = doc.content.substring(start, end).replace(/\s+/g, " ").trim();
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
In Medical Laboratory Science, **Potassium (K⁺)** is the single most dangerous electrolyte when falsely elevated.
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

      const notice = isBusyError(apiError)
        ? "> ⚠️ **Offline answer** — Gemini is very busy right now, so this is a built-in reply. Ask again in a minute for a full answer.\n\n"
        : "> ⚠️ **Offline answer** — the AI model couldn't be reached, so this is a built-in reply.\n\n";
      responseText = notice + responseText;

      // Same plain-text format as the live stream, delivered in one piece.
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("X-LabMaster-Simulation", "1");
      res.end(responseText);
    }
  } catch (err: any) {
    console.error("Error in /api/chat:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
});

// 2. EXAM QUESTIONS ENDPOINT
// Board-style exams are built from batches of up to 10 questions. The client asks for
// batches one after another, passing earlier stems in `avoid` so questions don't repeat,
// and grading happens in the browser against the returned answer keys.
const MAX_BATCH = 10;

interface ExamQuestion {
  topic: string;
  stem: string;
  labData: { parameter: string; result: string; referenceRange: string; status: string }[];
  options: string[];
  answerIndex: number;
  explanation: string;
}

// Shuffle options so the correct answer isn't always in the same position
// (models tend to favour "A" or "B").
function shuffleOptions(q: ExamQuestion): ExamQuestion {
  const order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { ...q, options: order.map(i => q.options[i]), answerIndex: order.indexOf(q.answerIndex) };
}

function isValidQuestion(q: any): q is ExamQuestion {
  return q && typeof q.stem === "string" && q.stem.trim().length > 10
    && Array.isArray(q.options) && q.options.length === 4 && q.options.every((o: any) => typeof o === "string" && o.trim())
    && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < 4
    && typeof q.explanation === "string";
}

const stemKey = (stem: string) => stem.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);

app.post("/api/generate-questions", requireUser, aiQuota("generate-questions"), async (req: AuthedRequest, res) => {
  try {
    const { category, materialIds } = req.body;
    // A topic exam pins every batch to one topic; otherwise batches rotate through the discipline's topics.
    const pinned = findTopic(typeof req.body.topicId === "string" ? req.body.topicId : null);
    const activeCategory = pinned?.category ?? (EXAM_TOPICS[category] ? category : "chemistry");
    const count = Math.min(MAX_BATCH, Math.max(1, Number(req.body.count) || MAX_BATCH));
    const batch = Math.max(0, Number(req.body.batch) || 0);
    const avoid: string[] = Array.isArray(req.body.avoid) ? req.body.avoid.filter((x: unknown) => typeof x === "string").slice(-60) : [];
    const topicDef = pinned?.topic ?? EXAM_TOPICS[activeCategory][batch % EXAM_TOPICS[activeCategory].length];
    const topic = topicDef.focus;

    try {
      const client = getGeminiClient();
      const { textDocs } = await loadMaterials(req.supabase!, materialIds);
      const ragContext = selectRagContext(textDocs, `${activeCategory} ${topic}`, 20000);

      const prompt = `You are writing practice questions for the ASCP Medical Laboratory Scientist (MLS) board exam.
Discipline: ${activeCategory}. ${pinned ? "Every question must be about" : "Focus this set on"}: ${topic}.
Write exactly ${count} multiple-choice questions.

Rules:
- Each question has exactly 4 options and exactly one correct answer (answerIndex is 0-3).
- Mix recall, interpretation and problem-solving; most questions should be short clinical or laboratory scenarios.
- When a question depends on results, put them in labData (parameter, result with units, referenceRange, status = Normal/High/Low/Critical High/Critical Low/Positive/Negative). Otherwise labData is an empty array.
- Values and reference ranges must be physiologically realistic and scientifically accurate.
- Distractors must be plausible, similar in length to the correct answer, and never "all/none of the above".
- explanation: 1-3 sentences teaching why the answer is right (and the key trap).
- topic: a 1-4 word subtopic label.
- Do not repeat these existing questions: ${avoid.length ? avoid.map(a => `"${a}"`).join("; ") : "none"}.${ragContext ? `

Base as many questions as possible on these excerpts from the student's study files:
${ragContext}` : ""}`;

      const response = await withModelFallback(model => client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    stem: { type: Type.STRING },
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
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answerIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                  },
                  required: ["topic", "stem", "labData", "options", "answerIndex", "explanation"]
                }
              }
            },
            required: ["questions"]
          }
        }
      }));

      const parsed = JSON.parse((response.text || "{}").trim());
      const seen = new Set(avoid.map(stemKey));
      const questions = (parsed.questions || [])
        .filter(isValidQuestion)
        .filter((q: ExamQuestion) => { const k = stemKey(q.stem); if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, count)
        .map((q: ExamQuestion) => shuffleOptions({ ...q, labData: Array.isArray(q.labData) ? q.labData : [] }));
      if (questions.length === 0) throw new Error("Model returned no usable questions.");
      res.json({ questions, topic });
    } catch (apiError: any) {
      console.warn("Serving offline question bank. Reason:", apiError.message);
      const seen = new Set(avoid.map(stemKey));
      const pool = (QUESTION_BANK[activeCategory] || [])
        .filter(q => !pinned || pinned.topic.bankTopics.includes(q.topic))
        .filter(q => !seen.has(stemKey(q.stem)))
        .sort(() => Math.random() - 0.5)
        .slice(0, count)
        .map(q => shuffleOptions({ ...q, labData: q.labData || [] }));
      res.json({ questions: pool, topic, simulation: true, exhausted: pool.length < count });
    }
  } catch (err: any) {
    console.error("Error in /api/generate-questions:", err);
    res.status(500).json({ error: err.message });
  }
});

// On Vercel, this Express app runs as a single serverless function. All `/api/*`
// requests are routed here by vercel.json. Static frontend assets (the Vite build
// in dist/) are served directly by Vercel's edge, so no static/Vite handling here.
// Local development uses ../server.ts, which imports this app and adds the Vite
// dev middleware + app.listen.
export default app;
