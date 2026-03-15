import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Shield, Mail, RefreshCw, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface VerifyEmailProps {
  email?: string;
}

export default function VerifyEmailPage({ email: propEmail }: VerifyEmailProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  const storedEmail = sessionStorage.getItem("unicore_verify_email") || propEmail || "";
  const [email] = useState(storedEmail);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleInput = (idx: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = char;
    setCode(next);
    if (char && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const fullCode = code.join("");

  const handleVerify = async () => {
    if (fullCode.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");

      sessionStorage.removeItem("unicore_verify_email");

      if (data.token && data.user) {
        localStorage.setItem("unicore_token", data.token);
        localStorage.setItem("unicore_user", JSON.stringify(data.user));
        toast({ title: "Email verified!", description: "Welcome to UniCore." });
        window.location.href = "/dashboard";
      } else {
        toast({ title: "Email verified!", description: "You can now sign in." });
        setLocation("/login");
      }
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend");
      toast({
        title: "Verification code sent",
        description: data.devCode ? `Dev code: ${data.devCode}` : "Check your inbox.",
      });
      setResendCooldown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      toast({ title: "Resend failed", description: err.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl shadow-lg mb-4">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
          <p className="text-muted-foreground text-sm mt-2">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{email || "your email"}</span>
          </p>
        </div>

        <div className="bg-card border rounded-xl shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-4 py-3">
            <Mail className="w-4 h-4 shrink-0 text-primary" />
            <span>Check your inbox and spam folder</span>
          </div>

          <div>
            <p className="text-sm font-medium text-center mb-4">Enter verification code</p>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {code.map((digit, idx) => (
                <Input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  value={digit}
                  onChange={(e) => handleInput(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  maxLength={1}
                  inputMode="numeric"
                  pattern="[0-9]"
                  data-testid={`input-code-${idx}`}
                  className="w-11 h-12 text-center text-lg font-bold tracking-widest p-0 rounded-lg border-2 focus:border-primary focus:ring-0"
                />
              ))}
            </div>
          </div>

          <Button
            onClick={handleVerify}
            disabled={loading || fullCode.length !== 6}
            className="w-full h-10 font-semibold"
            data-testid="button-verify-submit"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Verify Email</>
            )}
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Didn&apos;t receive the code?</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              data-testid="button-resend-code"
              className="text-primary hover:text-primary/80"
            >
              {resending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending…</>
              ) : resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Resend code</>
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setLocation("/login")}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to login
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
