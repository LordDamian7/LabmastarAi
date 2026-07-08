import React, { useState, useEffect, useRef } from "react";
import { Message } from "../types";
import { Mic, MicOff, Send, Volume2, VolumeX, Sparkles, AlertCircle, HelpCircle, CornerDownLeft, Play, Square, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface MLSProfessorChatProps {
  messages: Message[];
  onSendMessage: (text: string) => Promise<void>;
  isGeneratingMessage: boolean;
  onIncrementGoal: (actionType: string) => void;
}

export default function MLSProfessorChat({ 
  messages, 
  onSendMessage, 
  isGeneratingMessage,
  onIncrementGoal
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
    "ABO typing forward vs reverse discrep",
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

  // Monitor the latest assistant message and trigger TTS if in voice mode or custom unmute
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    
    // Check if it's the assistant's message and we haven't spoken it yet
    if (latest.role === "assistant" && ttsMessageRef.current !== latest.id) {
      ttsMessageRef.current = latest.id;
      if ((speechMode === "voice" || !muteTts) && !muteTts) {
        speakResponse(latest.content);
      }
    }
  }, [messages, speechMode, muteTts]);

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
    <div className="flex flex-col h-[650px] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative">
      {/* Header Panel with Mode Toggle */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
          <h2 className="font-sans font-bold text-slate-100 flex items-center gap-1.5 text-base">
            Professor LabMaster <span className="text-xs font-mono text-teal-400 font-normal">TUTOR</span>
          </h2>
        </div>

        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => {
              setSpeechMode("text");
              stopSpeaking();
            }}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-md cursor-pointer transition-colors ${
              speechMode === "text" 
                ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/10" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            TEXT MODE
          </button>
          <button
            onClick={() => {
              setSpeechMode("voice");
              setMuteTts(false);
            }}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-md cursor-pointer transition-colors flex items-center gap-1.5 ${
              speechMode === "voice" 
                ? "bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 shadow-md shadow-emerald-500/10" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Mic className="w-3.5 h-3.5" /> VOICE MODE
          </button>
        </div>
      </div>

      {speechMode === "voice" && (
        <div className="bg-gradient-to-r from-teal-950/20 to-emerald-950/20 border-b border-teal-500/10 p-3 text-xs text-slate-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Interactive Speech Active. You can talk to the professor or listen to guidelines live!</span>
        </div>
      )}

      {/* Main Conversation Canvas */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 font-normal bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950/40">
        
        {/* If no message, render welcoming screen */}
        {messages.length === 0 && (
          <div className="text-center py-10 max-w-md mx-auto space-y-4">
            <div className="h-16 w-16 bg-teal-950/40 border border-teal-400/20 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-lg shadow-teal-500/5">
              🔬
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-200">Laboratory Science Assistant</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Greetings, Clinical Student! I can assist you with understanding laboratory findings, hematocrit indices, culture patterns, or test troubleshooting. 
              </p>
            </div>

            <div className="border border-slate-800 p-3 rounded-xl bg-slate-950/50 text-left space-y-2">
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">Suggested Questions</span>
              <div className="flex flex-col gap-1.5">
                {SHORTCUTS.slice(0, 3).map((v, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => handleShortcutClick(v)}
                    className="text-xs text-left text-slate-300 bg-slate-900 hover:bg-slate-800 p-2 rounded-lg border border-slate-800 border-none transition-colors cursor-pointer block text-ellipsis overflow-hidden whitespace-nowrap"
                  >
                    💬 {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div 
              key={message.id} 
              className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fadeIn`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl p-4 text-sm relative group ${
                  isUser 
                    ? "bg-teal-500 text-slate-950 font-medium rounded-tr-none shadow-md shadow-teal-500/10" 
                    : "bg-slate-950 border border-slate-800 text-slate-100 rounded-tl-none leading-relaxed font-sans"
                }`}
              >
                {/* Meta details */}
                <span className={`text-[9px] font-mono ${isUser ? "text-slate-950/60" : "text-slate-400"} block mb-1 uppercase tracking-wider font-bold`}>
                  {isUser ? "Student Learner" : "Prof. LabMaster"}
                </span>

                {/* Body message */}
                {isUser ? (
                  <p className="whitespace-pre-wrap font-sans font-medium">{message.content}</p>
                ) : (
                  <div className="markdown-body font-sans text-slate-200 prose prose-invert overflow-x-auto text-[13.5px]">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}

                {/* Speak button for previous assistant statements */}
                {!isUser && (
                  <div className="flex justify-end gap-1.5 mt-2.5 pt-2 border-t border-slate-900/40 opacity-40 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => speakResponse(message.content)}
                      className="text-[10px] font-mono hover:text-teal-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3" /> Read Aloud
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming / Generation loader */}
        {isGeneratingMessage && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm rounded-tl-none">
              <span className="text-[9px] font-mono text-teal-400 block mb-1.0 font-bold uppercase tracking-wider">
                Analyzing Clinical Specimen...
              </span>
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
                <span className="text-xs text-slate-400 font-sans">Professor is formulating clinical guidelines...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice Mode Visualizer / Central Console */}
      {speechMode === "voice" && (
        <div className="absolute inset-x-0 bottom-16 bg-slate-950 border-t border-slate-800/80 p-5 flex flex-col items-center justify-center space-y-4 animate-slideUp">
          <div className="flex items-center gap-4">
            {/* Pulsing micro button for direct trigger */}
            <button
              onClick={handleToggleListen}
              className={`h-16 w-16 rounded-full flex items-center justify-center cursor-pointer transition-all border shadow-lg ${
                !speechSupported 
                  ? "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed" 
                  : isListening 
                    ? "bg-rose-500 border-rose-300 text-slate-950 animate-ping" 
                    : "bg-gradient-to-r from-teal-400 to-emerald-400 border-teal-200 text-slate-950 hover:shadow-teal-500/20"
              }`}
              disabled={!speechSupported}
            >
              {isListening ? (
                <MicOff className="w-6 h-6 text-slate-950" />
              ) : (
                <Mic className="w-6 h-6 text-slate-950" />
              )}
            </button>

            {/* Speaking Synthesis Indicator */}
            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="h-10 w-10 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-400 flex items-center justify-center cursor-pointer"
                title="Stop Speaking"
              >
                <VolumeX className="w-5 h-5 animate-bounce" />
              </button>
            )}
          </div>

          <div className="text-center space-y-1 max-w-xs">
            {/* Dynamic visual state guidelines */}
            <p className="text-xs font-semibold text-slate-100">
              {isListening 
                ? "🎙️ Transcribing: Say your question aloud..." 
                : isSpeaking 
                  ? "🔊 Readout: Prof. is narrating answer" 
                  : "Tap Micro to ask a voice question"}
            </p>
            <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
              {!speechSupported 
                ? "Note: Web Speech API is blocked/inactive in this browser iframe. Use Text Mode or grant microphone settings." 
                : "Captures microphone audio. Say keywords like 'Delta check' or 'Hemolysis'."}
            </p>
          </div>
        </div>
      )}

      {/* Inputs Form */}
      <div className="p-3 bg-slate-950 border-t border-slate-800">
        {speechMode === "text" ? (
          <form onSubmit={handleFormSubmit} className="flex gap-2 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Query clinical ranges, error flags, or laboratory science..."
              className="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-teal-500/60 font-sans"
              disabled={isGeneratingMessage}
            />

            {/* Speech quick listener trigger in text mode too */}
            {speechSupported && (
              <button
                type="button"
                onClick={handleToggleListen}
                className={`absolute right-14 top-1/2 -translate-y-1/2 p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isListening 
                    ? "bg-rose-500/20 border-rose-500/30 text-rose-400" 
                    : "border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-teal-400"
                }`}
                title="Dictate message"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              className={`px-3.5 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                inputText.trim() && !isGeneratingMessage
                  ? "bg-teal-500 hover:bg-teal-400 text-slate-950"
                  : "bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800/60"
              }`}
              disabled={!inputText.trim() || isGeneratingMessage}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="flex justify-between items-center px-2 py-0.5">
            <span className="text-[10px] font-mono text-slate-400">Speech mode active</span>
            <button
              onClick={() => {
                setMuteTts(!muteTts);
                if (!muteTts) stopSpeaking();
              }}
              className="text-xs hover:text-slate-250 text-slate-400 flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md cursor-pointer"
            >
              {muteTts ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" /> Prof Muted
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Prof Voice On
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
