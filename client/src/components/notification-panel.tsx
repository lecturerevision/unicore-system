import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch, apiRequest } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell, CheckCheck, MessageSquare, Tag, ArrowUpRight,
  Info, ExternalLink, CheckCircle2, UserCheck,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";
import type { Notification } from "@shared/schema";

const NOTIF_META: Record<string, { icon: any; bg: string; color: string; label: string }> = {
  complaint_submitted: { icon: Tag,          bg: "bg-blue-100 dark:bg-blue-900/30",   color: "text-blue-600 dark:text-blue-400",   label: "New complaint"  },
  status_changed:      { icon: Info,         bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600 dark:text-purple-400", label: "Status update" },
  comment_added:       { icon: MessageSquare,bg: "bg-slate-100 dark:bg-slate-800",     color: "text-slate-600 dark:text-slate-400",  label: "Comment"       },
  assigned:            { icon: UserCheck,    bg: "bg-amber-100 dark:bg-amber-900/30",  color: "text-amber-600 dark:text-amber-400",  label: "Assigned"      },
  resolved:            { icon: CheckCircle2, bg: "bg-green-100 dark:bg-green-900/30",  color: "text-green-600 dark:text-green-400",  label: "Resolved"      },
  mentioned:           { icon: Bell,         bg: "bg-primary/10",                      color: "text-primary",                        label: "Mention"       },
};

interface NotificationPanelProps {
  /** Maximum items to show (default 5) */
  limit?: number;
  /** Compact mode hides the panel header */
  compact?: boolean;
  className?: string;
}

export function NotificationPanel({ limit = 5, compact = false, className }: NotificationPanelProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const prevUnreadRef = useRef<number | null>(null);

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: () => authFetch("/api/notifications"),
    enabled: !!user,
    refetchInterval: 20000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: () => authFetch("/api/notifications/unread-count"),
    enabled: !!user,
    refetchInterval: 20000,
  });

  /* ── Toast when new notifications arrive ───────────────────────── */
  useEffect(() => {
    const current = unreadData?.count ?? 0;
    if (prevUnreadRef.current !== null && current > prevUnreadRef.current) {
      const newest = notifications?.[0];
      toast({
        title: newest?.title ?? "New notification",
        description: newest?.message,
        duration: 4500,
      });
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
    prevUnreadRef.current = current;
  }, [unreadData?.count]);

  const markAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/mark-all-read"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const visible = notifications?.slice(0, limit) ?? [];
  const unread  = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <Badge
                className="h-4 min-w-[16px] text-[10px] px-1 bg-primary text-primary-foreground"
                data-testid="notif-unread-badge"
              >
                {unread}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                data-testid="button-mark-all-read-panel"
              >
                <CheckCheck className="w-3 h-3 mr-1" />
                Mark read
              </Button>
            )}
            <Link href="/notifications">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2">
                <ExternalLink className="w-3 h-3 mr-1" />
                View all
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg">
              <Skeleton className="w-7 h-7 rounded-md shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length > 0 ? (
        <AnimatePresence initial={false}>
          <div className="space-y-1">
            {visible.map((n, i) => {
              const meta = NOTIF_META[n.type] ?? NOTIF_META.mentioned;
              const Icon = meta.icon;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "group flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all",
                    !n.read
                      ? "bg-primary/5 border-primary/15 hover:bg-primary/8"
                      : "border-transparent hover:bg-muted/50"
                  )}
                  onClick={() => { if (!n.read) markOneMutation.mutate(n.id); }}
                  data-testid={`notif-item-${n.id}`}
                >
                  {/* Icon */}
                  <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", meta.bg)}>
                    <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1 justify-between">
                      <p className={cn("text-xs leading-snug truncate", !n.read ? "font-semibold" : "font-medium")}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      {n.complaintId && (
                        <Link href={`/complaints/${n.complaintId}`} onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                            View
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      ) : (
        <div className="py-6 flex flex-col items-center gap-2 text-center">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <Bell className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium">All caught up</p>
          <p className="text-[10px] text-muted-foreground">No notifications yet</p>
        </div>
      )}

      {/* Footer — compact mode shows full link + mark read */}
      {compact && (
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              data-testid="button-mark-all-read-compact"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          ) : <span />}
          <Link href="/notifications">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2">
              View all
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
