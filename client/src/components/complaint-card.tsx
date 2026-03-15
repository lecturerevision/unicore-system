import { Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare, Paperclip, Clock, ChevronRight, AlertCircle
} from "lucide-react";
import {
  cn, statusColors, priorityColors, statusLabels, priorityLabels,
  categoryLabels, timeAgo, getInitials,
} from "@/lib/utils";
import type { ComplaintWithDetails } from "@shared/schema";

interface ComplaintCardProps {
  complaint: ComplaintWithDetails;
  index?: number;
}

export function ComplaintCard({ complaint, index = 0 }: ComplaintCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link href={`/complaints/${complaint.id}`}>
        <Card
          className="group cursor-pointer hover-elevate border-card-border transition-all"
          data-testid={`card-complaint-${complaint.id}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-xs font-mono text-muted-foreground font-medium">
                    {complaint.ticketId}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn("text-xs font-medium", statusColors[complaint.status])}
                  >
                    {statusLabels[complaint.status]}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={cn("text-xs font-medium", priorityColors[complaint.priority])}
                  >
                    {complaint.priority === "urgent" && <AlertCircle className="w-3 h-3 mr-1" />}
                    {priorityLabels[complaint.priority]}
                  </Badge>
                  {complaint.category && (
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[complaint.category]}
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                  {complaint.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {complaint.description}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-card-border">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{timeAgo(complaint.createdAt)}</span>
                </div>
                {(complaint._count?.comments ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>{complaint._count?.comments}</span>
                  </div>
                )}
                {(complaint._count?.attachments ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    <span>{complaint._count?.attachments}</span>
                  </div>
                )}
                {complaint.department && (
                  <span className="text-muted-foreground truncate max-w-28">
                    {complaint.department.name}
                  </span>
                )}
              </div>
              {complaint.student && (
                <div className="flex items-center gap-1.5">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                      {getInitials(complaint.student.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate max-w-20">
                    {complaint.student.name}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
