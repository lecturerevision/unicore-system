import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, X, ArrowLeft, FileText, Upload, Send, CheckCircle2,
  Tag, AlignLeft, Paperclip, Building2, AlertTriangle, Image,
} from "lucide-react";
import { categoryLabels, priorityLabels, cn } from "@/lib/utils";
import type { Department } from "@shared/schema";

const schema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(20, "Please provide a more detailed description (min 20 chars)"),
  category: z.string().min(1, "Please select a category"),
  priority: z.string().min(1, "Please select a priority"),
  departmentId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PRIORITY_META: Record<string, { label: string; desc: string; color: string; border: string }> = {
  low: {
    label: "Low",
    desc: "Minor issue, no urgency",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    border: "border-gray-300 dark:border-gray-600",
  },
  medium: {
    label: "Medium",
    desc: "Moderately important",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    border: "border-blue-400 dark:border-blue-500",
  },
  high: {
    label: "High",
    desc: "Needs prompt attention",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    border: "border-orange-400 dark:border-orange-500",
  },
  urgent: {
    label: "Urgent",
    desc: "Critical — immediate action required",
    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    border: "border-red-500 dark:border-red-500",
  },
};

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

function isImage(name: string) {
  return IMAGE_EXTS.has("." + (name.split(".").pop() ?? "").toLowerCase());
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function NewComplaintPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: departments, isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    queryFn: () => authFetch("/api/departments"),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", category: "", priority: "medium", departmentId: "" },
  });

  const selectedPriority = form.watch("priority") as string;
  const description = form.watch("description") as string;
  const title = form.watch("title") as string;

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("description", data.description);
      formData.append("category", data.category);
      formData.append("priority", data.priority);
      if (data.departmentId) formData.append("departmentId", data.departmentId);
      files.forEach((f) => formData.append("files", f));

      const token = localStorage.getItem("unicore_token");
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/complaints"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Complaint submitted!", description: `Ticket ${data.ticketId} created successfully.` });
      setLocation(`/complaints/${data.id}`);
    },
    onError: (err: Error) => toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
  });

  const addFiles = (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const arr = Array.from(fileList);
    setFiles((prev) => [...prev, ...arr].slice(0, 5));
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-3xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-7"
        >
          <Button variant="ghost" size="icon" onClick={() => setLocation("/complaints")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Submit a Complaint</h1>
            <p className="text-sm text-muted-foreground">Describe your issue and we'll route it to the right department</p>
          </div>
        </motion.div>

        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Main form ─────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Title */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                className="rounded-xl border border-card-border bg-card p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <AlignLeft className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Complaint Title</h2>
                </div>
                <div className="space-y-1.5">
                  <Input
                    placeholder="Give a clear, one-line summary of the issue"
                    data-testid="input-complaint-title"
                    className="text-base h-11"
                    {...form.register("title")}
                  />
                  <div className="flex items-center justify-between">
                    {form.formState.errors.title ? (
                      <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                    ) : (
                      <span />
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{title.length}/200</span>
                  </div>
                </div>
              </motion.div>

              {/* Description */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="rounded-xl border border-card-border bg-card p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <AlignLeft className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Detailed Description</h2>
                </div>
                <div className="space-y-1.5">
                  <Textarea
                    placeholder="Describe your complaint in detail. Include relevant dates, locations, people involved, and any previous attempts to resolve the issue..."
                    rows={6}
                    data-testid="input-complaint-description"
                    className="resize-none leading-relaxed"
                    {...form.register("description")}
                  />
                  <div className="flex items-center justify-between">
                    {form.formState.errors.description ? (
                      <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Min. 20 characters</p>
                    )}
                    <span className="text-xs text-muted-foreground">{description.length} chars</span>
                  </div>
                </div>
              </motion.div>

              {/* Attachments */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="rounded-xl border border-card-border bg-card p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">Supporting Files</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">{files.length}/5 files</span>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileRef.current?.click()}
                  data-testid="button-upload-files"
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-150",
                    dragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  <Upload className={cn("w-7 h-7 mx-auto mb-2.5 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
                  <p className="text-sm font-medium text-foreground/80">
                    {dragging ? "Drop files here" : "Drag & drop files, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Images, PDF, Word, Excel — up to 10 MB each · max 5 files
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.txt,.xlsx"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />

                {/* Pending files */}
                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-2"
                    >
                      {files.map((f, i) => {
                        const Icon = isImage(f.name) ? Image : FileText;
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            className="flex items-center gap-3 p-2.5 bg-muted rounded-lg"
                          >
                            <Icon className={cn("w-4 h-4 shrink-0", isImage(f.name) ? "text-blue-500" : "text-muted-foreground")} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{f.name}</p>
                              <p className="text-[10px] text-muted-foreground">{formatSize(f.size)}</p>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeFile(i)}
                              data-testid={`button-remove-file-${i}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* ── Right sidebar ─────────────────────────────────── */}
            <div className="space-y-4">

              {/* Category */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="rounded-xl border border-card-border bg-card p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Category</h2>
                  <span className="text-destructive text-sm ml-auto">*</span>
                </div>
                <Select onValueChange={(v) => form.setValue("category", v)}>
                  <SelectTrigger data-testid="select-complaint-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-xs text-destructive mt-1.5">{form.formState.errors.category.message}</p>
                )}
              </motion.div>

              {/* Priority */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}
                className="rounded-xl border border-card-border bg-card p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Priority</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PRIORITY_META).map(([k, meta]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => form.setValue("priority", k)}
                      className={cn(
                        "p-2.5 rounded-lg border-2 text-left text-xs font-medium transition-all",
                        selectedPriority === k
                          ? `${meta.color} ${meta.border}`
                          : "border-border bg-background text-muted-foreground hover:border-border/70"
                      )}
                    >
                      <p className="font-semibold">{meta.label}</p>
                      <p className={cn("text-[10px] mt-0.5", selectedPriority === k ? "opacity-80" : "opacity-60")}>
                        {meta.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Department */}
              {departments && departments.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
                  className="rounded-xl border border-card-border bg-card p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">Department</h2>
                    <Badge variant="outline" className="text-[10px] ml-auto px-1.5 py-0">optional</Badge>
                  </div>
                  <Select onValueChange={(v) => form.setValue("departmentId", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-complaint-department">
                      <SelectValue placeholder="Auto-assign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Auto-assign based on category</SelectItem>
                      {deptsLoading ? (
                        <SelectItem value="" disabled>Loading departments...</SelectItem>
                      ) : (
                        departments?.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}

              {/* Submit */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div className="space-y-2.5">
                  <Button
                    type="submit"
                    className="w-full h-11 font-semibold"
                    disabled={mutation.isPending}
                    data-testid="button-submit-complaint"
                  >
                    {mutation.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                      : <><Send className="w-4 h-4 mr-2" /> Submit Complaint</>
                    }
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setLocation("/complaints")}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                    Your complaint will be reviewed within 24 hours. You'll receive a notification when its status changes.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
