import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  User, Mail, Lock, Camera, Save, Eye, EyeOff,
  Loader2, CheckCircle2, Shield, AlertCircle, KeyRound,
  Trash2, UserX, TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, authFetch } from "@/lib/api";
import { getInitials } from "@/lib/utils";
import { useLocation } from "wouter";

const profileSchema = z.object({
  name:       z.string().min(2, "Name must be at least 2 characters"),
  email:      z.string().email("Enter a valid email address"),
  department: z.string().optional(),
  studentId:  z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword:     z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ProfileValues  = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

const ROLE_META: Record<string, { label: string; cls: string }> = {
  admin:   { label: "Admin",   cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  staff:   { label: "Staff",   cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  student: { label: "Student", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

export default function ProfilePage() {
  const { user: authUser, token, logout } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);

  // Delete account state
  const [deleteDialog, setDeleteDialog] = useState<"temporary" | "permanent" | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePass, setShowDeletePass] = useState(false);

  const { data, isLoading } = useQuery<{ user: any }>({
    queryKey: ["/api/user/profile"],
    queryFn: () => authFetch("/api/user/profile"),
  });

  const profile = data?.user ?? authUser;
  const roleMeta = ROLE_META[profile?.role ?? "student"];

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name:       profile?.name       ?? "",
      email:      profile?.email      ?? "",
      department: profile?.department ?? "",
      studentId:  profile?.studentId  ?? "",
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const updateProfile = useMutation({
    mutationFn: (body: ProfileValues) => apiRequest("PUT", "/api/user/profile/update", body),
    onSuccess: (data: any) => {
      qc.setQueryData(["/api/user/profile"], { user: data.user });
      localStorage.setItem("unicore_user", JSON.stringify(data.user));
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const updatePassword = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiRequest("PUT", "/api/user/profile/password", body),
    onSuccess: () => {
      passwordForm.reset();
      toast({ title: "Password updated", description: "Your new password is active." });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch("/api/user/profile/photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      qc.setQueryData(["/api/user/profile"], { user: data.user });
      localStorage.setItem("unicore_user", JSON.stringify(data.user));
      toast({ title: "Photo updated", description: "Your profile photo has been changed." });
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const deleteAccount = useMutation({
    mutationFn: ({ type, password }: { type: "temporary" | "permanent"; password: string }) =>
      apiRequest("DELETE", "/api/user/account", { type, password }),
    onSuccess: (data: any) => {
      toast({ title: data.message });
      logout();
      setLocation("/login");
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleDeleteConfirm = () => {
    if (!deleteDialog || !deletePassword) return;
    deleteAccount.mutate({ type: deleteDialog, password: deletePassword });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    uploadPhoto.mutate(file);
  };

  const onProfileSubmit = (data: ProfileValues) => {
    updateProfile.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordValues) => {
    updatePassword.mutate({ currentPassword: data.currentPassword, newPassword: data.newPassword });
  };

  const photoSrc = previewUrl ?? profile?.profilePhoto ?? undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account information and security settings.</p>
      </motion.div>

      {/* ── Photo + Identity ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card border rounded-xl p-6"
      >
        <div className="flex items-center gap-5">
          <div className="relative group">
            <Avatar className="w-20 h-20 ring-2 ring-border ring-offset-2" data-testid="avatar-profile">
              <AvatarImage src={photoSrc} alt={profile?.name} />
              <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                {getInitials(profile?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadPhoto.isPending}
              data-testid="button-upload-photo"
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Change photo"
            >
              {uploadPhoto.isPending
                ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                : <Camera className="w-5 h-5 text-white" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              data-testid="input-photo-file"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg font-semibold truncate" data-testid="text-profile-name">{profile?.name}</p>
              <Badge className={`text-[10px] px-1.5 py-0.5 font-semibold shrink-0 ${roleMeta.cls}`}>
                {roleMeta.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 truncate" data-testid="text-profile-email">{profile?.email}</p>
            <div className="flex items-center gap-1.5 mt-2">
              {profile?.emailVerified ? (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3" /> Email verified
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3 h-3" /> Email not verified
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" />
          Click the photo to upload a new one. JPG, PNG or WebP, max 5 MB.
        </p>
      </motion.div>

      {/* ── Profile details form ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold">Personal Information</h2>
        </div>

        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Jane Doe"
                          className="pl-9"
                          data-testid="input-profile-name"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="you@university.edu"
                          className="pl-9"
                          data-testid="input-profile-email"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {profile?.role === "student" && (
              <FormField
                control={profileForm.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student ID <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. S2024001" data-testid="input-profile-student-id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(profile?.role === "staff" || profile?.role === "admin") && (
              <FormField
                control={profileForm.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Information Technology" data-testid="input-profile-department" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button
              type="submit"
              disabled={updateProfile.isPending}
              className="w-full sm:w-auto"
              data-testid="button-save-profile"
            >
              {updateProfile.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
            </Button>
          </form>
        </Form>
      </motion.div>

      {/* ── Change Password ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-card border rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <KeyRound className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold">Change Password</h2>
        </div>

        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <FormField
              control={passwordForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showCurrent ? "text" : "password"}
                        placeholder="Your current password"
                        className="pl-9 pr-10"
                        data-testid="input-current-password"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showNew ? "text" : "password"}
                          placeholder="Min. 6 characters"
                          className="pl-9 pr-10"
                          data-testid="input-new-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showConfirm ? "text" : "password"}
                          placeholder="Repeat new password"
                          className="pl-9 pr-10"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              variant="outline"
              disabled={updatePassword.isPending}
              className="w-full sm:w-auto"
              data-testid="button-change-password"
            >
              {updatePassword.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</>
                : <><Shield className="w-4 h-4 mr-2" />Update Password</>}
            </Button>
          </form>
        </Form>
      </motion.div>

      {/* ── Delete Account ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-red-200 dark:border-red-900/50 rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <TriangleAlert className="w-4 h-4 text-red-500" />
          <h2 className="text-base font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          These actions are irreversible. Please be certain before proceeding.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
            data-testid="button-deactivate-account"
            onClick={() => { setDeletePassword(""); setDeleteDialog("temporary"); }}
          >
            <UserX className="w-4 h-4 mr-2" />
            Deactivate Account
          </Button>
          <Button
            variant="outline"
            className="border-red-400 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            data-testid="button-delete-account"
            onClick={() => { setDeletePassword(""); setDeleteDialog("permanent"); }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Permanently
          </Button>
        </div>
      </motion.div>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────── */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteDialog === "permanent"
                ? <><Trash2 className="w-5 h-5 text-red-500" /> Delete Account Permanently</>
                : <><UserX className="w-5 h-5 text-amber-500" /> Deactivate Account</>}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deleteDialog === "permanent" ? (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                    <strong>This cannot be undone.</strong> Your account, all complaints, comments, and uploaded files will be permanently erased from our database.
                  </div>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
                    Your account will be deactivated and you won't be able to log in. An administrator can restore it later.
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-1.5">Enter your password to confirm:</p>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showDeletePass ? "text" : "password"}
                      placeholder="Your password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      data-testid="input-delete-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePass((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showDeletePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteDialog(null); setDeletePassword(""); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!deletePassword || deleteAccount.isPending}
              onClick={handleDeleteConfirm}
              className={deleteDialog === "permanent"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-white"}
              data-testid="button-confirm-delete"
            >
              {deleteAccount.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                : deleteDialog === "permanent" ? "Yes, delete forever" : "Yes, deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
