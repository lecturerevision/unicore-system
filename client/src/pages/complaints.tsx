import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ComplaintCard } from "@/components/complaint-card";
import { MessageSquarePlus, Search, Filter, ClipboardList, X, AlertCircle } from "lucide-react";
import { categoryLabels, statusLabels, priorityLabels } from "@/lib/utils";
import type { ComplaintWithDetails } from "@shared/schema";

export default function ComplaintsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status !== "all") params.set("status", status);
  if (category !== "all") params.set("category", category);
  if (priority !== "all") params.set("priority", priority);

  const { data: complaints, isLoading, isError, error, refetch } = useQuery<ComplaintWithDetails[]>({
    queryKey: ["/api/complaints", search, status, category, priority],
    queryFn: () => authFetch(`/api/complaints?${params.toString()}`),
    enabled: !!user,
  });

  const hasFilters = search || status !== "all" || category !== "all" || priority !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setCategory("all");
    setPriority("all");
  };

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
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 flex-wrap"
        >
          <div>
            <h1 className="text-2xl font-bold">
              {user?.role === "student" ? "My Complaints" : "All Complaints"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {complaints ? `${complaints.length} complaint${complaints.length !== 1 ? "s" : ""}` : "Loading..."}
            </p>
          </div>
          {(user?.role === "student" || user?.role === "admin") && (
            <Button asChild data-testid="button-new-complaint">
              <Link href="/complaints/new">
                <MessageSquarePlus className="w-4 h-4 mr-2" />
                New Complaint
              </Link>
            </Button>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-2 items-center"
        >
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search complaints..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" data-testid="select-status-filter">
              <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40" data-testid="select-category-filter">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-36" data-testid="select-priority-filter">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {Object.entries(priorityLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              <X className="w-3.5 h-3.5 mr-1.5" />
              Clear
            </Button>
          )}
        </motion.div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="border-card-border">
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : complaints && complaints.length > 0 ? (
          <div className="space-y-3">
            {complaints.map((c, i) => (
              <ComplaintCard key={c.id} complaint={c} index={i} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-card-border">
              <CardContent className="p-16 text-center">
                <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-semibold text-lg">
                  {hasFilters ? "No matching complaints" : "No complaints found"}
                </p>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {hasFilters
                    ? "Try adjusting your filters"
                    : user?.role === "student"
                    ? "You haven't submitted any complaints yet."
                    : "No complaints to show."}
                </p>
                {!hasFilters && user?.role === "student" && (
                  <Button className="mt-5" asChild>
                    <Link href="/complaints/new">Submit your first complaint</Link>
                  </Button>
                )}
                {hasFilters && (
                  <Button variant="outline" className="mt-5" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
