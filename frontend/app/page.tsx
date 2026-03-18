"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, getAccessToken } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AuthPage() {
  const router = useRouter();
  const { currentUser, setUser } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "verify-otp">("login");

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

  const getPasswordStrength = () => {
    const pw = mode === "verify-otp" ? newPassword : password;
    if (!pw) return 0;
    let strength = 0;
    if (pw.length > 7) strength += 1;
    if (/[A-Z]/.test(pw)) strength += 1;
    if (/[0-9]/.test(pw)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pw)) strength += 1;
    return strength;
  };
  const strength = getPasswordStrength();

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

  const getInitials = () => name.substring(0, 2).toUpperCase() || "AI";

  const PasswordStrengthBar = () => (
    <div className="pt-1 w-full animate-fade-in">
      <div className="flex gap-1 h-1 w-full rounded-full overflow-hidden bg-secondary">
        <div className={`h-full flex-1 ${strength >= 1 ? "bg-destructive" : ""} ${strength >= 2 ? "bg-orange-500" : ""} ${strength >= 3 ? "bg-yellow-500" : ""} ${strength >= 4 ? "bg-green-500" : ""}`} />
        <div className={`h-full flex-1 ${strength >= 2 ? "bg-orange-500" : ""} ${strength >= 3 ? "bg-yellow-500" : ""} ${strength >= 4 ? "bg-green-500" : ""}`} />
        <div className={`h-full flex-1 ${strength >= 3 ? "bg-yellow-500" : ""} ${strength >= 4 ? "bg-green-500" : ""}`} />
        <div className={`h-full flex-1 ${strength >= 4 ? "bg-green-500" : ""}`} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1 text-right">
        {strength < 2 ? "Weak" : strength < 4 ? "Good" : "Strong"}
      </p>
    </div>
  );

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      {/* Background glow */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cogni-accent-glow blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary blur-[120px]" />
      </div>

      {/* Left marketing column (desktop only) */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 hidden lg:flex flex-1 flex-col justify-center px-16 xl:px-24 max-w-[640px]"
      >
        <div className="flex items-center gap-3 mb-16">
          <Image src="/clariva_logo.png" alt="Clariva" width={36} height={36} className="rounded-md" />
          <span className="font-display text-xl font-bold text-foreground">Clariva</span>
        </div>

        <h1 className="font-display text-[clamp(44px,6vw,72px)] font-normal leading-[1.05] tracking-tight text-foreground mb-6">
          Your knowledge,<br />
          <span className="italic">amplified.</span>
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground w-full max-w-[420px] mb-12">
          Feed it videos, documents, or websites. Ask anything. Get answers that actually cite their precise source.
        </p>

        <div className="grid grid-cols-2 gap-4 max-w-[480px]">
          {[
            { tag: "Deep Research", text: "Multi-source synthesis" },
            { tag: "YouTube", text: "Instant transcript insights" },
            { tag: "Citations", text: "Inline source verification" },
            { tag: "Media", text: "Accurate audio transcription" },
            { tag: "Streaming", text: "Real-time token responses" },
            { tag: "Speed", text: "Instant vector-search retrieval" },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex flex-col gap-1 p-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur hover:bg-card/50 transition-colors"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{feature.tag}</span>
              <span className="text-sm font-medium text-foreground">{feature.text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Auth form column */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-8 bg-card shadow-[-20px_0_40px_rgba(0,0,0,0.02)] border-l border-border min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`w-full max-w-[400px] ${hasError ? "animate-shake" : ""}`}
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-10">
            <Image src="/clariva_logo.png" alt="Clariva" width={32} height={32} className="rounded-md" />
            <span className="font-display font-semibold text-xl tracking-tight">Clariva</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <Image src="/clariva_logo.png" alt="Clariva" width={40} height={40} className="rounded-xl mb-6" />
            <h1 className="text-3xl font-display font-bold mb-2">
              Welcome to <span className="text-primary">Clariva</span>
            </h1>
            <p className="text-muted-foreground text-sm">Your intelligent assistant</p>
          </div>

          <div className="mb-8 text-center">
            {mode === "register" && (
              <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-xl font-display font-medium mb-4 overflow-hidden border border-border shadow-sm">
                {getInitials()}
              </div>
            )}
            <h2 className="font-display text-3xl font-medium tracking-tight mb-2">
              {mode === "login" ? "Welcome back" : mode === "register" ? "Create an account" : mode === "verify-otp" ? "Check your email" : "Reset password"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to access your knowledge base" : mode === "register" ? "Join to start building your personal AI" : mode === "verify-otp" ? `Enter the 6-digit code sent to ${email}` : "We'll send you a reset code"}
            </p>
          </div>

          <AnimatePresence mode="popLayout">
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleAuth}
              className="space-y-4"
            >
              {mode === "register" && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</label>
                  <Input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required className="h-11 shadow-sm focus-visible:ring-1" />
                </div>
              )}

              {mode !== "verify-otp" && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                  <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 shadow-sm focus-visible:ring-1" />
                </div>
              )}

              {(mode === "login" || mode === "register") && (
                <div className="space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
                    {mode === "login" && (
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={mode === "register" ? "Create a strong password" : "••••••••"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 shadow-sm pr-10 focus-visible:ring-1"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {mode === "register" && password.length > 0 && <PasswordStrengthBar />}
                </div>
              )}

              {mode === "verify-otp" && (
                <>
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">6-Digit Code</label>
                    <Input
                      type="text"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      maxLength={6}
                      className="h-11 shadow-sm focus-visible:ring-1 tracking-widest text-center text-lg"
                    />
                  </div>
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Password</label>
                    <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} className="h-11 shadow-sm focus-visible:ring-1" />
                  </div>
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirm Password</label>
                    <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="h-11 shadow-sm focus-visible:ring-1" />
                  </div>
                  {newPassword.length > 0 && <PasswordStrengthBar />}
                </>
              )}

              <Button type="submit" className="w-full h-11 mt-2 text-sm font-medium" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "verify-otp" ? "Reset Password" : "Send reset code"}
              </Button>

              {(mode === "forgot" || mode === "verify-otp") && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-11 mt-2 text-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
                  onClick={() => { setMode("login"); setHasError(false); setOtp(""); setNewPassword(""); setConfirmPassword(""); }}
                  disabled={isLoading}
                >
                  Back to login
                </Button>
              )}
            </motion.form>
          </AnimatePresence>

          {(mode === "login" || mode === "register") && (
            <p className="text-center mt-8 text-sm text-muted-foreground">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setHasError(false); }}
                className="text-primary font-medium hover:underline focus:outline-none"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
