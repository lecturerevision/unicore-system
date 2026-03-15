import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; positive: boolean };
  index?: number;
}

export function StatsCard({
  title, value, subtitle, icon: Icon, iconColor, iconBg, trend, index = 0,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
    >
      <Card className="border-card-border">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                {title}
              </p>
              <p className="text-2xl font-bold tracking-tight" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
                {value}
              </p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
              {trend !== undefined && (
                <p className={cn(
                  "text-xs font-medium mt-1.5",
                  trend.positive ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                )}>
                  {trend.positive ? "+" : "-"}{trend.value}% vs last month
                </p>
              )}
            </div>
            <div className={cn(
              "w-10 h-10 rounded-md flex items-center justify-center shrink-0",
              iconBg ?? "bg-primary/10"
            )}>
              <Icon className={cn("w-5 h-5", iconColor ?? "text-primary")} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
