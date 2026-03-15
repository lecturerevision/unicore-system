import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch, apiRequest } from "@/lib/api";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck, MessageSquare, Tag, ArrowUpRight, Info, AlertCircle } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import type { Notification } from "@shared/schema";

const notifIcons: Record<string, typeof Bell> = {
  complaint_submitted: Tag,
  status_changed: Info,
  comment_added: MessageSquare,
  assigned: ArrowUpRight,
  resolved: CheckCheck,
  mentioned: Bell,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notifications, isLoading, isError, error, refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: () => authFetch("/api/notifications"),
    enabled: !!user,
  });

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

  const unread = notifications?.filter((n) => !n.read).length ?? 0;

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
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 flex-wrap"
        >
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unread > 0 ? `${unread} unread notification${unread !== 1 ? "s" : ""}` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              Mark all read
            </Button>
          )}
        </motion.div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="border-card-border">
                <CardContent className="p-4 flex gap-3">
                  <Skeleton className="w-9 h-9 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-2">
            {notifications.map((n, i) => {
              const Icon = notifIcons[n.type] ?? Bell;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card
                    className={cn(
                      "border-card-border cursor-pointer transition-all",
                      !n.read && "bg-primary/5 border-primary/20"
                    )}
                    onClick={() => {
                      if (!n.read) markOneMutation.mutate(n.id);
                    }}
                    data-testid={`notification-${n.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
                          !n.read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-1.5">{timeAgo(n.createdAt)}</p>
                        </div>
                      </div>
                      {n.complaintId && (
                        <div className="mt-2 ml-12">
                          <Link href={`/complaints/${n.complaintId}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                              View complaint
                              <ArrowUpRight className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card className="border-card-border">
            <CardContent className="p-16 text-center">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-semibold text-lg">No notifications</p>
              <p className="text-sm text-muted-foreground mt-1.5">You're all caught up!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
