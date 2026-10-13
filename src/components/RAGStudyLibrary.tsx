import React, { useState, useRef } from "react";
import { StudyMaterial } from "../types";
import { supabase, STUDY_BUCKET } from "../lib/supabase";
import { apiFetch, apiError } from "../lib/api";
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  Sparkles, 
  Loader2, 
  Check, 
  AlertCircle, 
  BookOpen, 
  Info,
  Layers,
  Award
} from "lucide-react";

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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Title block */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-teal-400" />
          <h3 className="font-sans font-extrabold text-sm uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
            RAG Textbook Reference Library
            <span className="text-[10px] font-mono bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded font-normal normal-case">
              {studyMaterials.length} loaded
            </span>
          </h3>
        </div>
        
        <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
          Upload documents to ground your discussions with the AI Prof
        </p>
      </div>

      {/* Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          isDragging 
            ? "border-teal-400 bg-teal-950/10 text-teal-300" 
            : "border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60 text-slate-350"
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
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
            <span className="text-xs font-mono text-slate-300 font-bold">
              DIgESTING CLINICAL SOURCE...
            </span>
            {uploadProgress !== null && (
              <div className="w-48 bg-slate-850 h-1.5 rounded-full overflow-hidden mt-1 border border-slate-800">
                <div 
                  className="bg-teal-400 h-full transition-all duration-300 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            <p className="text-[10px] text-slate-450 font-sans">
              Extracting medical terminology via parsing engine...
            </p>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <div className="mx-auto w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 shadow-inner group-hover:text-teal-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold font-sans text-slate-205">
                Drag & drop or <span className="text-teal-400 underline">browse files</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-1 font-sans">
                Supports **PDF, DOCX, TXT, MD, CSV, JSON** and **JPEG, JPG, PNG** (Max {MAX_FILE_MB}MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Messaging */}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 flex gap-2 items-start text-xs text-rose-300 animate-fadeIn">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Parsing Error</p>
            <p className="font-sans leading-relaxed text-rose-400/90">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Active References Shelf */}
      {studyMaterials.length > 0 && (
        <div className="space-y-2.5">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">
            Active Study References ({studyMaterials.length})
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[170px] overflow-y-auto pr-1">
            {studyMaterials.map((material) => {
              const isImg = material.fileType === "image";
              return (
                <div 
                  key={material.id}
                  className="bg-slate-950 border border-slate-850/90 rounded-xl p-3 flex gap-3 items-start justify-between hover:border-slate-800 transition-all group relative animate-fadeIn"
                >
                  <div className="flex gap-2 items-start overflow-hidden">
                    <div className={`mt-0.5 p-1.5 rounded-lg border ${
                      isImg 
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-400" 
                        : "bg-teal-500/10 border-teal-500/20 text-teal-400"
                    }`}>
                      {isImg ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                    </div>

                    <div className="text-left space-y-0.5 overflow-hidden">
                      <p className="text-xs font-bold text-slate-200 truncate pr-4 font-sans leading-tight">
                        {material.fileName}
                      </p>
                      <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400">
                        <span className="uppercase font-extrabold text-teal-400">
                          {material.fileType}
                        </span>
                        <span>•</span>
                        <span>{getFormatBytes(material.fileSize)}</span>
                        {!isImg && material.words && (
                          <>
                            <span>•</span>
                            <span className="text-slate-300">{material.words} words</span>
                          </>
                        )}
                      </div>
                      
                      {/* Short summary snippet */}
                      <p className="text-[9.5px] text-slate-450 truncate font-sans py-0.5">
                        {material.summary}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveMaterial(material.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 cursor-pointer flex-shrink-0 self-center opacity-70 group-hover:opacity-100 transition-opacity"
                    title="Remove reference"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] bg-slate-950 px-3 py-2 rounded-lg border border-slate-850 text-slate-400 justify-center">
            <Sparkles className="w-3 h-3 text-teal-400 animate-pulse" />
            <span className="font-sans">AI Prof automatically matches active terms to teach you with cited precision.</span>
          </div>
        </div>
      )}

      {studyMaterials.length === 0 && (
        <div className="border border-dashed border-slate-800/80 rounded-xl p-5 text-center bg-slate-950/20 text-xs text-slate-450 py-7">
          <Info className="w-5 h-5 mx-auto text-slate-600 mb-2" />
          <p className="font-sans">No Reference Literature Uploaded.</p>
          <p className="text-[10px] mt-1 text-slate-500">
            Upload custom textbook excerpts to chat interactively and generate bespoke medical training cases!
          </p>
        </div>
      )}
    </div>
  );
}