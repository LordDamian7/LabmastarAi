import React, { useState, useEffect, useRef } from "react";
import { Message } from "../types";
import { Mic, MicOff, Send, Volume2, VolumeX, Loader2, GraduationCap, Trash2, BookOpen, Keyboard } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface MLSProfessorChatProps {
  messages: Message[];
  onSendMessage: (text: string) => Promise<void>;
  isGeneratingMessage: boolean;
  onIncrementGoal: (actionType: string) => void;
  onClearHistory: () => void;
  materialCount: number;
  onOpenLibrary: () => void;
}

export default function MLSProfessorChat({ 
  messages, 
  onSendMessage, 
  isGeneratingMessage,
  onIncrementGoal,
  onClearHistory,
  materialCount,
  onOpenLibrary
}: MLSProfessorChatProps) {
  const [inputText, setInputText] = useState("");
  const [speechMode, setSpeechMode] = useState<"text" | "voice">("text");
  
  // Speech Recognition States
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  // Text-To-Speech (TTS) States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muteTts, setMuteTts] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ttsMessageRef = useRef<string | null>(null);

  // Rapid Clinical Questions for MLS students
  const SHORTCUTS = [
    "Explain Delta Check logic",
    "Hemolysis cause of fake hyperkalemia",
    "How to differentiate E. coli on agar?",
    "ABO forward vs reverse typing discrepancies",
    "What are toxic granulations & vacuolization?"
  ];

  // Initialize Speech Recognition on Mount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = (e: any) => {
      console.warn("Speech recognition error:", e.error);
      setIsListening(false);
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim() !== "") {
        handleSendVoiceText(transcript);
      }
    };

    setRecognitionInstance(rec);

    // Cleanup SpeechSynthesis Voice synthesis on unmount
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  // In voice mode, read each new reply aloud once it has finished streaming.
  useEffect(() => {
    if (isGeneratingMessage || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest.role !== "assistant" || ttsMessageRef.current === latest.id) return;
    ttsMessageRef.current = latest.id;
    if (speechMode === "voice" && !muteTts) speakResponse(latest.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isGeneratingMessage, speechMode, muteTts]);

  // Keep chat scrolled down
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGeneratingMessage]);

  const speakResponse = (text: string) => {
    if (!window.speechSynthesis) return;
    
    // Stop prior speech synthesis
    window.speechSynthesis.cancel();
    
    // Strips markdown patterns so the speech synthesis scans smoothly
    const cleanText = text
      .replace(/[#*`_~]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .substring(0, 320); // Speaking first 320 chars to keep speech prompt tight

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";
    
    // Attempt to locate a professional sounding instructor voice
    const voices = window.speechSynthesis.getVoices();
    const desiredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Natural") || v.lang === "en-US");
    if (desiredVoice) utterance.voice = desiredVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Toggle Voice Recognition Listen state
  const handleToggleListen = () => {
    if (!speechSupported || !recognitionInstance) return;

    if (isListening) {
      recognitionInstance.stop();
    } else {
      stopSpeaking();
      try {
        recognitionInstance.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  const handleSendVoiceText = async (text: string) => {
    onIncrementGoal("chat_ask");
    await onSendMessage(text);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGeneratingMessage) return;

    const textInput = inputText.trim();
    setInputText("");
    stopSpeaking();
    onIncrementGoal("chat_ask");
    await onSendMessage(textInput);
  };

  const handleShortcutClick = async (prompt: string) => {
    if (isGeneratingMessage) return;
    stopSpeaking();
    onIncrementGoal("chat_ask");
    await onSendMessage(prompt);
  };

  return (
    <div className="card flex flex-col overflow-hidden h-[calc(100dvh-10.5rem)] lg:h-[calc(100vh-4.5rem)] min-h-[480px]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 sm:px-5 py-3.5">
        <span className="h-10 w-10 rounded-xl bg-accent/14 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-accent" />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold leading-tight">AI Professor</h1>
          <button onClick={onOpenLibrary} className="text-xs text-ink-3 hover:text-accent inline-flex items-center gap-1 cursor-pointer">
            <BookOpen className="w-3.5 h-3.5" />
            {materialCount > 0 ? `Using ${materialCount} study file${materialCount === 1 ? "" : "s"}` : "Add study files for grounded answers"}
          </button>
        </div>
        <div className="flex items-center rounded-xl border border-line bg-surface-2 p-1" role="group" aria-label="Input mode">
          <button
            onClick={() => { setSpeechMode("text"); stopSpeaking(); }}
            aria-pressed={speechMode === "text"}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${speechMode === "text" ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"}`}
          >
            <Keyboard className="w-3.5 h-3.5" /> Type
          </button>
          <button
            onClick={() => { setSpeechMode("voice"); setMuteTts(false); }}
            aria-pressed={speechMode === "voice"}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${speechMode === "voice" ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"}`}
          >
            <Mic className="w-3.5 h-3.5" /> Voice
          </button>
        </div>
        {messages.length > 0 && (
          <button onClick={onClearHistory} title="Clear conversation" aria-label="Clear conversation" className="p-2 rounded-lg text-ink-3 hover:text-critical hover:bg-critical/10 cursor-pointer">
            <Trash2 className="w-[18px] h-[18px]" />
          </button>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
        {messages.length === 0 && (
          <div className="max-w-lg mx-auto text-center pt-6 sm:pt-12 space-y-5">
            <span className="mx-auto h-14 w-14 rounded-2xl bg-accent/14 flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-accent" />
            </span>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Ask your lab professor anything</h2>
              <p className="text-[15px] text-ink-2 leading-relaxed">
                Reference ranges, pre-analytical errors, stains, antibody panels — explained step by step, grounded in your study files when you add them.
              </p>
            </div>
            <div className="grid gap-2 text-left">
              {SHORTCUTS.slice(0, 4).map(v => (
                <button
                  key={v}
                  onClick={() => handleShortcutClick(v)}
                  className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-ink-2 hover:border-accent/50 hover:text-ink transition-colors cursor-pointer"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(message => {
          const isUser = message.role === "user";
          if (isUser) {
            return (
              <div key={message.id} className="flex justify-end animate-fadeIn">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-3 text-[15px] font-medium text-accent-ink">
                  {message.content}
                </p>
              </div>
            );
          }
          return (
            <div key={message.id} className="flex gap-3 animate-fadeIn">
              <span className="h-8 w-8 shrink-0 rounded-lg bg-accent/14 flex items-center justify-center mt-0.5">
                <GraduationCap className="w-4 h-4 text-accent" />
              </span>
              <div className="min-w-0 flex-1 max-w-[46rem]">
                <div className="prose-lab overflow-x-auto">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
                <button
                  onClick={() => speakResponse(message.content)}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-accent cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Read aloud
                </button>
              </div>
            </div>
          );
        })}

        {/* Shown until the first streamed words of the reply arrive */}
        {isGeneratingMessage && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3" aria-live="polite">
            <span className="h-8 w-8 shrink-0 rounded-lg bg-accent/14 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-accent" />
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-ink-3">
              <Loader2 className="w-4 h-4 animate-spin text-accent" /> Thinking…
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-line p-3 sm:p-4">
        {speechMode === "text" ? (
          <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
            <label htmlFor="chat-input" className="sr-only">Message the professor</label>
            <div className="relative flex-1">
              <input
                id="chat-input"
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Ask about a result, a test, or a concept…"
                className="w-full rounded-xl border border-line bg-surface-2 pl-4 pr-12 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-accent"
                disabled={isGeneratingMessage}
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={handleToggleListen}
                  aria-label={isListening ? "Stop dictation" : "Dictate"}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg cursor-pointer ${isListening ? "bg-critical/15 text-critical" : "text-ink-3 hover:text-accent"}`}
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
            <button type="submit" disabled={!inputText.trim() || isGeneratingMessage} className="btn-primary h-12 w-12 p-0" aria-label="Send">
              <Send className="w-[18px] h-[18px]" />
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              onClick={handleToggleListen}
              disabled={!speechSupported}
              aria-label={isListening ? "Stop listening" : "Start speaking"}
              className={`h-16 w-16 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${isListening ? "bg-critical text-accent-ink" : "bg-accent text-accent-ink hover:bg-accent/90"}`}
            >
              {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>
            <p className="text-sm text-ink-2 text-center">
              {!speechSupported ? "Voice input isn't supported in this browser — switch to Type." : isListening ? "Listening… ask your question." : isSpeaking ? "The professor is speaking." : "Tap the mic and ask your question."}
            </p>
            <div className="flex gap-2">
              {isSpeaking && (
                <button onClick={stopSpeaking} className="btn-secondary px-3 py-2 text-xs"><VolumeX className="w-4 h-4" /> Stop</button>
              )}
              <button onClick={() => { setMuteTts(!muteTts); if (!muteTts) stopSpeaking(); }} className="btn-secondary px-3 py-2 text-xs">
                {muteTts ? <><VolumeX className="w-4 h-4" /> Voice replies off</> : <><Volume2 className="w-4 h-4 text-accent" /> Voice replies on</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
