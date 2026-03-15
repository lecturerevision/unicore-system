import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, GraduationCap, Users, Eye, EyeOff,
  Mail, Lock, User, Loader2, CheckCircle2, ArrowLeft,
} from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  role: z.enum(["student", "staff"]),
  department: z.string().optional(),
  studentId: z.string().optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof schema>;

const benefits = [
  "Submit and track complaints from anywhere",
  "Real-time updates at every status change",
  "Secure, private, and role-protected",
  "File attachments for supporting evidence",
];

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [role, setRole] = useState<"student" | "staff">("student");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", role: "student", department: "", studentId: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          department: data.department || undefined,
          studentId: data.studentId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Registration failed");

      sessionStorage.setItem("unicore_verify_email", data.email);

      toast({
        title: "Account created!",
        description: json.devCode
          ? `Dev mode — verification code: ${json.devCode}`
          : "Please check your email to verify your account.",
      });
      setLocation("/verify-email");
    } catch (err: unknown) {
      toast({ title: "Registration failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Left branding panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] bg-gradient-to-br from-primary via-primary to-blue-700 relative flex-col justify-between p-12 overflow-hidden">
        {/* Decorative background grid */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow blobs */}
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

        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight mb-2">
              Join thousands of students and staff
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">
              UniCore makes it easy to raise, track, and resolve campus issues — all in one transparent platform.
            </p>
          </div>

          <div className="space-y-3">
            {benefits.map((b, i) => (
              <motion.div
                key={b}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.12 }}
                className="flex items-center gap-3"
              >
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
                <span className="text-white/80 text-sm">{b}</span>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="flex-1 rounded-lg bg-white/10 backdrop-blur-sm p-4 border border-white/20">
              <GraduationCap className="w-5 h-5 text-white/70 mb-2" />
              <p className="text-white text-sm font-semibold">Students</p>
              <p className="text-white/60 text-xs">Submit & track your complaints</p>
            </div>
            <div className="flex-1 rounded-lg bg-white/10 backdrop-blur-sm p-4 border border-white/20">
              <Users className="w-5 h-5 text-white/70 mb-2" />
              <p className="text-white text-sm font-semibold">Staff</p>
              <p className="text-white/60 text-xs">Review & resolve efficiently</p>
            </div>
          </div>
        </div>

        <p className="relative text-white/40 text-xs">
          &copy; {new Date().getFullYear()} UniCore. All rights reserved.
        </p>
      </div>

      {/* ── Right form panel ────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">UniCore</span>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Role selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
              {(["student", "staff"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRole(r);
                    form.setValue("role", r);
                  }}
                  data-testid={`role-tab-${r}`}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                    role === r
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "student" ? <GraduationCap className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                  <span className="capitalize">{r}</span>
                </button>
              ))}
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-name"
                  placeholder="Jane Doe"
                  className="pl-9"
                  data-testid="input-register-name"
                  {...form.register("name")}
                />
              </div>
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-email"
                  placeholder="you@university.edu"
                  className="pl-9"
                  data-testid="input-register-email"
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Role-specific fields */}
            {role === "student" ? (
              <div className="space-y-1.5">
                <Label htmlFor="reg-studentId">Student ID <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="reg-studentId"
                  placeholder="e.g. S2024001"
                  data-testid="input-register-student-id"
                  {...form.register("studentId")}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="reg-department">Department <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="reg-department"
                  placeholder="e.g. Information Technology"
                  data-testid="input-register-department"
                  {...form.register("department")}
                />
              </div>
            )}

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-password"
                  type={showPass ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  className="pl-9 pr-10"
                  data-testid="input-register-password"
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-confirm">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat your password"
                  className="pl-9 pr-10"
                  data-testid="input-register-confirm-password"
                  {...form.register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-semibold"
              disabled={loading}
              data-testid="button-register-submit"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Account
            </Button>

            <p className="text-xs text-center text-muted-foreground pt-1">
              By signing up, you agree to our{" "}
              <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
