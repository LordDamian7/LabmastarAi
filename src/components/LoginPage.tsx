import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Mail, User, ShieldAlert, Sparkles, LogIn, KeyRound, Loader2 } from "lucide-react";

interface LoginPageProps {
  onLoginSuccess: (user: { email: string; name: string; photoUrl?: string }) => void;
  userEmailFromMetadata?: string;
}

export default function LoginPage({ onLoginSuccess, userEmailFromMetadata = "CaptainUzzi@gmail.com" }: LoginPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleFlowActive, setGoogleFlowActive] = useState(false);
  const [selectedGoogleAccount, setSelectedGoogleAccount] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all standard credentials.");
      return;
    }

    if (isSignUp && !name) {
      setError("Name is required to sign up as a MLS Candidate.");
      return;
    }

    setLoading(true);

    // Simulated authentic calibration delay
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess({
        email: email,
        name: isSignUp ? name : email.split("@")[0].toUpperCase(),
      });
    }, 1200);
  };

  const startGoogleLogin = () => {
    setError(null);
    setGoogleFlowActive(true);
  };

  const handleSelectGoogleAccount = (accEmail: string, displayName: string) => {
    setLoading(true);
    setGoogleFlowActive(false);
    
    // Simulating token exchange delay
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess({
        email: accEmail,
        name: displayName,
        photoUrl: "https://lh3.googleusercontent.com/a/default-user"
      });
    }, 1000);
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

          {/* Form and Social Section */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Quick-Access Pilot Login for Preview sandbox environments */}
            <div className="p-3 bg-teal-500/5 hover:bg-teal-500/10 active:bg-teal-500/15 border border-teal-500/20 hover:border-teal-500/30 rounded-xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
              onClick={() => {
                setLoading(true);
                setTimeout(() => {
                  setLoading(false);
                  onLoginSuccess({
                    email: userEmailFromMetadata,
                    name: "Captain Uzzi",
                    photoUrl: "https://lh3.googleusercontent.com/a/default-user"
                  });
                }, 400);
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:scale-110 transition-transform">
                  ⚡
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold text-teal-300 leading-tight">Instant Demo Bypass</p>
                  <p className="text-[9px] font-mono text-slate-400 truncate">1-Click Sign-In ({userEmailFromMetadata})</p>
                </div>
              </div>
              <span className="text-teal-400 group-hover:translate-x-0.5 transition-transform text-xs font-bold font-mono">
                Launch &rarr;
              </span>
            </div>

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

            {/* Divider */}
            <div className="relative flex py-3 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-900 px-1">
                OR INTER-PROTOCOL
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Google Sign In option */}
            <button
              type="button"
              onClick={startGoogleLogin}
              disabled={loading}
              className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer transform active:scale-[0.98] disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

          </form>

          {/* Privacy Disclaimer footer */}
          <p className="text-[10px] text-center text-slate-500 font-mono mt-6 leading-relaxed">
            Authorized for medical laboratory sciences training.
            <br />
            Data is persisted securely via standard sandbox storage.
          </p>

        </div>

      </div>

      {/* Simulated Google Account Chooser Consent Popup Overlay */}
      <AnimatePresence>
        {googleFlowActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-white text-slate-800 rounded-2xl shadow-2xl p-6 font-sans border border-slate-200"
            >
              {/* Google Header Logo */}
              <div className="flex flex-col items-center border-b border-slate-100 pb-4">
                <svg className="w-8 h-8" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <h3 className="text-lg font-bold text-slate-800 mt-2.5">Sign in with Google</h3>
                <p className="text-xs text-slate-500 mt-1">to continue to <span className="font-semibold text-teal-600">LabMaster AI</span></p>
              </div>

              {/* Account Chooser Options */}
              <div className="py-4 space-y-2">
                
                {/* Real user option based on session metadata */}
                <button
                  onClick={() => handleSelectGoogleAccount(userEmailFromMetadata, "Captain Uzzi")}
                  className="w-full flex items-center gap-3.5 p-3 rounded-xl hover:bg-slate-50 border border-slate-100/60 hover:border-slate-200 text-left transition-all cursor-pointer group"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-teal-400 rounded-full text-white flex items-center justify-center font-bold text-sm tracking-wider shadow">
                    CU
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 truncate">Captain Uzzi</p>
                    <p className="text-xs text-slate-500 truncate">{userEmailFromMetadata}</p>
                  </div>
                </button>

                {/* Alternative guest option */}
                <button
                  onClick={() => handleSelectGoogleAccount("guest.scientist@gmail.com", "Guest MLS Scientist")}
                  className="w-full flex items-center gap-3.5 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-250 text-left transition-all cursor-pointer group"
                >
                  <div className="w-9 h-9 bg-slate-100 rounded-full text-slate-500 flex items-center justify-center font-bold text-sm">
                    G
                  </div>
                  <div className="flex-1 min-w-0 font-sans">
                    <p className="text-sm font-medium text-slate-600 group-hover:text-slate-900 truncate">Use another account</p>
                    <p className="text-xs text-slate-400 truncate">guest.scientist@gmail.com</p>
                  </div>
                </button>
              </div>

              {/* Consent and Cancel Buttons */}
              <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-xs text-slate-500">
                <span>To continue, Google will share your name, email address, language preference, and profile picture with LabMaster AI.</span>
              </div>
              
              <div className="mt-4 flex justify-end gap-2.5">
                <button
                  onClick={() => setGoogleFlowActive(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
