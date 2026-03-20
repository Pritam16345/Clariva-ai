"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, getAccessToken } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function AuthFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, setUser } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "verify-otp">(
    (searchParams.get("tab") as any) || "login"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP & reset states
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (currentUser && getAccessToken()) {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setHasError(false);

    try {
      if (mode === "login") {
        const response = await api.login(email, password);
        setUser(response.user);
        router.push("/dashboard");
      } else if (mode === "register") {
        await api.register(name, email, password);
        const response = await api.login(email, password);
        setUser(response.user);
        router.push("/dashboard");
      } else if (mode === "forgot") {
        await api.forgotPassword(email);
        toast.success("If an account exists, a reset code was sent to your email.");
        setMode("verify-otp");
      } else if (mode === "verify-otp") {
        if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
        if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
        const response = await api.verifyOtp(email, otp, newPassword);
        setUser(response.user);
        toast.success("Password reset successfully. Redirecting...");
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setHasError(true);
      toast.error(err instanceof Error ? err.message : "Authentication failed");
      setTimeout(() => setHasError(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#08080d] text-[#f0f0ec]">
      {/* Left panel (hidden on mobile) */}
      <div 
        className="hidden lg:flex flex-col flex-1 border-r border-[#252535] relative overflow-hidden p-12"
        style={{ backgroundImage: "linear-gradient(160deg, #0e0e16 0%, #0a0a12 100%)" }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[rgba(124,106,245,0.12)] to-transparent opacity-50" />
        
        <div className="z-10 flex flex-col h-full">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
            <img src="/clariva_logo.png" alt="Clariva" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span className="font-bold text-xl tracking-tight text-[#f0f0ec]">Clariva <span className="text-[#9d8df5] font-bold">AI</span></span>
          </div>

          <div className="my-auto">
            <h1 className="text-4xl lg:text-5xl font-bold mb-6 font-['Playfair_Display']">
              Your knowledge,<br />
              <span className="text-[#9d8df5] italic">Intelligently Amplified.</span>
            </h1>
            
            <div className="space-y-6 text-[#9a9a9a]">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7c6af5]" />
                <p>Chat with any document, website, or video instantly.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7c6af5]" />
                <p>Get precise answers with inline citations from your sources.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7c6af5]" />
                <p>Private, secure, and lightning fast knowledge retrieval.</p>
              </div>
            </div>
          </div>
          
          <div className="mt-auto text-sm text-[#9a9a9a]">
            &copy; {new Date().getFullYear()} Clariva AI. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 relative">
        <button 
          onClick={() => router.push("/")}
          className="absolute top-8 left-8 text-sm text-[#9a9a9a] hover:text-white transition-colors"
        >
          &larr; Back to home
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full max-w-[420px] bg-[#08080d] ${hasError ? "animate-shake" : ""}`}
        >
          {/* Header */}
          <div className="mb-8 text-center">
            <h2 className="text-[28px] tracking-[-0.02em] font-bold mb-2">
              {mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : mode === "verify-otp" ? "Check your email" : "Reset your password"}
            </h2>
            <p className="text-[#9a9a9a]">
              {mode === "login" ? "Sign in to your knowledge base" : mode === "register" ? "Join to unlock AI-powered insights" : mode === "verify-otp" ? `Enter the 6-digit code sent to ${email}` : "We'll send you a reset code"}
            </p>
          </div>

          <AnimatePresence mode="popLayout">
            <form onSubmit={handleAuth} className="space-y-4">
              {mode === "register" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5">
                  <label className="text-sm font-medium text-[#f0f0ec]">Name</label>
                  <Input 
                    type="text" 
                    placeholder="Jane Doe" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                    className="h-11 bg-[#0e0e16] border-[#252535] text-[#f0f0ec] focus:border-[#7c6af5] focus-visible:ring-1 focus-visible:ring-[#7c6af5] ring-offset-0 placeholder:text-[#4a4a5a] !outline-none" 
                  />
                </motion.div>
              )}

              {mode !== "verify-otp" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5">
                  <label className="text-sm font-medium text-[#f0f0ec]">Email</label>
                  <Input 
                    type="email" 
                    placeholder="you@example.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    className="h-11 bg-[#0e0e16] border-[#252535] text-[#f0f0ec] focus:border-[#7c6af5] focus-visible:ring-1 focus-visible:ring-[#7c6af5] ring-offset-0 placeholder:text-[#4a4a5a] !outline-none" 
                  />
                </motion.div>
              )}

              {(mode === "login" || mode === "register") && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-[#f0f0ec]">Password</label>
                    {mode === "login" && (
                      <button type="button" onClick={() => setMode("forgot")} className="text-sm text-[#9d8df5] hover:text-[#7c6af5] transition-colors">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 pr-10 bg-[#0e0e16] border-[#252535] text-[#f0f0ec] focus:border-[#7c6af5] focus-visible:ring-1 focus-visible:ring-[#7c6af5] ring-offset-0 placeholder:text-[#4a4a5a] !outline-none"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-[#5a5a6a] hover:text-[#f0f0ec]">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </motion.div>
              )}

              {mode === "verify-otp" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#f0f0ec] text-center block">6-Digit Code</label>
                    <Input
                      type="text"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      maxLength={6}
                      className="h-14 text-2xl tracking-[0.5em] text-center font-mono bg-[#0e0e16] border-[#252535] text-[#f0f0ec] focus:border-[#7c6af5] focus-visible:ring-1 focus-visible:ring-[#7c6af5] ring-offset-0 placeholder:text-[#4a4a5a] !outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 mt-6">
                    <label className="text-sm font-medium text-[#f0f0ec]">New Password</label>
                    <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} className="h-11 bg-[#0e0e16] border-[#252535] text-[#f0f0ec] focus:border-[#7c6af5] focus-visible:ring-1 focus-visible:ring-[#7c6af5] ring-offset-0 placeholder:text-[#4a4a5a] !outline-none" />
                  </div>
                  <div className="space-y-1.5 mt-4">
                    <label className="text-sm font-medium text-[#f0f0ec]">Confirm Password</label>
                    <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="h-11 bg-[#0e0e16] border-[#252535] text-[#f0f0ec] focus:border-[#7c6af5] focus-visible:ring-1 focus-visible:ring-[#7c6af5] ring-offset-0 placeholder:text-[#4a4a5a] !outline-none" />
                  </div>
                </motion.div>
              )}

              <Button 
                type="submit" 
                className="w-full h-11 mt-4 bg-[#7c6af5] hover:bg-[#6d5ce6] text-white rounded-lg font-semibold tracking-[0.01em] transition-all duration-200 ease-in-out" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : mode === "verify-otp" ? "Reset Password" : "Send Reset Code"}
              </Button>

              {(mode === "forgot" || mode === "verify-otp") && (
                <button
                  type="button"
                  className="w-full text-center text-sm text-[#9a9a9a] hover:text-white transition-colors mt-4"
                  onClick={() => { setMode("login"); setHasError(false); setOtp(""); setNewPassword(""); setConfirmPassword(""); }}
                  disabled={isLoading}
                >
                  &larr; Back to sign in
                </button>
              )}
            </form>
          </AnimatePresence>

          {(mode === "login" || mode === "register") && (
            <p className="text-center mt-6 text-sm text-[#9a9a9a]">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setHasError(false); }}
                className="text-white hover:text-[#7c6af5] transition-colors"
              >
                {mode === "login" ? "Sign up \u2192" : "Sign in \u2192"}
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08080d]" />}>
      <AuthFormContent />
    </Suspense>
  );
}
