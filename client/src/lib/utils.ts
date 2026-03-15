import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(date: string | Date) {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export const statusColors: Record<string, string> = {
  pending:     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  assigned:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  in_progress: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  resolved:    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  closed:      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export const priorityColors: Record<string, string> = {
  low: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export const categoryLabels: Record<string, string> = {
  academic: "Academic",
  financial: "Financial",
  facilities: "Facilities",
  administrative: "Administrative",
  library: "Library",
  hostel: "Hostel",
  sports: "Sports",
  it_support: "IT Support",
  health: "Health",
  other: "Other",
};

export const statusLabels: Record<string, string> = {
  pending:     "Pending",
  assigned:    "Assigned",
  in_progress: "In Progress",
  resolved:    "Resolved",
  closed:      "Closed",
};

export const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function getRoleColor(role: string) {
  switch (role) {
    case "admin": return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    case "staff": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    default: return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  }
}
