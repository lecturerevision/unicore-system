export const TOKEN_KEY  = "unicore_token";
export const USER_KEY   = "unicore_user";

export const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  assigned:    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  resolved:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed:      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export const CATEGORY_COLORS: Record<string, string> = {
  academic:       "#6366f1",
  financial:      "#f59e0b",
  facilities:     "#10b981",
  administrative: "#3b82f6",
  library:        "#8b5cf6",
  hostel:         "#ef4444",
  sports:         "#f97316",
  it_support:     "#06b6d4",
  health:         "#ec4899",
  other:          "#6b7280",
};

export const DEPARTMENT_CHART_COLORS = [
  "#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899",
];

export const MAX_COMMENT_LENGTH = 2000;
export const MAX_FILE_SIZE_MB   = 10;
export const MAX_FILES_UPLOAD   = 5;
