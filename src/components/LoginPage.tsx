import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, User, ShieldAlert, KeyRound, Loader2, CheckCircle2, FlaskConical, TestTube, GraduationCap, Trophy, ArrowRight } from "lucide-react";
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
      setError("Password must be at least 8 characters.");
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
      setError("Enter your email above first, then choose \"Forgot password\".");
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (resetError) setError(resetError.message);
    else setNotice(`If an account exists for ${email}, a reset link is on its way.`);
  };

  const field = "w-full rounded-xl border border-line bg-surface-2 pl-11 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-accent transition-colors";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1fr_minmax(440px,520px)]">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-line bg-surface p-12">
        <div className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-accent/12 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-accent flex items-center justify-center">
            <FlaskConical className="w-6 h-6 text-accent-ink" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">LabMaster</span>
        </div>
        <div className="relative max-w-lg space-y-8">
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            Train like you're already on the <span className="text-accent">lab bench</span>.
          </h1>
          <ul className="space-y-5">
            {[
              [TestTube, "Realistic patient cases", "Read real-looking analyzer reports and catch the critical values."],
              [GraduationCap, "An AI professor on call", "Ask anything — answers grounded in your own study files."],
              [Trophy, "Progress that sticks", "XP, streaks and badges across all five MLS disciplines."]
            ].map(([Icon, title, text]: any) => (
              <li key={title} className="flex gap-4">
                <span className="h-10 w-10 shrink-0 rounded-xl bg-accent/14 flex items-center justify-center"><Icon className="w-5 h-5 text-accent" /></span>
                <div>
                  <p className="font-bold">{title}</p>
                  <p className="text-sm text-ink-2 mt-0.5">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-ink-3">For Medical Laboratory Science students. Simulated data, real learning.</p>
      </aside>

      {/* Form */}
      <main className="flex min-h-screen items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md space-y-7">
          <div className="lg:hidden flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-accent-ink" />
            </div>
            <span className="text-lg font-extrabold tracking-tight">LabMaster</span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-extrabold tracking-tight">{isSignUp ? "Create your account" : "Welcome back"}</h2>
            <p className="text-[15px] text-ink-2">{isSignUp ? "Start training in under a minute." : "Sign in to pick up where you left off."}</p>
          </div>

          <div className="grid grid-cols-2 rounded-xl border border-line bg-surface p-1" role="tablist">
            {[["Sign in", false], ["Create account", true]].map(([label, up]) => (
              <button
                key={String(label)}
                type="button"
                role="tab"
                aria-selected={isSignUp === up}
                onClick={() => { setIsSignUp(up as boolean); setError(null); setNotice(null); }}
                className={`rounded-lg py-2.5 text-sm font-bold transition-colors cursor-pointer ${isSignUp === up ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink-2"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert"
                className="rounded-xl border border-critical/40 bg-critical/10 p-3.5 text-sm text-critical flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </motion.div>
            )}
          </AnimatePresence>
          {notice && (
            <div className="rounded-xl border border-normal/40 bg-normal/10 p-3.5 text-sm text-normal flex items-start gap-2.5" role="status">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-semibold text-ink-2">Full name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-3" />
                  <input id="name" type="text" required autoComplete="name" placeholder="Alex Reed" value={name} onChange={e => setName(e.target.value)} className={field} />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-ink-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-3" />
                <input id="email" type="email" required autoComplete="email" placeholder="you@school.edu" value={email} onChange={e => setEmail(e.target.value)} className={field} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center">
                <label htmlFor="password" className="flex-1 text-sm font-semibold text-ink-2">Password</label>
                {!isSignUp && (
                  <button type="button" onClick={handleForgotPassword} className="text-sm font-semibold text-accent hover:underline cursor-pointer">Forgot password?</button>
                )}
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-3" />
                <input id="password" type="password" required autoComplete={isSignUp ? "new-password" : "current-password"} placeholder={isSignUp ? "At least 8 characters" : "Your password"} value={password} onChange={e => setPassword(e.target.value)} className={field} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-[15px]">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {isSignUp ? "Creating account…" : "Signing in…"}</> : <>{isSignUp ? "Create account" : "Sign in"} <ArrowRight className="w-[18px] h-[18px]" /></>}
            </button>
          </form>

          <p className="text-sm text-ink-3 text-center">Your progress, chats and study files are saved to your account.</p>
        </div>
      </main>
    </div>
  );
}
