import React, { useState, useRef } from "react";
import { StudyMaterial } from "../types";
import { supabase, STUDY_BUCKET } from "../lib/supabase";
import { apiFetch, apiError } from "../lib/api";
import { Upload, FileText, Image as ImageIcon, Trash2, Loader2, AlertCircle, BookOpen, Sparkles } from "lucide-react";

// Explicit content types: browsers report .md/.csv inconsistently, and the storage
// bucket only accepts an allow-list of MIME types.
const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
};

const MAX_FILE_MB = 20;

interface RAGStudyLibraryProps {
  userId: string;
  studyMaterials: StudyMaterial[];
  onAddMaterial: (material: StudyMaterial) => void;
  onRemoveMaterial: (id: string) => void;
}

export default function RAGStudyLibrary({
  userId,
  studyMaterials,
  onAddMaterial,
  onRemoveMaterial
}: RAGStudyLibraryProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMsg(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleManualSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf(".") + 1).toLowerCase();
    const allowed = ["pdf", "docx", "txt", "md", "csv", "json", "jpeg", "jpg", "png"];
    
    if (!allowed.includes(ext)) {
      setErrorMsg(`Unsupported file type (.${ext}). Please upload PDF, DOCX, TXT, MD, CSV, JSON, JPEG, JPG, or PNG files.`);
      return;
    }

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setErrorMsg(`File exceeds the maximum ${MAX_FILE_MB}MB size limit. Please upload a smaller study material.`);
      return;
    }

    setIsParsing(true);
    setUploadProgress(15);

    const fileType = ["jpeg", "jpg", "png"].includes(ext) ? "image" : ext;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;

    try {
      // 1. Upload the original file straight to Supabase Storage. This bypasses the
      //    serverless request-size cap, so large textbooks are fine.
      const { error: uploadError } = await supabase.storage
        .from(STUDY_BUCKET)
        .upload(storagePath, file, { contentType: CONTENT_TYPES[ext], upsert: false });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      setUploadProgress(60);

      // 2. Ask the server to extract text and register the material.
      const response = await apiFetch("/api/materials", {
        fileName: file.name,
        fileType,
        fileSize: file.size,
        storagePath
      });

      setUploadProgress(90);

      if (!response.ok) {
        // Don't leave an orphaned file behind if parsing failed.
        await supabase.storage.from(STUDY_BUCKET).remove([storagePath]);
        throw await apiError(response, "Failed to digest the clinical material.");
      }

      const { material } = await response.json();
      onAddMaterial({
        id: material.id,
        fileName: material.file_name,
        fileType: material.file_type,
        fileSize: material.file_size,
        storagePath: material.storage_path,
        summary: material.summary,
        uploadedAt: material.created_at,
        pages: material.pages,
        words: material.words
      });
      setUploadProgress(100);
      
      // Flash a little success
      setTimeout(() => {
        setIsParsing(false);
        setUploadProgress(null);
      }, 500);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while parsing the document.");
      setIsParsing(false);
      setUploadProgress(null);
    }
  };

  const getFormatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 1;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight">Study Library</h1>
        <p className="text-[15px] text-ink-2 mt-1">
          Upload your notes and textbook chapters. The AI Professor and the Lab Simulator will base answers and cases on them.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isParsing && fileInputRef.current?.click()}
        onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && !isParsing) { e.preventDefault(); fileInputRef.current?.click(); } }}
        role="button"
        tabIndex={0}
        aria-label="Upload a study file"
        className={`rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-colors cursor-pointer ${
          isDragging ? "border-accent bg-accent/8" : "border-line bg-surface hover:border-ink-3"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleManualSelect}
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.csv,.json,.jpeg,.jpg,.png"
        />
        {isParsing ? (
          <div className="flex flex-col items-center gap-3" aria-live="polite">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-[15px] font-semibold">Reading your file…</p>
            {uploadProgress !== null && (
              <div className="w-56 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="h-12 w-12 rounded-xl bg-accent/14 flex items-center justify-center">
              <Upload className="w-6 h-6 text-accent" />
            </span>
            <p className="text-[15px] font-semibold">
              Drag a file here or <span className="text-accent underline underline-offset-2">browse</span>
            </p>
            <p className="text-sm text-ink-3">PDF, Word, text, Markdown, CSV, JSON or images · up to {MAX_FILE_MB} MB</p>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 p-4 flex gap-2.5 text-sm" role="alert">
          <AlertCircle className="w-4 h-4 text-critical shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-critical">Upload failed</p>
            <p className="text-ink-2 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Files */}
      {studyMaterials.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center">
            <h2 className="flex-1 text-lg font-bold">Your files</h2>
            <span className="text-sm text-ink-3">{studyMaterials.length} file{studyMaterials.length === 1 ? "" : "s"}</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {studyMaterials.map(material => {
              const isImg = material.fileType === "image";
              return (
                <li key={material.id} className="card p-4 flex items-start gap-3.5 animate-fadeIn">
                  <span className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${isImg ? "bg-violet/14 text-violet" : "bg-accent/14 text-accent"}`}>
                    {isImg ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{material.fileName}</p>
                    <p className="text-xs text-ink-3 mt-0.5">
                      <span className="uppercase font-bold">{material.fileType}</span> · {getFormatBytes(material.fileSize)}
                      {!isImg && material.words ? ` · ${material.words.toLocaleString()} words` : ""}
                    </p>
                    {material.summary && <p className="text-sm text-ink-2 mt-2 line-clamp-2">{material.summary}</p>}
                  </div>
                  <button
                    onClick={() => { if (confirm(`Remove "${material.fileName}" from your library?`)) onRemoveMaterial(material.id); }}
                    className="p-2 rounded-lg text-ink-3 hover:text-critical hover:bg-critical/10 cursor-pointer"
                    aria-label={`Remove ${material.fileName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Sparkles className="w-4 h-4 text-accent" /> The Professor cites file names when it uses them in an answer.
          </p>
        </section>
      ) : (
        <div className="card p-8 text-center space-y-2">
          <BookOpen className="w-6 h-6 text-ink-3 mx-auto" />
          <p className="text-[15px] font-semibold">No files yet</p>
          <p className="text-sm text-ink-3 max-w-md mx-auto">Add lecture notes or a textbook chapter to get answers and practice cases tailored to your course.</p>
        </div>
      )}
    </div>
  );
}
