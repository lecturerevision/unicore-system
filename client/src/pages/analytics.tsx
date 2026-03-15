import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadialBarChart, RadialBar, LabelList,
} from "recharts";
import {
  BarChart3, TrendingUp, PieChartIcon, CheckCircle2, Clock,
  AlertCircle, FileText, Zap, CalendarDays, Building2,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { cn, categoryLabels, statusLabels, priorityLabels } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface AnalyticsData {
  totalComplaints:    number;
  resolvedComplaints: number;
  pendingComplaints:  number;
  resolutionRate:     number;
  avgResolutionDays:  number;
  byStatus:          { status: string; count: number }[];
  byCategory:        { category: string; count: number }[];
  byDepartment:      { department: string; count: number }[];
  byMonth:           { month: string; submitted: number; resolved: number }[];
  byResolutionTime:  { label: string; count: number }[];
  openVsResolved:    { name: string; value: number }[];
  byPriority:        { priority: string; count: number }[];
}

/* ─── Palette ────────────────────────────────────────────────────────── */
const DEPT_COLORS  = ["#6366f1","#f59e0b","#10b981","#3b82f6","#ec4899","#f97316","#8b5cf6","#14b8a6"];
const CAT_COLORS   = ["#6366f1","#f59e0b","#10b981","#3b82f6","#ec4899","#f97316","#8b5cf6","#14b8a6","#ef4444","#84cc16"];
const PRIO_COLORS  = { low: "#10b981", medium: "#3b82f6", high: "#f59e0b", urgent: "#ef4444" };
const OPEN_COLORS  = ["#f59e0b","#10b981"];
const RESOL_COLORS = ["#a5b4fc","#818cf8","#6366f1","#4f46e5","#3730a3"];

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
};

