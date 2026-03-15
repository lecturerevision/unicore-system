import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff, Mail, Lock, Loader2, GraduationCap, Users } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormValues = z.infer<typeof schema>;

const demoAccounts = [
  { label: "Staff", email: "staff@university.edu", password: "staff123", icon: Users, color: "bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900/40" },
  { label: "Student", email: "student@university.edu", password: "student123", icon: GraduationCap, color: "bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/40" },
];

const highlights = [
  "Track every complaint in real-time",
  "Direct messaging with staff",
  "Automatic department routing",
  "Secure role-based access",
];

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.requiresVerification) {
          sessionStorage.setItem("unicore_verify_email", json.email || data.email);
          toast({
            title: "Email not verified",
            description: "Please verify your email to continue.",
          });
          setLocation("/verify-email");
          return;
        }
        throw new Error(json.message || "Login failed");
      }

      localStorage.setItem("unicore_token", json.token);
      localStorage.setItem("unicore_user", JSON.stringify(json.user));
      window.location.href = "/";
    } catch (err: unknown) {
      toast({ title: "Login failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email: string, password: string) => {
    form.setValue("email", email);
    form.setValue("password", password);
  };

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Left branding panel ──────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] bg-gradient-to-br from-primary via-primary to-blue-700 relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-white/10 blur-3xl translate-x-1/2 translate-y-1/2" />
        <div className="absolute top-0 left-0 w-60 h-60 rounded-full bg-blue-400/20 blur-3xl -translate-x-1/2 -translate-y-1/2" />

        <div className="relative">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">UniCore</p>
              <p className="text-white/60 text-xs">Complaint Management</p>
            </div>
          </Link>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
            Welcome back to UniCore
          </h2>
          <p className="text-white/70 text-sm leading-relaxed mb-8">
            Sign in to submit, track, and manage university complaints — all from a single, secure dashboard.
          </p>
          <div className="space-y-3">
            {highlights.map((h, i) => (
              <motion.div
                key={h}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                <span className="text-white/80 text-sm">{h}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative text-white/40 text-xs">
          &copy; {new Date().getFullYear()} UniCore. All rights reserved.
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">UniCore</span>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Create one
              </Link>
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-email"
                  placeholder="you@university.edu"
                  className="pl-9"
                  data-testid="input-email"
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  className="pl-9 pr-10"
                  data-testid="input-password"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-semibold"
              disabled={loading}
              data-testid="button-sign-in"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sign In
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6">
            <p className="text-xs text-muted-foreground font-medium mb-2.5 text-center">
              — Quick demo access —
            </p>
            <div className="grid grid-cols-2 gap-3">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.label}
                  type="button"
                  onClick={() => fillDemo(acc.email, acc.password)}
                  data-testid={`demo-${acc.label.toLowerCase()}`}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border text-sm font-medium transition-all duration-150 cursor-pointer ${acc.color}`}
                >
                  <acc.icon className="w-4 h-4 shrink-0" />
                  <span>Sign in as {acc.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Click a role to fill credentials, then Sign In
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
