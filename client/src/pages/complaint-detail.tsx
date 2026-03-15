import { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch, apiRequest } from "@/lib/api";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Clock, Tag, Building2, User, Paperclip, MessageSquare,
  Send, Lock, FileText, CheckCircle2, AlertCircle, Download, Activity,
  Upload, Trash2, Image, Eye, File, Loader2, X,
} from "lucide-react";
import {
  cn, statusColors, priorityColors, statusLabels, priorityLabels,
  categoryLabels, formatDateTime, timeAgo, getInitials,
} from "@/lib/utils";
import { MAX_COMMENT_LENGTH } from "@/lib/constants";
import type { ComplaintWithDetails, Department, User as UserType, ActivityLog, Attachment } from "@shared/schema";

interface ComplaintDetail extends Omit<ComplaintWithDetails, 'comments' | 'attachments' | 'activityLogs'> {
  comments: Array<{
    id: string;
    content: string;
    isInternal: boolean;
    createdAt: string;
    user: Partial<UserType> | null;
  }>;
  attachments: Attachment[];
  activityLogs: Array<ActivityLog & { user?: Partial<UserType> | null }>;
}

const STATUS_FLOW = ["pending", "assigned", "in_progress", "resolved", "closed"] as const;

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

function getFileIcon(originalName: string, mimeType: string) {
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTENSIONS.has(`.${ext}`) || mimeType.startsWith("image/")) return Image;
  return FileText;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(att: Attachment) {
  const ext = att.originalName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(`.${ext}`) || att.mimeType.startsWith("image/");
}

