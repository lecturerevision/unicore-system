import { Link } from "wouter";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Shield, GraduationCap, Users, BarChart3, Bell, MessageSquare,
  CheckCircle2, Clock, Upload, ChevronRight, ArrowRight,
  Building2, ClipboardList, Lock, Zap, Star, TrendingUp,
  FileText, Activity, AlertCircle, Menu, X, CheckCheck,
  Quote, Globe, Mail, Twitter, Github, Linkedin,
  UserCheck, Tag, Send, PieChart as PieChartIcon,
} from "lucide-react";

/* ─── Mock data for analytics preview ──────────────────────────── */
const monthlyData = [
  { month: "Oct", submitted: 18, resolved: 12 },
  { month: "Nov", submitted: 24, resolved: 18 },
  { month: "Dec", submitted: 16, resolved: 15 },
  { month: "Jan", submitted: 31, resolved: 22 },
  { month: "Feb", submitted: 27, resolved: 24 },
  { month: "Mar", submitted: 34, resolved: 30 },
];

const statusData = [
  { name: "Resolved", value: 61, fill: "#10b981" },
  { name: "In Progress", value: 22, fill: "#6366f1" },
  { name: "Pending", value: 17, fill: "#f59e0b" },
];

const deptData = [
  { dept: "IT", count: 34 },
  { dept: "Library", count: 22 },
  { dept: "Finance", count: 18 },
  { dept: "Hostel", count: 15 },
  { dept: "Admin", count: 11 },
];

