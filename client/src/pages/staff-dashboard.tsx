import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch, apiRequest } from "@/lib/api";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Users, ClipboardList, Clock, TrendingUp, AlertCircle, Bell,
  CheckCircle2, MessageSquare, Paperclip, ChevronRight, Search,
  X, Lock, Send, Download, FolderOpen, Eye, Activity,
  ArrowRight, Calendar, Building2, Tag, Loader2, RefreshCw,
} from "lucide-react";
import {
  cn, statusColors, statusLabels, priorityColors, priorityLabels,
  categoryLabels, formatDateTime, timeAgo, getInitials,
} from "@/lib/utils";
import { NotificationPanel } from "@/components/notification-panel";
import type { ComplaintWithDetails, Attachment } from "@shared/schema";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface DashboardStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
  urgent: number;
  recentComplaints: ComplaintWithDetails[];
  resolutionRate?: number;
}

/* ─── Priority dot ───────────────────────────────────────────────────── */
const PRIORITY_DOT: Record<string, string> = {
  low: "bg-gray-400", medium: "bg-blue-500", high: "bg-orange-500", urgent: "bg-red-500",
};

/* ─── Status flow ────────────────────────────────────────────────────── */
const STATUS_FLOW = ["pending", "assigned", "in_progress", "resolved", "closed"] as const;

/* ─── Filter tabs ────────────────────────────────────────────────────── */
const TABS = [
  { key: "all",         label: "All",          icon: ClipboardList },
  { key: "my_queue",    label: "My Queue",      icon: Users },
  { key: "pending",     label: "Pending",       icon: Clock },
  { key: "assigned",    label: "Assigned",      icon: Activity },
  { key: "in_progress", label: "In Progress",   icon: TrendingUp },
  { key: "resolved",    label: "Resolved",      icon: CheckCircle2 },
] as const;
type TabKey = typeof TABS[number]["key"];

