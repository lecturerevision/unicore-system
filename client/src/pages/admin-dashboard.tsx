import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch, apiRequest } from "@/lib/api";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Shield, ClipboardList, CheckCircle2, Clock, TrendingUp, AlertCircle,
  Users, Building2, BarChart3, MessageSquarePlus, Bell,
  Plus, Trash2, RefreshCw, UserX, UserCheck, ChevronRight,
  Loader2, Activity, FolderX, GraduationCap, Search, X,
  FileText, Calendar, Tag, UserCog, ArrowRightLeft, SlidersHorizontal,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  cn, statusColors, statusLabels, priorityColors, priorityLabels,
  categoryLabels, getRoleColor, getInitials, formatDateTime, timeAgo,
} from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { NotificationPanel } from "@/components/notification-panel";
import type { Department, User, ComplaintWithDetails } from "@shared/schema";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface DashboardStats {
  total: number; pending: number; assigned: number;
  inProgress: number; resolved: number; closed: number;
  urgent: number; resolutionRate?: number;
  recentComplaints: ComplaintWithDetails[];
}
interface Analytics {
  totalComplaints: number; resolvedComplaints: number;
  pendingComplaints: number; resolutionRate: number; avgResolutionDays: number;
  byStatus: { status: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  byMonth: { month: string; submitted: number; resolved: number }[];
}
interface ActivityLogEntry {
  id: string; action: string; description: string;
  metadata: any; createdAt: string;
  userId: string | null; complaintId: string | null;
  userName: string | null; userEmail: string | null; userRole: string | null;
}

/* ─── Chart palette ──────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  pending: "#3b82f6", assigned: "#f59e0b",
  in_progress: "#8b5cf6", resolved: "#10b981", closed: "#6b7280",
};
const CAT_COLORS = ["#6366f1","#f59e0b","#10b981","#3b82f6","#ec4899","#f97316","#8b5cf6","#14b8a6","#ef4444","#84cc16"];

const deptSchema = z.object({
  name: z.string().min(2, "Name is required (min 2 chars)"),
  code: z.string().min(2, "Code is required (min 2 chars)").toUpperCase(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  description: z.string().optional(),
  headName: z.string().optional(),
});
type DeptFormData = z.infer<typeof deptSchema>;

/* ─── Stat card ──────────────────────────────────────────────────────── */
function StatCard({ title, value, icon: Icon, bg, color, sub }: {
  title: string; value: number | string; icon: any;
  bg: string; color: string; sub?: string;
}) {
  return (
    <Card className="border-card-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
            <Icon className={cn("w-4.5 h-4.5", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Departments panel ──────────────────────────────────────────────── */
function DepartmentsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: depts, isLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    queryFn: () => authFetch("/api/departments"),
  });

  const form = useForm<DeptFormData>({
    resolver: zodResolver(deptSchema),
    defaultValues: { name: "", code: "", email: "", description: "", headName: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: DeptFormData) => apiRequest("POST", "/api/departments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/departments"] });
      setAdding(false);
      form.reset();
      toast({ title: "Department created" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/departments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/departments"] }); toast({ title: "Department removed" }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{depts?.length ?? 0} departments</p>
        <Button size="sm" onClick={() => setAdding((o) => !o)} data-testid="button-add-department">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Department
        </Button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-3">
                    <p className="text-sm font-semibold">New Department</p>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormControl>
                              <Input placeholder="Name *" {...field} data-testid="input-dept-name" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormControl>
                              <Input placeholder="Code * (e.g. IT)" {...field} data-testid="input-dept-code" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="headName"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormControl>
                              <Input placeholder="Head Name" {...field} data-testid="input-dept-head" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormControl>
                              <Input placeholder="Contact Email" {...field} data-testid="input-dept-email" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem className="col-span-2 space-y-1">
                            <FormControl>
                              <Input placeholder="Description (optional)" {...field} data-testid="input-dept-description" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" type="button" onClick={() => setAdding(false)}>Cancel</Button>
                      <Button
                        size="sm"
                        type="submit"
                        disabled={createMutation.isPending}
                        data-testid="button-save-department"
                      >
                        {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                        Create Department
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : depts && depts.length > 0 ? (
        <div className="space-y-2">
          {depts.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 p-4 rounded-xl border border-card-border bg-card hover:border-primary/30 transition-colors group"
              data-testid={`dept-row-${d.id}`}
            >
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{d.name}</p>
                  <Badge variant="outline" className="font-mono text-xs">{d.code}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {d.headName ? `Head: ${d.headName}` : ""}
                  {d.headName && d.email ? " · " : ""}
                  {d.email ? d.email : ""}
                  {!d.headName && !d.email ? d.description ?? "No details" : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                onClick={() => deleteMutation.mutate(d.id)}
                disabled={deleteMutation.isPending}
                data-testid={`button-delete-dept-${d.id}`}
              >
                {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-xl border border-card-border">
          <Building2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">No departments yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first department to start routing complaints.</p>
        </div>
      )}
    </div>
  );
}

/* ─── Staff accounts panel ───────────────────────────────────────────── */
function StaffPanel({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: allUsers, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => authFetch("/api/users"),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiRequest("PATCH", `/api/users/${id}/role`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "Role updated" }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/users/${id}/suspend`, { isActive }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: vars.isActive ? "User reactivated" : "User suspended" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const filtered = (allUsers ?? []).filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold">{allUsers?.length ?? 0} user accounts</p>
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
            data-testid="input-user-search"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border bg-card transition-colors",
                !u.isActive ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20" : "border-card-border"
              )}
              data-testid={`user-row-${u.id}`}
            >
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarFallback className="text-xs font-bold bg-primary/15 text-primary">
                  {getInitials(u.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate">{u.name}</p>
                  {!u.isActive && (
                    <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      Suspended
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {u.email}
                  {u.department ? ` · ${u.department}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Role selector */}
                {u.id !== currentUserId && (
                  <Select
                    value={u.role}
                    onValueChange={(role) => roleMutation.mutate({ id: u.id, role })}
                    disabled={roleMutation.isPending}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs" data-testid={`select-role-${u.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student" className="text-xs">Student</SelectItem>
                      <SelectItem value="staff" className="text-xs">Staff</SelectItem>
                      <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Current user badge */}
                {u.id === currentUserId && (
                  <Badge className={cn("text-xs", getRoleColor(u.role))}>
                    {u.role} (you)
                  </Badge>
                )}

                {/* Suspend / reactivate */}
                {u.id !== currentUserId && (
                  <Button
                    size="sm"
                    variant={u.isActive ? "outline" : "default"}
                    className={cn("h-7 text-xs gap-1.5", !u.isActive && "bg-green-600 hover:bg-green-700 text-white")}
                    disabled={suspendMutation.isPending}
                    onClick={() => suspendMutation.mutate({ id: u.id, isActive: !u.isActive })}
                    data-testid={`button-suspend-${u.id}`}
                  >
                    {suspendMutation.isPending
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : u.isActive
                      ? <><UserX className="w-3 h-3" /> Suspend</>
                      : <><UserCheck className="w-3 h-3" /> Reactivate</>
                    }
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-xl border border-card-border">
          <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">No users found</p>
        </div>
      )}
    </div>
  );
}

/* ─── Assign modal schema ────────────────────────────────────────────── */
const assignSchema = z.object({
  assignedStaff: z.string().min(1, "Please select a staff member"),
  departmentId: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  notes: z.string().max(500).optional(),
});
type AssignFormData = z.infer<typeof assignSchema>;

/* ─── Assign modal ───────────────────────────────────────────────────── */
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

  const assignMutation = useMutation({
    mutationFn: (data: AssignFormData) =>
      apiRequest("POST", "/api/admin/complaints/assign", {
        complaintId: complaint.id,
        assignedStaff: data.assignedStaff,
        departmentId: (data.departmentId && data.departmentId !== "__none__") ? data.departmentId : null,
        priority: data.priority,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/complaints"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/complaints"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: isReassignment ? "Complaint reassigned" : "Complaint assigned" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Assignment failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="modal-assign">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReassignment
              ? <><ArrowRightLeft className="w-4 h-4 text-amber-500" /> Reassign Complaint</>
              : <><UserCog className="w-4 h-4 text-primary" /> Assign Complaint</>
            }
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
          <form onSubmit={form.handleSubmit((d) => assignMutation.mutate(d))} className="space-y-4">

            {/* Staff */}
            <FormField
              control={form.control}
              name="assignedStaff"
              render={({ field }) => (
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
              )}
            />

            {/* Department */}
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Department</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="modal-select-dept">
                        <SelectValue placeholder="Select department (optional)…" />
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
              )}
            />

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
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
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Assignment Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
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
              )}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={assignMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={assignMutation.isPending} data-testid="modal-button-confirm-assign">
                {assignMutation.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Assigning…</>
                  : isReassignment
                  ? <><ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Reassign</>
                  : <><UserCog className="w-3.5 h-3.5 mr-2" /> Assign</>
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Assignment panel ───────────────────────────────────────────────── */
const ASSIGN_STATUS_TABS = [
  { key: "",            label: "All Active" },
  { key: "pending",     label: "Pending" },
  { key: "assigned",    label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
] as const;

function AssignmentPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithDetails | null>(null);

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (search) params.set("search", search);

  const { data: complaints, isLoading: compLoading } = useQuery<ComplaintWithDetails[]>({
    queryKey: ["/api/complaints", "assign-panel", statusFilter, search],
    queryFn: () => authFetch(`/api/complaints?${params.toString()}`),
  });

  const { data: staffList = [] } = useQuery<Partial<User>[]>({
    queryKey: ["/api/users/staff"],
    queryFn: () => authFetch("/api/users/staff"),
  });

  const { data: depts = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    queryFn: () => authFetch("/api/departments"),
  });

  const activeComplaints = (complaints ?? []).filter(
    (c) => c.status !== "resolved" && c.status !== "closed"
  );

  return (
    <div className="space-y-4">

      {/* Header + filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold">
          {activeComplaints.length} complaint{activeComplaints.length !== 1 ? "s" : ""} to manage
        </p>
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
            data-testid="input-assign-search"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {ASSIGN_STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            data-testid={`assign-tab-${tab.key || "all"}`}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              statusFilter === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Complaint rows */}
      {compLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : activeComplaints.length > 0 ? (
        <div className="space-y-3">
          {activeComplaints.map((c, i) => {
            const isAssigned = !!c.assignedStaff;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "p-4 rounded-xl border bg-card transition-colors",
                  isAssigned ? "border-amber-200 dark:border-amber-800" : "border-card-border"
                )}
                data-testid={`assign-row-${c.id}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{c.ticketId}</span>
                      <Badge className={cn("text-xs", statusColors[c.status])}>{statusLabels[c.status]}</Badge>
                      <Badge className={cn("text-xs", priorityColors[c.priority])}>{priorityLabels[c.priority]}</Badge>
                    </div>
                    <p className="text-sm font-semibold line-clamp-1">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.student?.name ?? "Unknown"} · {categoryLabels[c.category] ?? c.category} · {timeAgo(c.createdAt)}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant={isAssigned ? "outline" : "default"}
                    className={cn("h-8 text-xs shrink-0 gap-1.5", isAssigned && "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40")}
                    onClick={() => setSelectedComplaint(c)}
                    data-testid={`button-open-assign-${c.id}`}
                  >
                    {isAssigned
                      ? <><ArrowRightLeft className="w-3.5 h-3.5" /> Reassign</>
                      : <><UserCog className="w-3.5 h-3.5" /> Assign</>
                    }
                  </Button>
                </div>

                {/* Current assignment info */}
                {isAssigned && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-card-border">
                    <UserCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>
                      Assigned to <strong className="text-foreground">{c.staff?.name ?? "staff"}</strong>
                      {c.department ? <> · <Building2 className="w-3 h-3 inline mx-0.5 opacity-60" />{c.department.name}</> : null}
                      {(c as any).assignedAt ? <> · {timeAgo((c as any).assignedAt)}</> : null}
                    </span>
                  </div>
                )}

                {!isAssigned && c.department && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-card-border">
                    <Building2 className="w-3.5 h-3.5 opacity-60 shrink-0" />
                    <span>{c.department.name}</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center rounded-xl border border-card-border">
          <CheckCircle2 className="w-10 h-10 mx-auto text-green-500 mb-3" />
          <p className="font-semibold">{search || statusFilter ? "No matching complaints" : "All caught up!"}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || statusFilter ? "Try adjusting your filters." : "No active complaints need assignment right now."}
          </p>
        </div>
      )}

      {/* Assign Modal */}
      {selectedComplaint && (
        <AssignModal
          complaint={selectedComplaint}
          staffList={staffList}
          depts={depts}
          open={!!selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
        />
      )}
    </div>
  );
}

/* ─── Activity log panel ─────────────────────────────────────────────── */
const ACTION_ICONS: Record<string, any> = {
  complaint_created:    FileText,
  status_changed:       Activity,
  comment_added:        MessageSquarePlus,
  attachment_uploaded:  FileText,
  complaint_assigned:   Users,
  complaint_resolved:   CheckCircle2,
};
const ACTION_COLORS: Record<string, string> = {
  complaint_created:    "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  status_changed:       "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  comment_added:        "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",
  attachment_uploaded:  "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  complaint_assigned:   "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
  complaint_resolved:   "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
};

function ActivityLogPanel() {
  const { data: logs, isLoading, refetch } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/activity-logs"],
    queryFn: () => authFetch("/api/activity-logs?limit=50"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{logs?.length ?? 0} recent system events</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-logs">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log, i) => {
            const IconComp = ACTION_ICONS[log.action] ?? Activity;
            const colorClass = ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground";
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-start gap-3 p-3.5 rounded-lg border border-card-border bg-card hover:bg-muted/30 transition-colors"
                data-testid={`log-row-${log.id}`}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                  <IconComp className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium line-clamp-1">{log.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {log.userName && (
                      <span className="text-[10px] text-muted-foreground">
                        {log.userName}
                        {log.userRole ? ` (${log.userRole})` : ""}
                      </span>
                    )}
                    {log.complaintId && (
                      <Link href={`/complaints/${log.complaintId}`}>
                        <span className="text-[10px] text-primary hover:underline cursor-pointer">View complaint</span>
                      </Link>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(log.createdAt)}</span>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center rounded-xl border border-card-border">
          <Activity className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">No activity yet</p>
        </div>
      )}
    </div>
  );
}

/* ─── Main admin dashboard ───────────────────────────────────────────── */
export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading, isError, error, refetch } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: () => authFetch("/api/dashboard/stats"),
    enabled: !!user,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ["/api/analytics"],
    queryFn: () => authFetch("/api/analytics"),
    enabled: !!user,
  });

  const STAT_CARDS = [
    { title: "Total Complaints",  value: stats?.total ?? 0,      icon: ClipboardList, bg: "bg-primary/10",                       color: "text-primary" },
    { title: "Pending",           value: stats?.pending ?? 0,    icon: Clock,         bg: "bg-blue-100 dark:bg-blue-900/30",     color: "text-blue-600 dark:text-blue-400" },
    { title: "In Progress",       value: stats?.inProgress ?? 0, icon: TrendingUp,    bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600 dark:text-purple-400" },
    { title: "Resolved",          value: stats?.resolved ?? 0,   icon: CheckCircle2,  bg: "bg-green-100 dark:bg-green-900/30",   color: "text-green-600 dark:text-green-400" },
    { title: "Closed",            value: stats?.closed ?? 0,     icon: FolderX,       bg: "bg-gray-100 dark:bg-gray-800",        color: "text-gray-500" },
    { title: "Assigned",          value: stats?.assigned ?? 0,   icon: Users,         bg: "bg-indigo-100 dark:bg-indigo-900/30", color: "text-indigo-600 dark:text-indigo-400" },
    { title: "Urgent",            value: stats?.urgent ?? 0,     icon: AlertCircle,   bg: "bg-red-100 dark:bg-red-900/30",       color: "text-red-600 dark:text-red-400" },
    { title: "Resolution Rate",   value: `${stats?.resolutionRate ?? 0}%`, icon: BarChart3, bg: "bg-teal-100 dark:bg-teal-900/30", color: "text-teal-600 dark:text-teal-400", sub: `${stats?.resolved ?? 0} of ${stats?.total ?? 0} resolved` },
  ];

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
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* ── Welcome banner ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-green-500/12 via-green-500/6 to-transparent border border-green-500/20 p-6"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-700 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">System Administrator</p>
                <h1 className="text-2xl font-bold mt-0.5" data-testid="text-welcome-name">{user?.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Full access · All departments · Real-time monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" asChild>
                <Link href="/analytics">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </Link>
              </Button>
              <Button asChild data-testid="button-new-complaint">
                <Link href="/complaints/new">
                  <MessageSquarePlus className="w-4 h-4 mr-2" />
                  New Complaint
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Stats cards — 4+4 grid ─────────────────────────────────── */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border-card-border">
                <CardContent className="p-5"><Skeleton className="h-4 w-20 mb-3" /><Skeleton className="h-8 w-12" /></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {STAT_CARDS.map((s, i) => (
              <motion.div
                key={s.title}
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                data-testid={`stat-card-${s.title.toLowerCase().replace(/[\s%]+/g, "-")}`}
              >
                <StatCard {...s} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Charts row ─────────────────────────────────────────────── */}
        {!analyticsLoading && analytics && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-5"
          >
            {/* Area chart: 6-month trend */}
            <Card className="lg:col-span-2 border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Complaints Over 6 Months</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={analytics.byMonth} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="gradSubmitted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#6366f1" fill="url(#gradSubmitted)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" fill="url(#gradResolved)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Donut: status distribution */}
            <Card className="border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={analytics.byStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {analytics.byStatus.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: any, name: string) => [v, statusLabels[name] ?? name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {analytics.byStatus.map((s) => (
                    <div key={s.status} className="flex items-center gap-1 text-[10px]">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[s.status] }} />
                      {statusLabels[s.status] ?? s.status} ({s.count})
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bar chart: by category */}
            <Card className="lg:col-span-2 border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Complaints by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.byCategory} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => categoryLabels[v]?.split(" ")[0] ?? v} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: any, _name: any, p: any) => [v, categoryLabels[p.payload.category] ?? p.payload.category]}
                    />
                    <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                      {analytics.byCategory.map((_, idx) => (
                        <Cell key={idx} fill={CAT_COLORS[idx % CAT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bar chart: by department */}
            <Card className="border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">By Department</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.byDepartment.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.byDepartment} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="department" type="category" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="count" name="Complaints" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                    No department data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Notifications panel ─────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Card className="border-card-border">
            <CardContent className="p-4">
              <NotificationPanel limit={6} />
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Management tabs ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Tabs defaultValue="departments">
            <TabsList className="w-full justify-start h-auto p-1 flex-wrap gap-1" data-testid="admin-tabs">
              <TabsTrigger value="departments" className="gap-1.5 text-xs" data-testid="tab-departments">
                <Building2 className="w-3.5 h-3.5" /> Departments
              </TabsTrigger>
              <TabsTrigger value="staff" className="gap-1.5 text-xs" data-testid="tab-staff">
                <Users className="w-3.5 h-3.5" /> Staff Accounts
              </TabsTrigger>
              <TabsTrigger value="assign" className="gap-1.5 text-xs" data-testid="tab-assign">
                <ClipboardList className="w-3.5 h-3.5" /> Assign Complaints
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5 text-xs" data-testid="tab-logs">
                <Activity className="w-3.5 h-3.5" /> Activity Logs
              </TabsTrigger>
              <TabsTrigger value="complaints" className="gap-1.5 text-xs" data-testid="tab-complaints">
                <FileText className="w-3.5 h-3.5" /> All Complaints
              </TabsTrigger>
            </TabsList>

            <div className="mt-5">
              <TabsContent value="departments">
                <DepartmentsPanel />
              </TabsContent>

              <TabsContent value="staff">
                <StaffPanel currentUserId={user?.id ?? ""} />
              </TabsContent>

              <TabsContent value="assign">
                <AssignmentPanel />
              </TabsContent>

              <TabsContent value="logs">
                <ActivityLogPanel />
              </TabsContent>

              <TabsContent value="complaints">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">All system complaints</p>
                    <Button size="sm" asChild>
                      <Link href="/complaints">
                        Open full list <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Use the full complaints page for filtering, searching, and detailed management.
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { href: "/complaints", label: "All Complaints",       icon: ClipboardList,    count: stats?.total },
                      { href: "/complaints?status=pending",     label: "Pending",    icon: Clock,   count: stats?.pending },
                      { href: "/complaints?status=in_progress", label: "In Progress",icon: TrendingUp, count: stats?.inProgress },
                      { href: "/complaints?status=resolved",    label: "Resolved",   icon: CheckCircle2, count: stats?.resolved },
                    ].map((link) => (
                      <Link key={link.label} href={link.href}>
                        <div className="p-4 rounded-xl border border-card-border bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer text-center">
                          <link.icon className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                          <p className="text-xl font-bold">{link.count ?? 0}</p>
                          <p className="text-xs text-muted-foreground">{link.label}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