/* ─── Data ──────────────────────────────────────────────────────── */
const features = [
  { icon: ClipboardList, title: "Smart Complaint Routing",   description: "Complaints are automatically routed to the right department. No manual triaging — just instant delivery to the right team.", color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/50",   border: "border-blue-100 dark:border-blue-900" },
  { icon: Bell,          title: "Real-Time Notifications",   description: "Every status change, comment, or assignment triggers an instant notification. Nobody gets left in the dark.",             color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/50", border: "border-violet-100 dark:border-violet-900" },
  { icon: MessageSquare, title: "Collaborative Comments",    description: "Threaded comments on every ticket. Staff can add internal notes invisible to students — secure and professional.",          color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50", border: "border-emerald-100 dark:border-emerald-900" },
  { icon: Upload,        title: "File Attachments",          description: "Attach photos, PDFs, and documents as evidence. Up to 5 files per complaint, 10 MB each, with inline preview.",           color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/50", border: "border-orange-100 dark:border-orange-900" },
  { icon: BarChart3,     title: "Analytics & Insights",      description: "Rich dashboards showing resolution rates, category trends, resolution time buckets, and department performance.",           color: "text-pink-600 dark:text-pink-400",     bg: "bg-pink-50 dark:bg-pink-950/50",     border: "border-pink-100 dark:border-pink-900" },
  { icon: Lock,          title: "Role-Based Security",       description: "JWT-secured, role-separated access. Students see only their own tickets. Admins see everything. Zero data leaks.",         color: "text-teal-600 dark:text-teal-400",     bg: "bg-teal-50 dark:bg-teal-950/50",     border: "border-teal-100 dark:border-teal-900" },
  { icon: UserCheck,     title: "Staff Work Queue",          description: "Staff get a powerful inbox view with inline status updates, reply threads, and internal remarks — all in one place.",       color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/50", border: "border-indigo-100 dark:border-indigo-900" },
  { icon: Activity,      title: "Full Activity Audit Log",   description: "Every action is tracked: who changed what, when, and why. Full transparency and accountability across the system.",         color: "text-rose-600 dark:text-rose-400",     bg: "bg-rose-50 dark:bg-rose-950/50",     border: "border-rose-100 dark:border-rose-900" },
  { icon: Globe,         title: "Multi-Department Support",  description: "Manage IT, Library, Finance, Hostel, Sports, and more — each with its own routing rules and staff team.",                  color: "text-cyan-600 dark:text-cyan-400",     bg: "bg-cyan-50 dark:bg-cyan-950/50",     border: "border-cyan-100 dark:border-cyan-900" },
];

const steps = [
  { step: "01", icon: Send,          title: "Submit a Complaint",    description: "Fill a short form — title, description, category, priority. Attach any supporting files. Takes less than 90 seconds.", accent: "#6366f1" },
  { step: "02", icon: Building2,     title: "Auto-Routed & Assigned", description: "UniCore instantly routes your ticket to the right department and notifies the assigned staff member.", accent: "#f59e0b" },
  { step: "03", icon: MessageSquare, title: "Track & Communicate",   description: "Watch live status changes, exchange messages with staff, and get push notifications at every step.", accent: "#10b981" },
  { step: "04", icon: CheckCheck,    title: "Resolved & Closed",     description: "Once resolved, you get a final notification with the resolution notes. The ticket is archived for reference.", accent: "#6366f1" },
];

const testimonials = [
  { name: "Dr. Aisha Nwosu",    role: "Academic Registrar, Lagos State University",          avatar: "AN", text: "UniCore transformed how we handle student complaints. Response times dropped from 2 weeks to under 2 days. The analytics dashboard alone justifies the switch.", rating: 5, color: "bg-blue-600" },
  { name: "James Okafor",       role: "Student, Computer Science · Year 3",                  avatar: "JO", text: "Before UniCore, I had to email three different offices and follow up manually. Now I submit once, track in real-time, and actually get answers. Game-changer.", rating: 5, color: "bg-purple-600" },
  { name: "Ms. Patricia Mwangi",role: "Head of IT Support, University of Nairobi",           avatar: "PM", text: "The staff work queue is brilliant. Inline status updates, file previews, internal notes — my team resolves 40% more tickets per week than before.", rating: 5, color: "bg-green-600" },
  { name: "Prof. Emeka Adeyemi", role: "Dean of Student Affairs, Covenant University",       avatar: "EA", text: "Full audit trails and role-based access gave our compliance team exactly what they needed. We passed our accreditation review without a single documentation gap.", rating: 5, color: "bg-orange-600" },
  { name: "Sandra Obi",         role: "Student Union President, University of Ghana",        avatar: "SO", text: "Students trust UniCore because they can actually see what's happening with their complaints. Transparency changed everything — less frustration, more trust.", rating: 5, color: "bg-teal-600" },
  { name: "Mr. Yusuf Balogun",  role: "Director of Administration, ABU Zaria",               avatar: "YB", text: "Setting up departments and routing rules took an afternoon. The system just works. Our staff didn't need any training — the interface is that intuitive.", rating: 5, color: "bg-rose-600" },
];

const stats = [
  { value: "99.9%",  label: "System uptime",          icon: Activity,   color: "text-green-500" },
  { value: "< 2h",   label: "Avg. first response",    icon: Clock,      color: "text-blue-500" },
  { value: "3 roles", label: "Role-separated access", icon: Shield,     color: "text-purple-500" },
  { value: "10+",    label: "Department modules",      icon: Building2,  color: "text-orange-500" },
];

const roles = [
  {
    icon: GraduationCap, role: "Student", gradient: "from-blue-500 to-indigo-600",
    points: ["Submit tickets in 90 seconds", "Real-time status tracking", "Direct messaging with staff", "File attachments as evidence", "Instant notifications on every update"],
  },
  {
    icon: Users, role: "Staff", gradient: "from-purple-500 to-violet-600",
    points: ["Powerful inbox work queue", "Inline status & priority updates", "Public replies + internal notes", "File preview & download inline", "Workload & resolution metrics"],
    featured: true,
  },
  {
    icon: Shield, role: "Admin", gradient: "from-emerald-500 to-teal-600",
    points: ["Full system oversight", "Assign complaints to departments", "Analytics & performance charts", "Manage users, roles, departments", "Activity audit log"],
  },
];

/* ─── Animation helpers ─────────────────────────────────────────── */
function FadeIn({ children, delay = 0, className = "", direction = "up" as "up" | "left" | "right" }: {
  children: React.ReactNode; delay?: number; className?: string; direction?: "up" | "left" | "right";
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const initial = { opacity: 0, y: direction === "up" ? 28 : 0, x: direction === "left" ? -28 : direction === "right" ? 28 : 0 };
  return (
    <motion.div ref={ref} initial={initial} animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Star rating ───────────────────────────────────────────────── */
function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(count)].map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

/* ─── Section badge ─────────────────────────────────────────────── */
function SectionBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-medium border-primary/30 text-primary bg-primary/5">
      {label}
    </Badge>
  );
}

/* ─── Ticket mockup card ────────────────────────────────────────── */
function TicketCard({ ticketId, title, status, dept, lastUpdate, comment, animDelay = 0 }: {
  ticketId: string; title: string; status: string; dept: string;
  lastUpdate: string; comment: string; animDelay?: number;
}) {
  const statusStyle: Record<string, string> = {
    "In Progress": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    "Resolved":    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "Pending":     "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "Assigned":    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: animDelay }}
      className="rounded-xl border border-border bg-card shadow-sm p-4 text-left"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{ticketId}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle[status] ?? ""}`}>{status}</span>
      </div>
      <p className="text-sm font-semibold mb-1 truncate">{title}</p>
      <p className="text-[10px] text-muted-foreground mb-3">{dept} · {lastUpdate}</p>
      <div className="flex items-start gap-2 bg-muted/60 rounded-lg p-2.5">
        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">S</div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{comment}</p>
      </div>
    </motion.div>
  );
}

/* ─── Main component ────────────────────────────────────────────── */
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY  = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const heroOp = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Sticky Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <Shield className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">UniCore</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {[["Features","#features"],["How It Works","#how"],["Analytics","#analytics"],["Testimonials","#testimonials"]].map(([label, href]) => (
              <a key={label} href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden md:inline-flex" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" className="shadow-sm" asChild>
              <Link href="/register">
                Get Started
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border bg-background/95 md:hidden"
            >
              <div className="px-6 py-4 space-y-3">
                {[["Features","#features"],["How It Works","#how"],["Analytics","#analytics"],["Testimonials","#testimonials"]].map(([label, href]) => (
                  <a key={label} href={href} className="block text-sm font-medium text-muted-foreground hover:text-foreground py-1"
                    onClick={() => setMobileMenuOpen(false)}>
                    {label}
                  </a>
                ))}
                <Separator />
                <Link href="/login" className="block text-sm font-medium py-1" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                <Button className="w-full" asChild><Link href="/register">Get Started Free</Link></Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── HERO ─────────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative overflow-hidden min-h-[92vh] flex items-center">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-violet-500/5" />
          <motion.div style={{ y: heroY }} className="absolute inset-0">
            <div className="absolute -top-48 -left-48 w-[700px] h-[700px] rounded-full bg-primary/12 blur-3xl" />
            <div className="absolute top-32 -right-32 w-[500px] h-[500px] rounded-full bg-violet-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 w-[400px] h-[300px] rounded-full bg-emerald-500/6 blur-3xl" />
          </motion.div>
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
            style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "48px 48px" }}
          />
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left copy */}
            <motion.div style={{ opacity: heroOp }}>
              <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Badge variant="outline" className="mb-6 px-4 py-1.5 text-xs font-medium border-primary/30 text-primary bg-primary/5">
                  <Zap className="w-3 h-3 mr-1.5 fill-current" />
                  University Complaint Management System
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
              >
                Resolve Campus{" "}
                <span className="relative">
                  <span className="relative z-10 bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                    Complaints
                  </span>
                  <span className="absolute bottom-1 left-0 right-0 h-3 bg-primary/10 rounded blur-sm -z-0" />
                </span>
                {" "}Faster, Together
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.2 }}
                className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg"
              >
                UniCore connects students, staff, and administrators in a single transparent platform — every complaint tracked, routed, and resolved with full visibility.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex items-center gap-3 flex-wrap mb-8"
              >
                <Button size="lg" className="h-12 px-8 text-sm font-semibold shadow-lg" asChild>
                  <Link href="/register">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 text-sm" asChild>
                  <Link href="/login">Sign In to Demo</Link>
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.45 }}
                className="flex items-center gap-5 flex-wrap"
              >
                {[
                  { icon: CheckCircle2, text: "Free to start", color: "text-emerald-500" },
                  { icon: Shield,       text: "JWT secured",    color: "text-blue-500" },
                  { icon: Zap,          text: "No setup time",  color: "text-violet-500" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    {item.text}
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right — dashboard mockup */}
            <div className="relative hidden lg:block">
              {/* Glow behind */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-violet-500/10 to-transparent rounded-3xl blur-3xl scale-110" />

              <motion.div
                initial={{ opacity: 0, x: 40, rotateY: -10 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                transition={{ duration: 0.75, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
                style={{ perspective: 1200 }}
              >
                {/* Main window */}
                <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                  {/* Window chrome */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    <div className="ml-3 flex-1 bg-background/60 rounded-md h-5 flex items-center px-2.5">
                      <span className="text-[9px] text-muted-foreground font-mono">unicore.university.edu/dashboard</span>
                    </div>
                  </div>

                  {/* Dashboard content */}
                  <div className="p-4 space-y-3">
                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Total",       value: "127", color: "text-foreground" },
                        { label: "Open",        value: "23",  color: "text-amber-600 dark:text-amber-400" },
                        { label: "In Progress", value: "18",  color: "text-purple-600 dark:text-purple-400" },
                        { label: "Resolved",    value: "86",  color: "text-emerald-600 dark:text-emerald-400" },
                      ].map((s) => (
                        <div key={s.label} className="bg-muted/50 rounded-lg p-2.5 text-center">
                          <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                          <p className="text-[9px] text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Mini chart */}
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[9px] text-muted-foreground font-medium mb-1.5">Monthly trend</p>
                      <ResponsiveContainer width="100%" height={60}>
                        <AreaChart data={monthlyData} margin={{ top: 2, right: 2, bottom: 0, left: -40 }}>
                          <defs>
                            <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="month" tick={{ fontSize: 7 }} axisLine={false} tickLine={false} />
                          <Area type="monotone" dataKey="submitted" stroke="#6366f1" fill="url(#heroGrad)" strokeWidth={1.5} dot={false} />
                          <Area type="monotone" dataKey="resolved"  stroke="#10b981" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Ticket list */}
                    {[
                      { id: "UC-2026-0127", title: "Library Wi-Fi unstable", status: "In Progress", dept: "IT", time: "2m ago" },
                      { id: "UC-2026-0126", title: "Hostel hot water outage", status: "Assigned",   dept: "Facilities", time: "15m ago" },
                      { id: "UC-2026-0124", title: "Tuition fee discrepancy", status: "Resolved",   dept: "Finance", time: "1h ago" },
                    ].map((t, i) => {
                      const statusClass: Record<string, string> = {
                        "In Progress": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
                        "Assigned":    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                        "Resolved":    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                      };
                      return (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                          className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold truncate">{t.title}</p>
                            <p className="text-[9px] text-muted-foreground">{t.id} · {t.dept} · {t.time}</p>
                          </div>
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${statusClass[t.status]}`}>{t.status}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Floating notification card */}
                <motion.div
                  initial={{ opacity: 0, y: 12, x: 12 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 }}
                  className="absolute -bottom-6 -left-8 bg-card border border-border rounded-xl shadow-xl p-3 flex items-center gap-2.5 w-52"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold">Complaint Resolved</p>
                    <p className="text-[9px] text-muted-foreground">UC-2026-0118 · Just now</p>
                  </div>
                </motion.div>

                {/* Floating analytics badge */}
                <motion.div
                  initial={{ opacity: 0, y: -12, x: -12 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  transition={{ duration: 0.5, delay: 1.0 }}
                  className="absolute -top-4 -right-6 bg-card border border-border rounded-xl shadow-xl p-3 flex items-center gap-2.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold">Resolution Rate</p>
                    <p className="text-[11px] font-bold text-primary">67.7%</p>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────── */}
      <section className="border-y border-border/60 bg-muted/20">
        <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.08} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <p className="text-3xl font-extrabold tracking-tight">{s.value}</p>
              </div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── FEATURES ─────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <SectionBadge label="Features" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Everything you need, nothing you don't
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              From first submission to final resolution — UniCore handles the full lifecycle so your team can focus on solving problems, not managing paperwork.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={Math.floor(i / 3) * 0.08 + (i % 3) * 0.06}>
                <div className={`group h-full rounded-xl border ${f.border} bg-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}>
                  <div className={`w-11 h-11 rounded-xl ${f.bg} border ${f.border} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                    <f.icon className={`w-5 h-5 ${f.color}`} />
                  </div>
                  <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="how" className="py-28 px-6 bg-muted/15 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <SectionBadge label="How It Works" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Four steps from issue to resolution
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Simple enough for first-time users. Powerful enough for institutions handling hundreds of complaints a month.
            </p>
          </FadeIn>

          {/* Steps timeline */}
          <div className="relative">
            {/* Connecting line */}
            <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
              {steps.map((s, i) => (
                <FadeIn key={s.step} delay={i * 0.1}>
                  <div className="relative flex flex-col items-center text-center group">
                    {/* Number node */}
                    <div className="relative mb-5">
                      <div className="w-20 h-20 rounded-2xl border-2 border-border bg-card flex items-center justify-center group-hover:border-primary/40 group-hover:shadow-md transition-all duration-300"
                        style={{ boxShadow: `0 0 0 0px ${s.accent}22` }}>
                        <s.icon className="w-8 h-8" style={{ color: s.accent }} />
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center">
                        <span className="text-[9px] font-black text-muted-foreground">{s.step}</span>
                      </div>
                    </div>
                    <h3 className="font-semibold mb-2 text-sm">{s.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          {/* Role cards below steps */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((r, i) => (
              <FadeIn key={r.role} delay={i * 0.1}>
                <div className={`relative rounded-2xl border bg-card p-7 h-full overflow-hidden transition-shadow hover:shadow-xl ${r.featured ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
                  {r.featured && (
                    <div className="absolute top-4 right-4">
                      <Badge className="text-[10px] bg-primary text-primary-foreground">Most Used</Badge>
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center mb-5 shadow-md`}>
                    <r.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-4">{r.role}</h3>
                  <ul className="space-y-2.5">
                    {r.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  {/* Gradient orb */}
                  <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${r.gradient} opacity-10 blur-2xl`} />
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── ANALYTICS PREVIEW ────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="analytics" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left copy */}
            <FadeIn direction="left">
              <SectionBadge label="Analytics Dashboard" />
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
                Insights that drive better outcomes
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Admins and staff get a rich analytics dashboard with resolution rates, monthly trends, department breakdown, and time-to-resolve metrics — all in real-time.
              </p>
              <ul className="space-y-4">
                {[
                  { icon: TrendingUp,   text: "6-month area chart with submitted vs resolved trend",    color: "text-primary" },
                  { icon: PieChartIcon, text: "Donut chart for open vs resolved with status breakdown", color: "text-violet-500" },
                  { icon: BarChart3,    text: "Department volume bar chart, sorted by load",            color: "text-emerald-500" },
                  { icon: Clock,        text: "Resolution time buckets — < 1 day to > 2 weeks",        color: "text-orange-500" },
                  { icon: AlertCircle,  text: "Priority radial chart with per-level summaries",        color: "text-rose-500" },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <item.icon className={`w-4 h-4 ${item.color} shrink-0 mt-0.5`} />
                    {item.text}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button asChild>
                  <Link href="/login">
                    View live demo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </FadeIn>

            {/* Right — charts preview */}
            <FadeIn direction="right" delay={0.15}>
              <div className="space-y-4">
                {/* Monthly trend */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      Monthly Complaints
                    </p>
                    <Badge variant="outline" className="text-[10px]">Last 6 months</Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#6366f1" fill="url(#gradS)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="resolved"  name="Resolved"  stroke="#10b981" fill="url(#gradR)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Bottom row: donut + dept bar */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Status donut */}
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-violet-500" />
                      Status Split
                    </p>
                    <div className="flex items-center gap-3">
                      <PieChart width={80} height={80}>
                        <Pie data={statusData} cx={40} cy={40} innerRadius={22} outerRadius={38} paddingAngle={3} dataKey="value">
                          {statusData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                        </Pie>
                      </PieChart>
                      <div className="space-y-1">
                        {statusData.map((s) => (
                          <div key={s.name} className="flex items-center gap-1.5 text-[10px]">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.fill }} />
                            <span className="text-muted-foreground">{s.name}</span>
                            <span className="font-bold">{s.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Dept bar */}
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-orange-500" />
                      By Department
                    </p>
                    <ResponsiveContainer width="100%" height={80}>
                      <BarChart data={deptData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="dept" tick={{ fontSize: 9 }} width={36} axisLine={false} tickLine={false} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {deptData.map((_, i) => (
                            <Cell key={i} fill={["#6366f1","#f59e0b","#10b981","#f97316","#8b5cf6"][i]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* KPI strip */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Resolution Rate", value: "67.7%", icon: CheckCheck,  color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
                    { label: "Avg. Time",        value: "2.4d",  icon: Clock,       color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/50" },
                    { label: "Open Tickets",     value: "23",    icon: FileText,    color: "text-orange-500",  bg: "bg-orange-50 dark:bg-orange-950/50" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-lg border border-border bg-card p-3 text-center">
                      <div className={`w-7 h-7 rounded-md ${kpi.bg} flex items-center justify-center mx-auto mb-1.5`}>
                        <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                      </div>
                      <p className="text-sm font-bold">{kpi.value}</p>
                      <p className="text-[9px] text-muted-foreground">{kpi.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── TESTIMONIALS ─────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="testimonials" className="py-28 px-6 bg-muted/15 border-y border-border overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <SectionBadge label="Testimonials" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Trusted by students, staff & administrators
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Hear from the people who use UniCore every day — students who need answers, staff who need efficiency, and admins who need oversight.
            </p>
          </FadeIn>

          {/* Grid of testimonial cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <FadeIn key={t.name} delay={Math.floor(i / 3) * 0.1 + (i % 3) * 0.08}>
                <div className="group relative h-full rounded-xl border border-border bg-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                  {/* Quote icon */}
                  <Quote className="w-8 h-8 text-border mb-4 group-hover:text-primary/20 transition-colors" />

                  {/* Stars */}
                  <Stars />

                  {/* Text */}
                  <p className="text-sm text-muted-foreground leading-relaxed mt-3 mb-5">"{t.text}"</p>

                  {/* Author */}
                  <div className="flex items-center gap-3 mt-auto">
                    <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">{t.role}</p>
                    </div>
                  </div>

                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-xl ring-1 ring-primary/0 group-hover:ring-primary/20 transition-all duration-200 pointer-events-none" />
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Social proof strip */}
          <FadeIn className="mt-14">
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {["AN","JO","PM","EA","SO","YB"].map((av, i) => (
                    <div key={av} className={`w-9 h-9 rounded-full border-2 border-background flex items-center justify-center text-xs font-bold text-white
                      ${["bg-blue-600","bg-purple-600","bg-green-600","bg-orange-600","bg-teal-600","bg-rose-600"][i]}`}>
                      {av}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold">Join hundreds of universities</p>
                  <p className="text-xs text-muted-foreground">Improving student experience with UniCore</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Stars />
                <span className="text-sm font-bold ml-1">5.0</span>
                <span className="text-sm text-muted-foreground">· 200+ reviews</span>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-violet-500/6" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-primary/8 blur-3xl" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <FadeIn>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Ready to bring order to campus?
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Join students and administrators already using UniCore to handle complaints faster, with full transparency and accountability built in.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
              <Button size="lg" className="h-12 px-10 font-semibold shadow-lg" asChild>
                <Link href="/register">
                  Create Free Account
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-10" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Demo accounts ready to use — try as staff or student
            </p>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span>staff@university.edu / staff123</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>student@university.edu / student123</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── FOOTER ───────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-border bg-muted/10">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                  <Shield className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-base tracking-tight">UniCore</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                The modern complaint management platform built for universities. Transparent, fast, and accountable.
              </p>
              <div className="flex items-center gap-2">
                {[Twitter, Github, Linkedin, Mail].map((Icon, i) => (
                  <button key={i} className="w-8 h-8 rounded-lg bg-muted hover:bg-accent transition-colors flex items-center justify-center">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Product</p>
              <ul className="space-y-2.5">
                {[["Features","#features"],["How It Works","#how"],["Analytics","#analytics"],["Pricing","#"],["Changelog","#"]].map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Roles */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">For Roles</p>
              <ul className="space-y-2.5">
                {[
                  ["Student Portal","#"],["Staff Dashboard","#"],["Admin Console","#"],
                  ["Analytics Access","#analytics"],["Department Routing","#features"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal + Demo */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Resources</p>
              <ul className="space-y-2.5">
                {[
                  ["Sign In",        "/login"],
                  ["Register",       "/register"],
                  ["Privacy Policy", "#"],
                  ["Terms of Use",   "#"],
                  ["Contact Us",     "#"],
                ].map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("/") ? (
                      <Link href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</Link>
                    ) : (
                      <a href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator />

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} UniCore. University Complaint Management System. All rights reserved.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
