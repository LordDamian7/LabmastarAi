import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, User, ShieldAlert, LogIn, KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";

// Signs in or creates an account with Supabase Auth. App.tsx picks up the new
// session through onAuthStateChange, so this component needs no callbacks.
export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email || !password) {
      setError("Please fill in all standard credentials.");
      return;
    }

    if (isSignUp && !name) {
      setError("Name is required to sign up as a MLS Candidate.");
      return;
    }

    if (isSignUp && password.length < 8) {
      setError("Passcode must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin
          }
        });
        if (signUpError) throw signUpError;
        // With email confirmation on, there is no session until the link is clicked.
        if (!data.session) {
          setNotice(`Check ${email} for a confirmation link to activate your account.`);
          setIsSignUp(false);
          setPassword("");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email) {
      setError("Enter your email above first, then choose \"Forgot passcode\".");
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (resetError) setError(resetError.message);
    else setNotice(`If an account exists for ${email}, a reset link is on its way.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative background grid and ambient radial light */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.06)_0,transparent_60%)] pointer-events-none" />
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #2dd4bf 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="w-full max-w-md z-10">
        
        {/* Brand/Logo Center Area */}
        <div className="text-center mb-8 space-y-3">
          <div className="mx-auto h-12 w-12 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-teal-500/25 border border-teal-400">
            🔬
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-200 via-slate-100 to-teal-400 bg-clip-text text-transparent font-sans">
              LabMaster AI
            </h1>
            <p className="text-xs text-slate-400 font-mono tracking-wider">
              AUTHORIZED ACCESS ONLY • CLINICAL PORTAL
            </p>
          </div>
        </div>

        {/* Primary Interactive Module Container */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative">

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2.5 font-mono"
              >
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span className="flex-1">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {notice && (
            <div className="mb-6 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2.5 font-mono">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span className="flex-1">{notice}</span>
            </div>
          )}

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Action State Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-2">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError(null);
                }}
                className={`py-2 text-xs font-bold font-sans rounded-lg transition-all ${
                  !isSignUp 
                    ? "bg-slate-800 text-teal-400 shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError(null);
                }}
                className={`py-2 text-xs font-bold font-sans rounded-lg transition-all ${
                  isSignUp 
                    ? "bg-slate-800 text-teal-400 shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Create Account
              </button>
            </div>

            {/* If Sign Up: Request Display Name */}
            {isSignUp && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="E.g., Dr. Alex Reed, MLS"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all font-sans"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="name@clinicalnet.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all font-sans"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider">
                Laboratory Security Passcode
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all font-sans"
                />
              </div>
            </div>

            {/* Submit Action Block */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-sm py-3 px-4 rounded-xl shadow-lg shadow-teal-500/10 cursor-pointer flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Lab Credentials...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{isSignUp ? "Generate License & Proceed" : "Sign In to Working Session"}</span>
                </>
              )}
            </button>

            {!isSignUp && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="w-full text-[11px] font-mono text-slate-400 hover:text-teal-400 hover:underline cursor-pointer"
              >
                Forgot passcode?
              </button>
            )}

          </form>

          {/* Privacy Disclaimer footer */}
          <p className="text-[10px] text-center text-slate-500 font-mono mt-6 leading-relaxed">
            Authorized for medical laboratory sciences training.
            <br />
            Your progress, chats and study files are saved to your account.
          </p>

        </div>

      </div>

    </div>
  );
}
