import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch, apiRequest } from "@/lib/api";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Users, GraduationCap, Shield, UserCog, AlertCircle,
  UserX, Trash2, RotateCcw, TriangleAlert,
} from "lucide-react";
import { cn, getInitials, getRoleColor, formatDate } from "@/lib/utils";
import type { User } from "@shared/schema";

type DeleteAction = { userId: string; userName: string; type: "temporary" | "permanent" } | null;

export default function UsersPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteAction, setDeleteAction] = useState<DeleteAction>(null);

  const { data: users, isLoading, isError, error, refetch } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => authFetch("/api/users"),
    enabled: me?.role === "admin",
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiRequest("PATCH", `/api/users/${id}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Role updated" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "temporary" | "permanent" }) =>
      apiRequest("DELETE", `/api/admin/users/${id}`, { type }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: data.message });
      setDeleteAction(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
      setDeleteAction(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/users/${id}/restore`, {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: data.message });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (me?.role !== "admin") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Admin access required.</p>
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

  const demoEmails = ["admin@university.edu", "staff@university.edu", "student@university.edu"];

  const filtered = users?.filter((u) => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const counts = {
    total:   users?.length ?? 0,
    admin:   users?.filter((u) => u.role === "admin").length ?? 0,
    staff:   users?.filter((u) => u.role === "staff").length ?? 0,
    student: users?.filter((u) => u.role === "student").length ?? 0,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all users, roles, and account status</p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Users",   value: counts.total,   icon: Users,        color: "text-primary",                                          bg: "bg-primary/10" },
            { label: "Admins",        value: counts.admin,   icon: Shield,        color: "text-red-600 dark:text-red-400",                        bg: "bg-red-100 dark:bg-red-900/30" },
            { label: "Staff",         value: counts.staff,   icon: UserCog,       color: "text-blue-600 dark:text-blue-400",                      bg: "bg-blue-100 dark:bg-blue-900/30" },
            { label: "Students",      value: counts.student, icon: GraduationCap, color: "text-green-600 dark:text-green-400",                    bg: "bg-green-100 dark:bg-green-900/30" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <Card className="border-card-border">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{s.value}</p>
                  </div>
                  <div className={cn("w-9 h-9 rounded-md flex items-center justify-center", s.bg)}>
                    <s.icon className={cn("w-5 h-5", s.color)} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-users"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-32" data-testid="select-role-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filtered && filtered.length > 0 ? (
              <div className="divide-y divide-border">
                {filtered.map((u, i) => {
                  const isDemo = demoEmails.includes(u.email);
                  const isMe = u.id === me?.id;
                  const isInactive = !u.isActive;

                  return (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={cn(
                        "flex items-center gap-3 p-4 flex-wrap sm:flex-nowrap",
                        isInactive && "bg-muted/40 opacity-70"
                      )}
                      data-testid={`row-user-${u.id}`}
                    >
                      {/* Avatar */}
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarFallback className="text-xs font-semibold bg-muted">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{u.name}</p>
                          <Badge variant="secondary" className={cn("text-xs", getRoleColor(u.role))}>
                            {u.role}
                          </Badge>
                          {isInactive && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                              Deactivated
                            </Badge>
                          )}
                          {isDemo && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Demo
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        {u.department && <p className="text-xs text-muted-foreground">{u.department}</p>}
                      </div>

                      {/* Joined */}
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-xs text-muted-foreground">Joined</p>
                        <p className="text-xs">{formatDate(u.createdAt)}</p>
                      </div>

                      {/* Role selector */}
                      {!isMe && (
                        <Select
                          value={u.role}
                          onValueChange={(v) => updateRoleMutation.mutate({ id: u.id, role: v })}
                          disabled={isDemo}
                        >
                          <SelectTrigger className="w-24 h-8 text-xs shrink-0" data-testid={`select-role-${u.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student" className="text-xs">Student</SelectItem>
                            <SelectItem value="staff" className="text-xs">Staff</SelectItem>
                            <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* Action buttons */}
                      {!isMe && !isDemo && (
                        <div className="flex items-center gap-1 shrink-0">
                          {isInactive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs text-green-600 border-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                              data-testid={`button-restore-${u.id}`}
                              disabled={restoreMutation.isPending}
                              onClick={() => restoreMutation.mutate(u.id)}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Restore
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs text-amber-600 border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              data-testid={`button-deactivate-${u.id}`}
                              onClick={() => setDeleteAction({ userId: u.id, userName: u.name, type: "temporary" })}
                            >
                              <UserX className="w-3 h-3 mr-1" />
                              Deactivate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-red-600 border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                            data-testid={`button-delete-${u.id}`}
                            onClick={() => setDeleteAction({ userId: u.id, userName: u.name, type: "permanent" })}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No users found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Delete Confirmation Dialog ───────────────────────────────── */}
      <AlertDialog open={!!deleteAction} onOpenChange={(o) => !o && setDeleteAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteAction?.type === "permanent"
                ? <><Trash2 className="w-5 h-5 text-red-500" /> Delete User Permanently</>
                : <><UserX className="w-5 h-5 text-amber-500" /> Deactivate User</>}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deleteAction?.type === "permanent" ? (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                    <div className="flex items-start gap-2">
                      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>This cannot be undone.</strong>
                        <p className="mt-1">
                          <strong>{deleteAction?.userName}</strong>'s account, all their complaints, comments, and uploaded files will be permanently deleted from the database.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
                    <strong>{deleteAction?.userName}</strong>'s account will be deactivated. They won't be able to log in. You can restore the account at any time.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteAction(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteAction && deleteMutation.mutate({ id: deleteAction.userId, type: deleteAction.type })}
              className={deleteAction?.type === "permanent"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-white"}
              data-testid="button-confirm-user-delete"
            >
              {deleteMutation.isPending
                ? "Processing…"
                : deleteAction?.type === "permanent" ? "Yes, delete permanently" : "Yes, deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