export default function ComplaintDetailPage() {
  const [, params] = useRoute("/complaints/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: complaint, isLoading } = useQuery<ComplaintDetail>({
    queryKey: ["/api/complaints", params?.id],
    queryFn: () => authFetch(`/api/complaints/${params?.id}`),
    enabled: !!params?.id,
  });

  const { data: departments, isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    queryFn: () => authFetch("/api/departments"),
    enabled: user?.role !== "student",
  });

  const { data: staffList, isLoading: staffLoading } = useQuery<Partial<UserType>[]>({
    queryKey: ["/api/users/staff"],
    queryFn: () => authFetch("/api/users/staff"),
    enabled: user?.role !== "student",
  });

  // ─── Comment mutation ──────────────────────────────────────────────────────
  const commentMutation = useMutation({
    mutationFn: (data: { content: string; isInternal: boolean }) =>
      apiRequest("POST", `/api/complaints/${params?.id}/comments`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/complaints", params?.id] });
      setComment("");
      toast({ title: "Comment added" });
    },
    onError: (err: Error) => toast({ title: "Failed to add comment", description: err.message, variant: "destructive" }),
  });

  // ─── Complaint update mutation ─────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: Partial<{ status: string; priority: string; assignedStaff: string; departmentId: string; resolutionNotes: string }>) =>
      apiRequest("PATCH", `/api/complaints/${params?.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/complaints", params?.id] });
      qc.invalidateQueries({ queryKey: ["/api/complaints"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Complaint updated" });
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  // ─── File upload mutation ──────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const token = localStorage.getItem("unicore_token");
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await fetch(`/api/complaints/${params?.id}/attachments`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data: { message: string }) => {
      qc.invalidateQueries({ queryKey: ["/api/complaints", params?.id] });
      setPendingFiles([]);
      toast({ title: "Files uploaded", description: data.message });
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  // ─── Delete attachment mutation ────────────────────────────────────────────
  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => apiRequest("DELETE", `/api/attachments/${attachmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/complaints", params?.id] });
      toast({ title: "Attachment deleted" });
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  // ─── Loading / not-found states ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Complaint not found</p>
          <Button className="mt-4" onClick={() => setLocation("/complaints")}>Go Back</Button>
        </div>
      </div>
    );
  }

  const canManage = user?.role === "admin" || user?.role === "staff";
  const canUpload = canManage || complaint.studentId === user?.id;

  const actionIcon = (action: string) => {
    if (action.includes("created"))  return "🆕";
    if (action.includes("status"))   return "🔄";
    if (action.includes("assigned")) return "👤";
    if (action.includes("internal")) return "🔒";
    if (action.includes("files"))    return "📎";
    if (action.includes("comment"))  return "💬";
    return "📋";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setPendingFiles((prev) => [...prev, ...newFiles].slice(0, 10));
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setPendingFiles((prev) => [...prev, ...droppedFiles].slice(0, 10));
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/complaints")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground font-medium">{complaint.ticketId}</span>
              <Badge className={cn("text-xs", statusColors[complaint.status])}>
                {statusLabels[complaint.status]}
              </Badge>
              <Badge className={cn("text-xs", priorityColors[complaint.priority])}>
                {priorityLabels[complaint.priority]}
              </Badge>
            </div>
            <h1 className="text-xl font-bold truncate mt-1">{complaint.title}</h1>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">

            {/* Description */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border-card-border">
                <CardContent className="p-5">
                  <h2 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    Description
                  </h2>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {complaint.description}
                  </p>

                  {complaint.resolutionNotes && (
                    <>
                      <Separator className="my-4" />
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Resolution Notes
                        </p>
                        <p className="text-sm text-green-800 dark:text-green-300">{complaint.resolutionNotes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Attachments */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="border-card-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                    Attachments ({complaint.attachments?.length ?? 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">

                  {/* Existing attachment list */}
                  {complaint.attachments && complaint.attachments.length > 0 ? (
                    <div className="space-y-2">
                      {complaint.attachments.map((att) => {
                        const Icon = getFileIcon(att.originalName, att.mimeType);
                        const isImg = isImageFile(att);
                        const canDelete = canManage || att.uploadedById === user?.id;

                        return (
                          <div
                            key={att.id}
                            className="flex items-center gap-3 p-2.5 bg-muted rounded-md group"
                            data-testid={`attachment-${att.id}`}
                          >
                            <Icon className={cn("w-4 h-4 shrink-0", isImg ? "text-blue-500" : "text-muted-foreground")} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{att.originalName}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isImg && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" asChild title="View image">
                                  <a href={`/api/attachments/${att.id}/view`} target="_blank" rel="noreferrer" data-testid={`button-view-${att.id}`}>
                                    <Eye className="w-3.5 h-3.5" />
                                  </a>
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-7 w-7" asChild title="Download">
                                <a href={`/api/attachments/${att.id}/download`} download={att.originalName} data-testid={`button-download-${att.id}`}>
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </Button>
                              {canDelete && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  title="Delete attachment"
                                  disabled={deleteAttachmentMutation.isPending}
                                  onClick={() => deleteAttachmentMutation.mutate(att.id)}
                                  data-testid={`button-delete-attachment-${att.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">No attachments yet.</p>
                  )}

                  {/* Upload zone — visible to students (own complaint) and staff/admin */}
                  {canUpload && (
                    <>
                      <Separator />

                      {/* Pending file list */}
                      {pendingFiles.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Ready to upload:</p>
                          {pendingFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2.5 p-2 bg-muted/60 rounded text-sm">
                              <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="flex-1 truncate text-xs font-medium">{f.name}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatFileSize(f.size)}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5"
                                onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                data-testid={`button-remove-pending-${i}`}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Drop zone */}
                      <div
                        className="border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:border-primary hover:bg-muted/40 transition-colors"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => fileRef.current?.click()}
                        data-testid="dropzone-upload"
                      >
                        <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          Drag & drop files here, or <span className="text-primary font-medium">click to browse</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Images, PDF, Word, Excel, PowerPoint — max 10 MB each
                        </p>
                      </div>

                      <input
                        ref={fileRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.xlsx,.xls,.ppt,.pptx,.zip"
                        className="hidden"
                        onChange={handleFileSelect}
                        data-testid="input-file-upload"
                      />

                      {pendingFiles.length > 0 && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            disabled={uploadMutation.isPending}
                            onClick={() => uploadMutation.mutate(pendingFiles)}
                            data-testid="button-upload-files"
                          >
                            {uploadMutation.isPending
                              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
                              : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""}</>
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPendingFiles([])}
                            disabled={uploadMutation.isPending}
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Comments */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-card-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    Comments ({complaint.comments?.length ?? 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {complaint.comments?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first to add one.</p>
                  ) : (
                    complaint.comments?.map((c) => {
                      const isInternalComment = c.isInternal;
                      if (isInternalComment && user?.role === "student") return null;
                      return (
                        <div key={c.id} className={cn("flex gap-3", isInternalComment && "opacity-80")} data-testid={`comment-${c.id}`}>
                          <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                            <AvatarFallback className="text-[10px] bg-muted">
                              {getInitials(c.user?.name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-medium">{c.user?.name ?? "Unknown"}</span>
                              {isInternalComment && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Internal
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                            </div>
                            <div className={cn(
                              "text-sm p-3 rounded-md",
                              isInternalComment
                                ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300"
                                : "bg-muted"
                            )}>
                              {c.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <Separator />

                  <div className="space-y-3">
                    <Textarea
                      placeholder="Add a comment..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
                      rows={3}
                      data-testid="input-comment"
                    />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                      <span>{comment.length}/{MAX_COMMENT_LENGTH} characters</span>
                      {comment.length >= MAX_COMMENT_LENGTH && <span className="text-destructive">Maximum length reached</span>}
                    </div>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {canManage && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInternal}
                            onChange={(e) => setIsInternal(e.target.checked)}
                            className="rounded"
                            data-testid="checkbox-internal-comment"
                          />
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Internal note (staff only)
                          </span>
                        </label>
                      )}
                      <Button
                        onClick={() => commentMutation.mutate({ content: comment, isInternal })}
                        disabled={!comment.trim() || commentMutation.isPending}
                        size="sm"
                        data-testid="button-add-comment"
                      >
                        {commentMutation.isPending ? null : <Send className="w-3.5 h-3.5 mr-1.5" />}
                        Add Comment
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Activity Log */}
            {complaint.activityLogs && complaint.activityLogs.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-card-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      Activity Log ({complaint.activityLogs.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-4">
                        {complaint.activityLogs.map((log) => (
                          <div key={log.id} className="relative flex gap-3 pl-8" data-testid={`activity-log-${log.id}`}>
                            <div className="absolute left-0 w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-sm shadow-sm">
                              {actionIcon(log.action)}
                            </div>
                            <div className="flex-1 min-w-0 pb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{log.user?.name ?? "System"}</span>
                                <span className="text-xs text-muted-foreground">{timeAgo(log.createdAt)}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">{log.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="border-card-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Ticket ID",    icon: Tag,       value: complaint.ticketId },
                    { label: "Category",     icon: Tag,       value: categoryLabels[complaint.category] },
                    { label: "Submitted",    icon: Clock,     value: formatDateTime(complaint.createdAt) },
                    { label: "Submitted by", icon: User,      value: complaint.student?.name ?? "Unknown" },
                    ...(complaint.department ? [{ label: "Department", icon: Building2, value: complaint.department.name }] : []),
                    ...(complaint.staff ? [{ label: "Assigned to", icon: User, value: complaint.staff?.name ?? "Unassigned" }] : []),
                  ].map(({ label, icon: Icon, value }) => (
                    <div key={label} className="flex items-start gap-2.5">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium truncate" data-testid={`detail-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {canManage && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-card-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Manage Complaint</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Select value={complaint.status} onValueChange={(v) => updateMutation.mutate({ status: v })}>
                        <SelectTrigger className="h-8 text-xs" data-testid="select-update-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_FLOW.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">{statusLabels[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Priority</p>
                      <Select value={complaint.priority} onValueChange={(v) => updateMutation.mutate({ priority: v })}>
                        <SelectTrigger className="h-8 text-xs" data-testid="select-update-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(priorityLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {departments && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">Department</p>
                        <Select
                          value={complaint.departmentId ?? "none"}
                          onValueChange={(v) => updateMutation.mutate({ departmentId: v === "none" ? "" : v })}
                          disabled={updateMutation.isPending}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-update-department">
                            <SelectValue placeholder="Assign department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs">Unassigned</SelectItem>
                            {deptsLoading ? (
                              <SelectItem value="" disabled className="text-xs">Loading departments...</SelectItem>
                            ) : (
                              departments.map((d) => (
                                <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {staffList && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">Assign to</p>
                        <Select
                          value={complaint.assignedStaff ?? "none"}
                          onValueChange={(v) => updateMutation.mutate({ assignedStaff: v === "none" ? "" : v })}
                          disabled={updateMutation.isPending}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-assign-staff">
                            <SelectValue placeholder="Assign staff" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs">Unassigned</SelectItem>
                            {staffLoading ? (
                              <SelectItem value="" disabled className="text-xs">Loading staff...</SelectItem>
                            ) : (
                              staffList.map((s) => (
                                <SelectItem key={s.id} value={s.id!} className="text-xs">{s.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {(complaint.status === "resolved" || complaint.status === "closed") && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">Resolution Notes</p>
                        <Textarea
                          placeholder="Describe how this was resolved..."
                          defaultValue={complaint.resolutionNotes ?? ""}
                          rows={3}
                          className="text-xs"
                          data-testid="input-resolution-notes"
                          onBlur={(e) => {
                            if (e.target.value !== complaint.resolutionNotes) {
                              updateMutation.mutate({ resolutionNotes: e.target.value });
                            }
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
