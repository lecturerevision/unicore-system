import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch, apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  cn, statusColors, statusLabels, priorityColors, priorityLabels,
  categoryLabels, getInitials, formatDateTime, timeAgo,
} from "@/lib/utils";
import {
  Search, X, Filter, ChevronLeft, ChevronRight, Eye, Pencil, UserCog,
  Trash2, Loader2, Building2, ArrowRightLeft, ClipboardList, AlertCircle,
  SlidersHorizontal, Calendar, RefreshCw, UserCheck,
} from "lucide-react";
import type { Department, User, ComplaintWithDetails } from "@shared/schema";

/* ─── Types ───────────────────────────────────────────────────────────── */
interface AdminComplaintsResponse {
  data: ComplaintWithDetails[];
  meta: { total: number; page: number; limit: number; pages: number };
}

/* ─── Constants ───────────────────────────────────────────────────────── */
const STATUSES = [
  { value: "__all__", label: "All Statuses" },
  { value: "pending",     label: "Pending" },
  { value: "assigned",    label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved",    label: "Resolved" },
  { value: "closed",      label: "Closed" },
];

const PRIORITIES = [
  { value: "__all__", label: "All Priorities" },
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];

/* ─── Zod schemas ──────────────────────────────────────────────────────── */
const editSchema = z.object({
  title:           z.string().min(5, "Min 5 chars").max(200),
  description:     z.string().min(10, "Min 10 chars").max(5000),
  status:          z.enum(["pending", "assigned", "in_progress", "resolved", "closed"]),
  priority:        z.enum(["low", "medium", "high", "urgent"]),
  assignedStaff:   z.string().optional(),
  departmentId:    z.string().optional(),
  resolutionNotes: z.string().max(5000).optional(),
});
type EditFormData = z.infer<typeof editSchema>;

const assignSchema = z.object({
  assignedStaff: z.string().min(1, "Please select a staff member"),
  departmentId:  z.string().optional(),
  priority:      z.enum(["low", "medium", "high", "urgent"]),
  notes:         z.string().max(1000).optional(),
});
type AssignFormData = z.infer<typeof assignSchema>;

/* ─── Assign Modal (reused pattern from admin-dashboard) ──────────────── */
function AssignModal({
  complaint,
  staffList,
  depts,
  open,
  onClose,
}: {
  complaint: ComplaintWithDetails;
  staffList: Partial<User>[];
  depts: Department[];
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isReassignment = !!complaint.assignedStaff;

  const form = useForm<AssignFormData>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      assignedStaff: complaint.assignedStaff ?? "",
      departmentId: complaint.departmentId ?? "__none__",
      priority: (complaint.priority as AssignFormData["priority"]) ?? "medium",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: AssignFormData) =>
      apiRequest("POST", "/api/admin/complaints/assign", {
        complaintId: complaint.id,
        assignedStaff: data.assignedStaff,
        departmentId: data.departmentId && data.departmentId !== "__none__" ? data.departmentId : null,
        priority: data.priority,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/complaints"] });
      qc.invalidateQueries({ queryKey: ["/api/complaints"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: isReassignment ? "Complaint reassigned" : "Complaint assigned" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Assignment failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="modal-assign">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReassignment
              ? <><ArrowRightLeft className="w-4 h-4 text-amber-500" /> Reassign Complaint</>
              : <><UserCog className="w-4 h-4 text-primary" /> Assign Complaint</>}
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded mr-2">{complaint.ticketId}</span>
            {complaint.title}
          </DialogDescription>
        </DialogHeader>

        {isReassignment && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Currently assigned to <strong>{complaint.staff?.name ?? "someone"}</strong>. This will reassign and notify them.</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="assignedStaff" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Assign to Staff *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="modal-select-staff">
                      <SelectValue placeholder="Select a staff member…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {staffList.map((s) => (
                      <SelectItem key={s.id!} value={s.id!}>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-5 h-5">
                            <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-bold">
                              {getInitials(s.name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span>{s.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">{s.role}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="departmentId" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Department</FormLabel>
                <Select value={field.value ?? "__none__"} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="modal-select-dept">
                      <SelectValue placeholder="Select department…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">No department</SelectItem>
                    {depts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {d.name}
                          <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">{d.code}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="priority" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Priority</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="modal-select-priority">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(["low", "medium", "high", "urgent"] as const).map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className={cn("font-medium", priorityColors[p])}>{priorityLabels[p]}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">
                  Assignment Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Add context or instructions for the assigned staff member…"
                    rows={3}
                    className="resize-none text-sm"
                    {...field}
                    data-testid="modal-input-notes"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="modal-button-confirm-assign">
                {mutation.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Saving…</>
                  : isReassignment
                  ? <><ArrowRightLeft className="w-3.5 h-3.5 mr-2" />Reassign</>
                  : <><UserCog className="w-3.5 h-3.5 mr-2" />Assign</>}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Modal ──────────────────────────────────────────────────────── */
function EditModal({
  complaint,
  staffList,
  depts,
  open,
  onClose,
}: {
  complaint: ComplaintWithDetails;
  staffList: Partial<User>[];
  depts: Department[];
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const needsResolution = (s: string) => s === "resolved" || s === "closed";

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title:           complaint.title,
      description:     complaint.description,
      status:          complaint.status as EditFormData["status"],
      priority:        complaint.priority as EditFormData["priority"],
      assignedStaff:   complaint.assignedStaff ?? "__none__",
      departmentId:    complaint.departmentId ?? "__none__",
      resolutionNotes: complaint.resolutionNotes ?? "",
    },
  });

  const statusVal = form.watch("status");

  const mutation = useMutation({
    mutationFn: (data: EditFormData) =>
      apiRequest("PUT", `/api/admin/complaints/${complaint.id}`, {
        title:           data.title,
        description:     data.description,
        status:          data.status,
        priority:        data.priority,
        assignedStaff:   data.assignedStaff && data.assignedStaff !== "__none__" ? data.assignedStaff : null,
        departmentId:    data.departmentId && data.departmentId !== "__none__" ? data.departmentId : null,
        resolutionNotes: data.resolutionNotes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/complaints"] });
      qc.invalidateQueries({ queryKey: ["/api/complaints"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Complaint updated" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="modal-edit">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" /> Edit Complaint
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded mr-2">{complaint.ticketId}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs underline underline-offset-2"
              onClick={() => { onClose(); navigate(`/complaints/${complaint.id}`); }}
            >
              View full detail →
            </Button>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">

            {/* Title */}
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Title</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="modal-input-title" className="text-sm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder="Describe the complaint in detail…"
                    className="resize-y text-sm min-h-[80px]"
                    data-testid="modal-input-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="modal-select-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(["pending", "assigned", "in_progress", "resolved", "closed"] as const).map((s) => (
                        <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Priority */}
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Priority</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="modal-select-edit-priority">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(["low", "medium", "high", "urgent"] as const).map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className={cn("font-medium", priorityColors[p])}>{priorityLabels[p]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Assigned Staff */}
            <FormField control={form.control} name="assignedStaff" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Assigned Staff</FormLabel>
                <Select value={field.value ?? "__none__"} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="modal-select-edit-staff">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id!} value={s.id!}>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-5 h-5">
                            <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-bold">
                              {getInitials(s.name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span>{s.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Department */}
            <FormField control={form.control} name="departmentId" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Department</FormLabel>
                <Select value={field.value ?? "__none__"} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="modal-select-edit-dept">
                      <SelectValue placeholder="No department" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">No department</SelectItem>
                    {depts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {d.name}
                          <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">{d.code}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Resolution Notes — shown when resolved/closed */}
            <AnimatePresence>
              {needsResolution(statusVal) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <FormField control={form.control} name="resolutionNotes" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">
                        Resolution Notes <span className="text-muted-foreground font-normal">(recommended for resolved/closed)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe how the complaint was resolved…"
                          rows={3}
                          className="resize-none text-sm"
                          {...field}
                          data-testid="modal-input-resolution"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </motion.div>
              )}
            </AnimatePresence>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="modal-button-save-edit">
                {mutation.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Saving…</>
                  : <><Pencil className="w-3.5 h-3.5 mr-2" />Save Changes</>}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Delete Confirm ──────────────────────────────────────────────────── */
function DeleteConfirm({
  complaint,
  open,
  onClose,
}: {
  complaint: ComplaintWithDetails;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/complaints/${complaint.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/complaints"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Complaint deleted" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent data-testid="modal-delete">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" /> Delete Complaint?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                You are about to delete{" "}
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{complaint.ticketId}</span>{" "}
                &ldquo;<strong className="text-foreground">{complaint.title}</strong>&rdquo;.
              </p>
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  The complaint will be <strong>soft-deleted</strong> — it is hidden from all views
                  but its data, comments, and activity logs are preserved in the database.
                  Only system administrators can access soft-deleted records.
                </span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending} data-testid="modal-button-cancel-delete">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); mutation.mutate(); }}
            disabled={mutation.isPending}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            data-testid="modal-button-confirm-delete"
          >
            {mutation.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Deleting…</>
              : <><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</>}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─── Priority dot ─────────────────────────────────────────────────────── */
const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400", medium: "bg-amber-400", high: "bg-orange-500", urgent: "bg-red-500",
};

/* ─── Main page ───────────────────────────────────────────────────────── */
export default function AdminComplaintsPage() {
  const { toast } = useToast();

  /* Filter state */
  const [search, setSearch]           = useState("");
  const [debouncedSearch, setDSearch] = useState("");
  const [statusFilter, setStatus]     = useState("__all__");
  const [priorityFilter, setPriority] = useState("__all__");
  const [deptFilter, setDept]         = useState("__all__");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [page, setPage]               = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  /* Modal state */
  const [viewId, setViewId]       = useState<string | null>(null);
  const [editTarget, setEdit]     = useState<ComplaintWithDetails | null>(null);
  const [assignTarget, setAssign] = useState<ComplaintWithDetails | null>(null);
  const [deleteTarget, setDelete] = useState<ComplaintWithDetails | null>(null);

  /* Debounce search */
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => {
      setDSearch(val);
      setPage(1);
    }, 400);
  }, []);

  /* Build query */
  const params = new URLSearchParams();
  if (debouncedSearch)                         params.set("search",     debouncedSearch);
  if (statusFilter   && statusFilter   !== "__all__") params.set("status",   statusFilter);
  if (priorityFilter && priorityFilter !== "__all__") params.set("priority", priorityFilter);
  if (deptFilter     && deptFilter     !== "__all__") params.set("departmentId", deptFilter);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo)   params.set("dateTo",   dateTo);
  params.set("page",  String(page));
  params.set("limit", "20");

  const { data, isLoading, isError, refetch } = useQuery<AdminComplaintsResponse>({
    queryKey: ["/api/admin/complaints", debouncedSearch, statusFilter, priorityFilter, deptFilter, dateFrom, dateTo, page],
    queryFn:  () => authFetch(`/api/admin/complaints?${params.toString()}`),
  });

  const { data: staffList = [] } = useQuery<Partial<User>[]>({
    queryKey: ["/api/users/staff"],
    queryFn:  () => authFetch("/api/users/staff"),
  });

  const { data: depts = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    queryFn:  () => authFetch("/api/departments"),
  });

  const complaints = data?.data ?? [];
  const meta       = data?.meta;

  const hasFilters = debouncedSearch || statusFilter !== "__all__" || priorityFilter !== "__all__"
    || deptFilter !== "__all__" || dateFrom || dateTo;

  function clearFilters() {
    setSearch(""); setDSearch("");
    setStatus("__all__"); setPriority("__all__"); setDept("__all__");
    setDateFrom(""); setDateTo("");
    setPage(1);
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Complaint Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {meta ? `${meta.total.toLocaleString()} total complaints` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh"
              className="gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters((p) => !p)}
              data-testid="button-toggle-filters"
              className="gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {hasFilters && (
                <span className="ml-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                  !
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* ── Search bar ──────────────────────────────────────────── */}
        <div className="relative mt-3 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ticket ID, title or student name…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-9 h-9 text-sm"
            data-testid="input-search"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setDSearch(""); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── Filter panel ────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {/* Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                    <SelectTrigger className="h-8 text-xs" data-testid="filter-select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Priority</label>
                  <Select value={priorityFilter} onValueChange={(v) => { setPriority(v); setPage(1); }}>
                    <SelectTrigger className="h-8 text-xs" data-testid="filter-select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Department</label>
                  <Select value={deptFilter} onValueChange={(v) => { setDept(v); setPage(1); }}>
                    <SelectTrigger className="h-8 text-xs" data-testid="filter-select-dept">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Departments</SelectItem>
                      {depts.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> From
                  </label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="h-8 text-xs"
                    data-testid="filter-input-date-from"
                  />
                </div>

                {/* Date To */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> To
                  </label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="h-8 text-xs"
                    data-testid="filter-input-date-to"
                  />
                </div>
              </div>

              {hasFilters && (
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                    data-testid="button-clear-filters"
                  >
                    <X className="w-3 h-3" /> Clear all filters
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Table area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isError ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="font-semibold">Failed to load complaints</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 sticky top-0 z-10">
                {["Ticket ID","Title","Student","Department","Assigned Staff","Priority","Status","Created","Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {[...Array(9)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground/40" />
            <p className="font-semibold text-muted-foreground">
              {hasFilters ? "No complaints match your filters" : "No complaints yet"}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-reset-from-empty">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[900px]" data-testid="table-complaints">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/60 backdrop-blur">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ticket ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned Staff</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {complaints.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-border hover:bg-muted/30 transition-colors group"
                    data-testid={`row-complaint-${c.id}`}
                  >
                    {/* Ticket ID */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="font-mono text-xs text-primary font-semibold bg-primary/8 px-2 py-1 rounded"
                        data-testid={`text-ticket-${c.id}`}
                      >
                        {c.ticketId}
                      </span>
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <p
                        className="text-sm font-medium line-clamp-1 leading-tight"
                        title={c.title}
                        data-testid={`text-title-${c.id}`}
                      >
                        {c.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                        {categoryLabels[c.category] ?? c.category}
                      </p>
                    </td>

                    {/* Student */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.student ? (
                        <div className="flex items-center gap-2" data-testid={`text-student-${c.id}`}>
                          <Avatar className="w-6 h-6 shrink-0">
                            <AvatarFallback className="text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              {getInitials(c.student.name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{c.student.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unknown</span>
                      )}
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3 whitespace-nowrap" data-testid={`text-dept-${c.id}`}>
                      {c.department ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm">{c.department.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Assigned Staff */}
                    <td className="px-4 py-3 whitespace-nowrap" data-testid={`text-staff-${c.id}`}>
                      {c.staff ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6 shrink-0">
                            <AvatarFallback className="text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                              {getInitials(c.staff.name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{c.staff.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Unassigned
                        </span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3 whitespace-nowrap" data-testid={`text-priority-${c.id}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_DOT[c.priority])} />
                        <Badge className={cn("text-xs font-medium", priorityColors[c.priority])}>
                          {priorityLabels[c.priority]}
                        </Badge>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap" data-testid={`text-status-${c.id}`}>
                      <Badge className={cn("text-xs", statusColors[c.status])}>
                        {statusLabels[c.status]}
                      </Badge>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 whitespace-nowrap" data-testid={`text-created-${c.id}`}>
                      <span className="text-xs text-muted-foreground" title={formatDateTime(c.createdAt)}>
                        {timeAgo(c.createdAt)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {/* View */}
                        <Link href={`/complaints/${c.id}`}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-muted-foreground hover:text-primary"
                            title="View complaint"
                            data-testid={`button-view-${c.id}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>

                        {/* Edit */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 text-muted-foreground hover:text-blue-600"
                          title="Edit complaint"
                          onClick={() => setEdit(c)}
                          data-testid={`button-edit-${c.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>

                        {/* Assign / Reassign */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "w-7 h-7",
                            c.assignedStaff
                              ? "text-amber-500 hover:text-amber-600"
                              : "text-muted-foreground hover:text-indigo-600"
                          )}
                          title={c.assignedStaff ? "Reassign complaint" : "Assign complaint"}
                          onClick={() => setAssign(c)}
                          data-testid={`button-assign-${c.id}`}
                        >
                          {c.assignedStaff
                            ? <ArrowRightLeft className="w-3.5 h-3.5" />
                            : <UserCog className="w-3.5 h-3.5" />}
                        </Button>

                        {/* Delete */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 text-muted-foreground hover:text-destructive"
                          title="Delete complaint"
                          onClick={() => setDelete(c)}
                          data-testid={`button-delete-${c.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {meta && meta.pages > 1 && (
        <div className="shrink-0 border-t border-border bg-background px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Showing <strong>{(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)}</strong> of{" "}
            <strong>{meta.total}</strong> complaints
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.page <= 1}
              className="h-8 px-2"
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Page number buttons */}
            {Array.from({ length: meta.pages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === meta.pages || Math.abs(p - meta.page) <= 1)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === "number" && p - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                ) : (
                  <Button
                    key={item}
                    variant={meta.page === item ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(item as number)}
                    className="h-8 w-8 p-0 text-xs"
                    data-testid={`button-page-${item}`}
                  >
                    {item}
                  </Button>
                )
              )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
              disabled={meta.page >= meta.pages}
              className="h-8 px-2"
              data-testid="button-next-page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {editTarget && (
        <EditModal
          complaint={editTarget}
          staffList={staffList}
          depts={depts}
          open={!!editTarget}
          onClose={() => setEdit(null)}
        />
      )}
      {assignTarget && (
        <AssignModal
          complaint={assignTarget}
          staffList={staffList}
          depts={depts}
          open={!!assignTarget}
          onClose={() => setAssign(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          complaint={deleteTarget}
          open={!!deleteTarget}
          onClose={() => setDelete(null)}
        />
      )}
    </div>
  );
}
