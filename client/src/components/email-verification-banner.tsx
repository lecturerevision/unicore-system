import { useState } from "react";
import { AlertCircle, X, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending]  = useState(false);

  if (!user || user.emailVerified !== false || dismissed) return null;

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend");
      toast({
        title: "Verification code sent",
        description: data.devCode
          ? `Dev mode — code: ${data.devCode}`
          : `Check your inbox at ${user.email}.`,
      });
    } catch (err: any) {
      toast({ title: "Failed to resend", description: err.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
      data-testid="banner-email-verification"
    >
      <AlertCircle className="w-4 h-4 shrink-0" />
      <p className="text-sm flex-1">
        <strong>Email not verified.</strong>{" "}
        Please verify your email to access all features.{" "}
        <a href="/verify-email" className="underline underline-offset-2 hover:opacity-80">
          Verify now
        </a>
      </p>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleResend}
        disabled={resending}
        data-testid="button-banner-resend"
        className="text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 h-7 px-2 text-xs"
      >
        {resending
          ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending…</>
          : <><RefreshCw className="w-3 h-3 mr-1" /> Resend code</>}
      </Button>
      <button
        onClick={() => setDismissed(true)}
        data-testid="button-banner-dismiss"
        className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