/* ─── Attachment mini-list ───────────────────────────────────────────── */
function AttachmentList({ complaintId }: { complaintId: string }) {
  const { data: files, isLoading } = useQuery<Attachment[]>({
    queryKey: ["/api/complaints", complaintId, "attachments"],
    queryFn: () => authFetch(`/api/complaints/${complaintId}/attachments`),
  });

  if (isLoading) return <div className="py-2 text-xs text-muted-foreground">Loading files…</div>;
  if (!files || files.length === 0) return <div className="py-2 text-xs text-muted-foreground">No attachments.</div>;

  const isImage = (name: string) =>
    [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes("." + name.split(".").pop()!.toLowerCase());

  return (
    <div className="space-y-1.5 pt-1">
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-2.5 p-2 bg-muted rounded-md" data-testid={`attachment-mini-${f.id}`}>
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium flex-1 truncate">{f.originalName}</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`}
          </span>
          <div className="flex gap-1">
            {isImage(f.originalName) && (
              <a
                href={`/api/attachments/${f.id}/view`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Preview"
                onClick={(e) => e.stopPropagation()}
              >
                <Eye className="w-3.5 h-3.5" />
              </a>
            )}
            <a
              href={`/api/attachments/${f.id}/download`}
              download={f.originalName}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Download"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Staff complaint card ───────────────────────────────────────────── */
function StaffComplaintCard({ complaint, index }: { complaint: ComplaintWithDetails; index: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [replyOpen, setReplyOpen] = useState(false);
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [remarkText, setRemarkText] = useState("");

  /* Status update */
  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/complaints/${complaint.id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/complaints"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  /* Public reply */
  const replyMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/complaints/${complaint.id}/comments`, { content: replyText, isInternal: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/complaints", complaint.id] });
      setReplyText("");
      setReplyOpen(false);
      toast({ title: "Reply sent to student" });
    },
    onError: (e: Error) => toast({ title: "Reply failed", description: e.message, variant: "destructive" }),
  });

  /* Internal remark */
  const remarkMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/complaints/${complaint.id}/comments`, { content: remarkText, isInternal: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/complaints", complaint.id] });
      setRemarkText("");
      setRemarkOpen(false);
      toast({ title: "Internal remark saved" });
    },
    onError: (e: Error) => toast({ title: "Remark failed", description: e.message, variant: "destructive" }),
  });

  const isUrgent = complaint.priority === "urgent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.04 }}
      className={cn(
        "rounded-xl border bg-card transition-shadow hover:shadow-md",
        isUrgent ? "border-red-300 dark:border-red-800" : "border-card-border"
      )}
      data-testid={`card-complaint-${complaint.id}`}
    >
      <div className="p-5">

        {/* ── Top: ticket + badges + urgent marker ─────────────────── */}
        <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-muted text-muted-foreground tracking-wide">
              {complaint.ticketId}
            </span>
            <Badge className={cn("text-xs font-semibold rounded-full", statusColors[complaint.status])}>
              {statusLabels[complaint.status]}
            </Badge>
            <Badge className={cn("text-xs gap-1.5", priorityColors[complaint.priority])}>
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_DOT[complaint.priority])} />
              {priorityLabels[complaint.priority]}
            </Badge>
            {isUrgent && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide animate-pulse">
                <AlertCircle className="w-3 h-3" /> Urgent
              </span>
            )}
          </div>

          {/* View detail button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-primary shrink-0"
            onClick={() => setLocation(`/complaints/${complaint.id}`)}
            data-testid={`button-view-${complaint.id}`}
          >
            View details <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {/* ── Student info ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="w-6 h-6 shrink-0">
            <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-bold">
              {getInitials(complaint.student?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{complaint.student?.name ?? "Unknown student"}</span>
            {complaint.student?.email ? ` · ${complaint.student.email}` : ""}
          </span>
        </div>

        {/* ── Title & description ──────────────────────────────────── */}
        <h3
          className="font-semibold text-sm leading-snug mb-1.5 cursor-pointer hover:text-primary transition-colors"
          onClick={() => setLocation(`/complaints/${complaint.id}`)}
        >
          {complaint.title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
          {complaint.description}
        </p>

        {/* ── Meta grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 opacity-60 shrink-0" />
            {complaint.department?.name ?? "Dept: unassigned"}
          </div>
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 opacity-60 shrink-0" />
            {categoryLabels[complaint.category] ?? complaint.category}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 opacity-60 shrink-0" />
            {formatDateTime(complaint.createdAt)}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 opacity-60 shrink-0" />
            Updated {timeAgo(complaint.updatedAt ?? complaint.createdAt)}
          </div>
          {complaint.assignedStaff && (complaint as any).assignedAt && (
            <div className="col-span-2 flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <Activity className="w-3.5 h-3.5 opacity-70 shrink-0" />
              Assigned {timeAgo((complaint as any).assignedAt)}
              {complaint.staff?.name ? ` to ${complaint.staff.name}` : ""}
            </div>
          )}
        </div>

        <Separator className="mb-3" />

        {/* ── Quick action bar ────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Status selector */}
          <Select
            value={complaint.status}
            onValueChange={(v) => statusMutation.mutate(v)}
            disabled={statusMutation.isPending}
          >
            <SelectTrigger
              className="h-8 text-xs w-36 gap-1"
              data-testid={`select-status-${complaint.id}`}
            >
              {statusMutation.isPending
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3 text-muted-foreground" />
              }
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FLOW.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{statusLabels[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reply to student */}
          <Button
            size="sm"
            variant={replyOpen ? "default" : "outline"}
            className="h-8 text-xs gap-1.5"
            onClick={() => { setReplyOpen((o) => !o); setRemarkOpen(false); setAttachOpen(false); }}
            data-testid={`button-reply-${complaint.id}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Reply
          </Button>

          {/* Internal remark */}
          <Button
            size="sm"
            variant={remarkOpen ? "secondary" : "outline"}
            className="h-8 text-xs gap-1.5"
            onClick={() => { setRemarkOpen((o) => !o); setReplyOpen(false); setAttachOpen(false); }}
            data-testid={`button-remark-${complaint.id}`}
          >
            <Lock className="w-3.5 h-3.5" />
            Remark
          </Button>

          {/* Attachments */}
          <Button
            size="sm"
            variant={attachOpen ? "secondary" : "outline"}
            className="h-8 text-xs gap-1.5"
            onClick={() => { setAttachOpen((o) => !o); setReplyOpen(false); setRemarkOpen(false); }}
            data-testid={`button-attachments-${complaint.id}`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            Files
            {(complaint._count?.attachments ?? 0) > 0 && (
              <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {complaint._count?.attachments}
              </span>
            )}
          </Button>

          {/* Comment count badge */}
          {(complaint._count?.comments ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <MessageSquare className="w-3.5 h-3.5" />
              {complaint._count?.comments}
            </div>
          )}
        </div>

        {/* ── Reply panel ─────────────────────────────────────────── */}
        <AnimatePresence>
          {replyOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Reply to Student</p>
                  <span className="text-[10px] text-blue-500 ml-auto">Visible to student</span>
                </div>
                <Textarea
                  placeholder="Type your reply to the student…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  className="text-xs resize-none border-blue-200 dark:border-blue-700"
                  data-testid={`input-reply-${complaint.id}`}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setReplyOpen(false); setReplyText(""); }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!replyText.trim() || replyMutation.isPending}
                    onClick={() => replyMutation.mutate()}
                    data-testid={`button-send-reply-${complaint.id}`}
                  >
                    {replyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                    Send Reply
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Internal remark panel ───────────────────────────────── */}
        <AnimatePresence>
          {remarkOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">Internal Remark</p>
                  <span className="text-[10px] text-yellow-500 ml-auto">Staff only · not visible to student</span>
                </div>
                <Textarea
                  placeholder="Add an internal note (only visible to staff and admin)…"
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  rows={3}
                  className="text-xs resize-none border-yellow-200 dark:border-yellow-700"
                  data-testid={`input-remark-${complaint.id}`}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRemarkOpen(false); setRemarkText(""); }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    disabled={!remarkText.trim() || remarkMutation.isPending}
                    onClick={() => remarkMutation.mutate()}
                    data-testid={`button-save-remark-${complaint.id}`}
                  >
                    {remarkMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3 mr-1" />}
                    Save Remark
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Attachment list ──────────────────────────────────────── */}
        <AnimatePresence>
          {attachOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                    Attachments
                  </p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" asChild>
                    <Link href={`/complaints/${complaint.id}`}>Manage in detail →</Link>
                  </Button>
                </div>
                <AttachmentList complaintId={complaint.id} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status accent bar */}
      <div className={cn(
        "h-0.5 rounded-b-xl",
        complaint.status === "pending"     ? "bg-blue-400"
        : complaint.status === "assigned"  ? "bg-yellow-400"
        : complaint.status === "in_progress" ? "bg-purple-500"
        : complaint.status === "resolved"  ? "bg-green-500"
        : "bg-gray-300 dark:bg-gray-600"
      )} />
    </motion.div>
  );
}

/* ─── Skeleton card ──────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-card-border bg-card p-5 space-y-3">
      <div className="flex gap-2"><Skeleton className="h-6 w-28" /><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-16" /></div>
      <div className="flex items-center gap-2"><Skeleton className="w-6 h-6 rounded-full" /><Skeleton className="h-3 w-40" /></div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-3" /><Skeleton className="h-3" /><Skeleton className="h-3" /><Skeleton className="h-3" /></div>
      <Separator />
      <div className="flex gap-2"><Skeleton className="h-8 w-36" /><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-20" /></div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────── */
export default function StaffDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");

  /* Dashboard stats */
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: () => authFetch("/api/dashboard/stats"),
    enabled: !!user,
  });

  /* Full complaint list — "my_queue" filters to this staff member's assignments */
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (activeTab === "my_queue") {
    if (user?.id) params.set("assignedStaff", user.id);
  } else if (activeTab !== "all") {
    params.set("status", activeTab);
  }

  const { data: complaints, isLoading: complaintsLoading, isError, error, refetch } = useQuery<ComplaintWithDetails[]>({
    queryKey: ["/api/complaints", search, activeTab, user?.id],
    queryFn: () => authFetch(`/api/complaints?${params.toString()}`),
    enabled: !!user,
  });

  const tabCount = (tab: TabKey): number => {
    if (!stats) return 0;
    if (tab === "all")         return stats.total;
    if (tab === "my_queue")    return complaints?.length ?? 0;
    if (tab === "pending")     return stats.pending;
    if (tab === "assigned")    return stats.assigned;
    if (tab === "in_progress") return stats.inProgress;
    if (tab === "resolved")    return stats.resolved;
    return 0;
  };

  const hasFilters = search || activeTab !== "all";

  if (isError) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium">Failed to load data</p>
      <p className="text-xs">{(error as Error)?.message}</p>
      <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* ── Welcome banner ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-purple-500/12 via-purple-500/6 to-transparent border border-purple-500/20 p-6"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Staff Portal</p>
                <h1 className="text-2xl font-bold mt-0.5" data-testid="text-welcome-name">{user?.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {stats
                    ? `${stats.inProgress ?? 0} in progress · ${stats.urgent ?? 0} urgent · ${stats.pending ?? 0} pending review`
                    : user?.department ?? "Staff Member"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" asChild>
                <Link href="/notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Stats strip ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading
            ? [...Array(4)].map((_, i) => (
                <Card key={i} className="border-card-border">
                  <CardContent className="p-5"><Skeleton className="h-4 w-20 mb-3" /><Skeleton className="h-8 w-12" /></CardContent>
                </Card>
              ))
            : [
                { label: "Total",       value: stats?.total ?? 0,      icon: ClipboardList, bg: "bg-primary/10",                       color: "text-primary",                         tab: "all"         },
                { label: "In Progress", value: stats?.inProgress ?? 0, icon: TrendingUp,    bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600 dark:text-purple-400", tab: "in_progress" },
                { label: "Urgent",      value: stats?.urgent ?? 0,     icon: AlertCircle,   bg: "bg-red-100 dark:bg-red-900/30",       color: "text-red-600 dark:text-red-400",       tab: "all"         },
                { label: "Resolved",    value: stats?.resolved ?? 0,   icon: CheckCircle2,  bg: "bg-green-100 dark:bg-green-900/30",   color: "text-green-600 dark:text-green-400",   tab: "resolved"    },
              ].map((s, i) => (
                <motion.button
                  key={s.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={() => setActiveTab(s.tab as TabKey)}
                  className={cn(
                    "text-left rounded-xl border p-5 transition-all duration-200 hover:shadow-md",
                    activeTab === s.tab
                      ? "border-primary/60 bg-primary/5 shadow-sm"
                      : "border-card-border bg-card hover:border-primary/30"
                  )}
                  data-testid={`stat-card-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
                      <p className="text-3xl font-bold">{s.value}</p>
                    </div>
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                      <s.icon className={cn("w-4.5 h-4.5", s.color)} />
                    </div>
                  </div>
                </motion.button>
              ))
          }
        </div>

        {/* ── Main layout ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">

          {/* ── Complaint work queue ─────────────────────────────────── */}
          <div className="xl:col-span-3 space-y-4">

            {/* Header + search */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-base font-semibold">Complaint Queue</h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets or keywords…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                  data-testid="input-search"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {TABS.map((tab) => {
                const isMyQueue = tab.key === "my_queue";
                const count = isMyQueue && activeTab !== "my_queue" ? null : tabCount(tab.key);
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    data-testid={`tab-${tab.key}`}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                      activeTab === tab.key
                        ? isMyQueue
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-purple-600 text-white shadow-sm"
                        : isMyQueue
                        ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                        : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {count !== null && count > 0 && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                        activeTab === tab.key ? "bg-white/20 text-white" : "bg-background text-foreground"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}

              {hasFilters && (
                <button
                  onClick={() => { setActiveTab("all"); setSearch(""); }}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto"
                  data-testid="button-clear-filters"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {/* Card list */}
            <AnimatePresence mode="wait">
              {complaintsLoading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
                </motion.div>
              ) : complaints && complaints.length > 0 ? (
                <motion.div
                  key={`${activeTab}-${search}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <p className="text-xs text-muted-foreground">
                    {complaints.length} complaint{complaints.length !== 1 ? "s" : ""}
                    {activeTab !== "all" ? ` · ${statusLabels[activeTab as keyof typeof statusLabels] ?? activeTab}` : ""}
                    {search ? ` · matching "${search}"` : ""}
                  </p>
                  {complaints.map((c, i) => (
                    <StaffComplaintCard key={c.id} complaint={c} index={i} />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-card-border bg-card p-16 text-center"
                >
                  <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="font-semibold">
                    {hasFilters ? "No matching complaints" : "Queue is empty"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1.5 mb-5">
                    {hasFilters ? "Try a different filter or search term." : "No complaints to action at the moment."}
                  </p>
                  {hasFilters && (
                    <Button variant="outline" size="sm" onClick={() => { setActiveTab("all"); setSearch(""); }}>
                      Clear filters
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Workload summary */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="border-card-border">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Workload</p>
                  {statsLoading ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                  ) : (
                    <div className="space-y-2">
                      {[
                        { label: "Pending",     value: stats?.pending ?? 0,    color: "bg-blue-500" },
                        { label: "In Progress", value: stats?.inProgress ?? 0, color: "bg-purple-500" },
                        { label: "Urgent",      value: stats?.urgent ?? 0,     color: "bg-red-500" },
                        { label: "Resolved",    value: stats?.resolved ?? 0,   color: "bg-green-500" },
                      ].map((w) => {
                        const total = stats?.total || 1;
                        const pct = Math.round((w.value / total) * 100);
                        return (
                          <div key={w.label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{w.label}</span>
                              <span className="font-semibold">{w.value}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.7, delay: 0.3 }}
                                className={cn("h-full rounded-full", w.color)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Resolution rate */}
            {!statsLoading && stats?.resolutionRate !== undefined && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border-card-border">
                  <CardContent className="p-5 text-center">
                    <div className="relative w-24 h-24 mx-auto mb-3">
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" className="text-muted" strokeWidth="2" />
                        <motion.circle
                          cx="18" cy="18" r="15.9" fill="none"
                          stroke="currentColor" className="text-green-500"
                          strokeWidth="2.5" strokeLinecap="round"
                          strokeDasharray="0 100"
                          animate={{ strokeDasharray: `${stats.resolutionRate} ${100 - stats.resolutionRate}` }}
                          transition={{ duration: 1, delay: 0.4 }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold">{stats.resolutionRate}%</span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold">Resolution Rate</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {stats.resolved} of {stats.total} resolved
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Quick links */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="border-card-border">
                <CardContent className="p-4">
                  <div className="mb-3">
                    <Link href="/complaints">
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted hover:bg-muted/70 text-xs font-medium cursor-pointer transition-colors">
                        <ClipboardList className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="flex-1">All Complaints</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </Link>
                  </div>
                  <Separator className="mb-3" />
                  <NotificationPanel limit={5} />
                </CardContent>
              </Card>
            </motion.div>

            {/* Tips */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-4">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">Staff Tips</p>
                <ul className="space-y-1.5">
                  {[
                    "Use the status dropdown to update without opening detail",
                    "Remarks are internal — students won't see them",
                    "Reply opens a public thread visible to the student",
                    "Click 'Files' to preview or download attachments inline",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-1.5 text-[11px] text-purple-600 dark:text-purple-400">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-purple-400 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