/* ─── Chart wrappers ─────────────────────────────────────────────────── */
function ChartCard({
  title, description, icon: Icon, children, className, badge,
}: {
  title: string; description?: string; icon: any;
  children: React.ReactNode; className?: string; badge?: string;
}) {
  return (
    <Card className={cn("border-card-border overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
            </div>
          </div>
          {badge && <Badge variant="outline" className="text-[10px] shrink-0">{badge}</Badge>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ─── KPI card ───────────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon: Icon, bg, color, trend,
}: {
  label: string; value: string | number; sub?: string;
  icon: any; bg: string; color: string;
  trend?: "up" | "down" | "neutral";
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-card-border hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
              <p className="text-3xl font-bold">{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bg)}>
                <Icon className={cn("w-4.5 h-4.5", color)} />
              </div>
              {trend && (
                <div className={cn("flex items-center gap-0.5 text-xs font-medium", trendColor)}>
                  <TrendIcon className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Custom axis tick ───────────────────────────────────────────────── */
function SkeletonChart({ height = 260 }: { height?: number }) {
  return (
    <div className="space-y-2" style={{ height }}>
      <div className="flex items-end gap-2 h-full">
        {[...Array(8)].map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Custom tooltip ─────────────────────────────────────────────────── */
function CustomTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="p-3">
      {label && <p className="text-xs font-semibold mb-1.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Resolution time color ──────────────────────────────────────────── */
function ResolTimeFill(props: any) {
  const { x, y, width, height, index } = props;
  return <rect x={x} y={y} width={width} height={height} fill={RESOL_COLORS[index % RESOL_COLORS.length]} rx={4} ry={4} />;
}

/* ─── Main page ──────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const { user } = useAuth();

  const { data, isLoading, isError, error, refetch } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    queryFn: () => authFetch("/api/analytics"),
    enabled: !!user && (user.role === "admin" || user.role === "staff"),
  });

  if (user?.role === "student") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-1">Analytics are available to staff and administrators.</p>
        </div>
      </div>
    );
  }

  if (isError) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium">Failed to load data</p>
      <p className="text-xs">{(error as Error)?.message}</p>
      <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
    </div>
  );

  /* Derived series for the open/resolved area chart */
  const monthlyWithOpen = (data?.byMonth ?? []).map((m) => ({
    ...m,
    open: Math.max(0, m.submitted - m.resolved),
  }));

  /* Biggest department for annotation */
  const topDept = [...(data?.byDepartment ?? [])].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* ── Header ───────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-primary" />
                Analytics Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                System-wide complaint management performance metrics
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Zap className="w-3 h-3 mr-1 text-yellow-500" />
                Live data
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* ── KPI cards ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-card-border">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-20 mb-3" />
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
          >
            {[
              { label: "Total",          value: data.totalComplaints,                      sub: "all time",                    icon: FileText,    bg: "bg-primary/10",                       color: "text-primary",                              trend: undefined },
              { label: "Resolved",       value: data.resolvedComplaints,                   sub: `${data.resolutionRate}% rate`, icon: CheckCircle2,bg: "bg-green-100 dark:bg-green-900/30",   color: "text-green-600 dark:text-green-400",        trend: "up"       },
              { label: "Open",           value: data.pendingComplaints,                    sub: "needs action",                icon: AlertCircle, bg: "bg-orange-100 dark:bg-orange-900/30", color: "text-orange-600 dark:text-orange-400",      trend: data.pendingComplaints > data.resolvedComplaints ? "up" : "down" },
              { label: "Resolution Rate",value: `${data.resolutionRate}%`,                 sub: "resolved / total",            icon: TrendingUp,  bg: "bg-blue-100 dark:bg-blue-900/30",     color: "text-blue-600 dark:text-blue-400",          trend: data.resolutionRate > 50 ? "up" : "down" },
              { label: "Avg. Time",      value: `${data.avgResolutionDays}d`,              sub: "to resolve",                  icon: Clock,       bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600 dark:text-purple-400",      trend: data.avgResolutionDays <= 3 ? "up" : "down" },
              { label: "Departments",    value: data.byDepartment.length,                  sub: topDept ? `top: ${topDept.department}` : "active", icon: Building2, bg: "bg-teal-100 dark:bg-teal-900/30", color: "text-teal-600 dark:text-teal-400", trend: undefined },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
                <KpiCard {...kpi as any} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Chart 1 + 2: Monthly & Open vs Resolved ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Chart 1: Monthly Complaints ──────────────────────────── */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <ChartCard
              title="Monthly Complaints"
              description="Complaints submitted vs resolved over the last 6 months"
              icon={CalendarDays}
              badge="Last 6 months"
            >
              {isLoading ? <SkeletonChart /> : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={monthlyWithOpen} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradSub" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradRes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradOpen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltipContent />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="submitted"
                        name="Submitted"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#gradSub)"
                        dot={{ r: 3, fill: "#6366f1" }}
                        activeDot={{ r: 5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="resolved"
                        name="Resolved"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#gradRes)"
                        dot={{ r: 3, fill: "#10b981" }}
                        activeDot={{ r: 5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="open"
                        name="Still Open"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        fill="url(#gradOpen)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Month summary table */}
                  {data && (
                    <div className="mt-4 border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted">
                            <th className="text-left px-3 py-2 text-muted-foreground font-medium">Month</th>
                            <th className="text-right px-3 py-2 text-muted-foreground font-medium">Submitted</th>
                            <th className="text-right px-3 py-2 text-muted-foreground font-medium">Resolved</th>
                            <th className="text-right px-3 py-2 text-muted-foreground font-medium">Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.byMonth.map((m, i) => {
                            const rate = m.submitted > 0 ? Math.round((m.resolved / m.submitted) * 100) : 0;
                            return (
                              <tr key={i} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                                <td className="px-3 py-2 font-medium">{m.month}</td>
                                <td className="px-3 py-2 text-right">{m.submitted}</td>
                                <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{m.resolved}</td>
                                <td className="px-3 py-2 text-right">
                                  <span className={cn(
                                    "font-semibold",
                                    rate >= 70 ? "text-green-600 dark:text-green-400"
                                    : rate >= 40 ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-red-500"
                                  )}>
                                    {rate}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </ChartCard>
          </motion.div>

          {/* ── Chart 2: Open vs Resolved ────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ChartCard
              title="Open vs Resolved"
              description="Current complaint distribution by completion status"
              icon={PieChartIcon}
            >
              {isLoading ? <SkeletonChart height={180} /> : data && (
                <>
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={data.openVsResolved}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {data.openVsResolved.map((_, i) => (
                          <Cell key={i} fill={OPEN_COLORS[i]} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Legend + percentages */}
                  <div className="space-y-2.5 mt-1">
                    {data.openVsResolved.map((d, i) => {
                      const total = data.openVsResolved.reduce((s, x) => s + x.value, 0);
                      const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: OPEN_COLORS[i] }} />
                              <span className="font-medium">{d.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{d.value}</span>
                              <span className="text-muted-foreground">({pct}%)</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: 0.3 }}
                              className="h-full rounded-full"
                              style={{ background: OPEN_COLORS[i] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator className="my-4" />

                  {/* Status breakdown within open */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2.5 uppercase tracking-wider">Status Detail</p>
                    <div className="space-y-1.5">
                      {(data.byStatus ?? []).map((s) => (
                        <div key={s.status} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{statusLabels[s.status] ?? s.status}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary/60"
                                style={{ width: `${data.totalComplaints > 0 ? (s.count / data.totalComplaints) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="font-semibold w-4 text-right">{s.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </ChartCard>
          </motion.div>
        </div>

        {/* ── Chart 3 + 4: Department & Resolution Time ────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Chart 3: Complaints per Department ───────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <ChartCard
              title="Complaints per Department"
              description="Total volume routed to each department"
              icon={Building2}
            >
              {isLoading ? <SkeletonChart /> : data && (
                data.byDepartment.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={[...data.byDepartment].sort((a, b) => b.count - a.count)}
                        layout="vertical"
                        margin={{ top: 5, right: 40, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="department"
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          width={100}
                        />
                        <Tooltip content={<CustomTooltipContent />} />
                        <Bar dataKey="count" name="Complaints" radius={[0, 6, 6, 0]}>
                          {data.byDepartment.map((_, i) => (
                            <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                          ))}
                          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 600 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Department legend dots */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {[...data.byDepartment].sort((a, b) => b.count - a.count).map((d, i) => (
                        <div key={d.department} className="flex items-center gap-1 text-[10px]">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                          <span className="text-muted-foreground truncate max-w-[100px]">{d.department}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[260px] flex flex-col items-center justify-center gap-2">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No department data yet</p>
                    <p className="text-xs text-muted-foreground">Assign complaints to departments to see distribution</p>
                  </div>
                )
              )}
            </ChartCard>
          </motion.div>

          {/* ── Chart 4: Resolution Time ──────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <ChartCard
              title="Complaint Resolution Time"
              description="How long it takes to resolve complaints (resolved & closed only)"
              icon={Clock}
              badge={data ? `Avg: ${data.avgResolutionDays}d` : undefined}
            >
              {isLoading ? <SkeletonChart /> : data && (
                <>
                  {data.resolvedComplaints > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={data.byResolutionTime}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip content={<CustomTooltipContent />} />
                          <Bar dataKey="count" name="Complaints" shape={<ResolTimeFill />} radius={[4, 4, 0, 0]}>
                            <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 600 }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Time bucket breakdown */}
                      <div className="mt-4 space-y-2">
                        {data.byResolutionTime.map((b, i) => {
                          const pct = data.resolvedComplaints > 0 ? Math.round((b.count / data.resolvedComplaints) * 100) : 0;
                          return (
                            <div key={b.label}>
                              <div className="flex justify-between text-xs mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: RESOL_COLORS[i] }} />
                                  <span className="text-muted-foreground">{b.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{b.count}</span>
                                  <span className="text-muted-foreground">({pct}%)</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.7, delay: 0.2 + i * 0.06 }}
                                  className="h-full rounded-full"
                                  style={{ background: RESOL_COLORS[i] }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="h-[260px] flex flex-col items-center justify-center gap-2">
                      <Clock className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No resolved complaints yet</p>
                      <p className="text-xs text-muted-foreground">Resolution time data will appear once complaints are resolved</p>
                    </div>
                  )}
                </>
              )}
            </ChartCard>
          </motion.div>
        </div>

        {/* ── Chart 5 + 6: Category & Priority ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Category distribution */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <ChartCard
              title="Complaints by Category"
              description="Volume breakdown across complaint types"
              icon={BarChart3}
            >
              {isLoading ? <SkeletonChart /> : data && (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={[...data.byCategory]
                      .sort((a, b) => b.count - a.count)
                      .map((d) => ({ ...d, name: categoryLabels[d.category] ?? d.category }))}
                    margin={{ top: 10, right: 30, left: -20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      angle={-30}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltipContent />} />
                    <Bar dataKey="count" name="Complaints" radius={[4, 4, 0, 0]}>
                      {data.byCategory.map((_, i) => (
                        <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </motion.div>

          {/* Priority distribution */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <ChartCard
              title="Priority Distribution"
              description="Complaints split by urgency level"
              icon={AlertCircle}
            >
              {isLoading ? <SkeletonChart /> : data && (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="25%"
                      outerRadius="90%"
                      data={data.byPriority.map((p) => ({
                        name: priorityLabels[p.priority] ?? p.priority,
                        value: p.count,
                        fill: (PRIO_COLORS as any)[p.priority] ?? "#6366f1",
                      }))}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "hsl(var(--muted))" }}>
                        <LabelList dataKey="name" position="insideStart" style={{ fontSize: 10, fill: "#fff", fontWeight: 600 }} />
                      </RadialBar>
                      <Tooltip content={<CustomTooltipContent />} />
                    </RadialBarChart>
                  </ResponsiveContainer>

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {data.byPriority.map((p) => {
                      const pct = data.totalComplaints > 0 ? Math.round((p.count / data.totalComplaints) * 100) : 0;
                      return (
                        <div
                          key={p.priority}
                          className="p-3 rounded-lg border border-card-border"
                          style={{ borderLeftColor: (PRIO_COLORS as any)[p.priority], borderLeftWidth: 3 }}
                        >
                          <p className="text-xs text-muted-foreground">{priorityLabels[p.priority] ?? p.priority}</p>
                          <p className="text-xl font-bold">{p.count}</p>
                          <p className="text-[10px] text-muted-foreground">{pct}% of total</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </ChartCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
