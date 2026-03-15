import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { activityLogs, users } from "@shared/schema";
import { desc, eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { sendVerificationEmail } from "./email";
import {
  generateToken,
  requireAuth,
  requireRole,
  requireStaff,
  requireAdmin,
  type AuthRequest,
} from "./middleware/auth";

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function toParamValue(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? "";
  return param ?? "";
}

// ─── File upload config ───────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx",           // documents
  ".jpg", ".jpeg", ".png", ".gif", ".webp", // images
  ".txt", ".csv",                    // text
  ".xlsx", ".xls",                   // spreadsheets
  ".ppt", ".pptx",                   // presentations
  ".zip", ".rar",                    // archives
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "text/plain", "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip", "application/x-rar-compressed",
]);

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext       = path.extname(file.originalname).toLowerCase();
    const unique    = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${ext}`);
  },
});

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.originalname}. Allowed: images, PDF, Word, Excel, PowerPoint, ZIP`));
  }
}

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },   // 10 MB per file, max 5
  fileFilter,
});

const uploadSingle = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter,
});

// ─── Profile photo upload config ──────────────────────────────────────────────
const PROFILE_PHOTO_DIR = path.join(process.cwd(), "uploads", "profile_photos");
if (!fs.existsSync(PROFILE_PHOTO_DIR)) fs.mkdirSync(PROFILE_PHOTO_DIR, { recursive: true });

const profilePhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROFILE_PHOTO_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext) || ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG and WebP images are allowed for profile photos"));
    }
  },
});

/** Non-blocking activity log helper */
async function logActivity(opts: {
  userId: string | null;
  complaintId: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await storage.createActivityLog({
      userId: opts.userId,
      complaintId: opts.complaintId,
      action: opts.action,
      description: opts.description,
      metadata: opts.metadata ?? null,
    });
  } catch { /* non-critical */ }
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: "Too many login attempts, please try again after 15 minutes" },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { message: "Too many registration attempts, please try again after an hour" },
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/auth/register
   * Public — creates a new user account, sends verification email.
   * Body: { name, email, password, role?, department?, studentId? }
   */
  app.post("/api/auth/register", registerLimiter, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name:       z.string().min(2, "Name must be at least 2 characters"),
        email:      z.string().email("Invalid email address"),
        password:   z.string().min(6, "Password must be at least 6 characters"),
        role:       z.enum(["student", "staff", "admin"]).optional().default("student"),
        department: z.string().optional(),
        studentId:  z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

      const { name, email, password, role, department, studentId } = parsed.data;

      if (await storage.getUserByEmail(email)) {
        return res.status(409).json({ message: "Email is already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const user = await storage.createUser({
        name, email,
        password: hashedPassword,
        role,
        department: department ?? null,
        studentId:  studentId  ?? null,
        avatar: null,
      });

      await storage.setVerificationCode(user.id, code, expiresAt);

      const emailResult = await sendVerificationEmail(email, name, code);

      const { password: _, ...safeUser } = user;

      return res.status(201).json({
        message: "Registration successful. Please verify your email.",
        emailSent: emailResult.sent,
        ...(process.env.NODE_ENV !== "production" && emailResult.devCode ? { devCode: emailResult.devCode } : {}),
        user: { ...safeUser, emailVerified: false },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Registration failed" });
    }
  });

  /**
   * POST /api/auth/verify-email
   * Public — verifies the 6-digit code sent during registration.
   * Body: { email, code }
   */
  app.post("/api/auth/verify-email", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        code:  z.string().length(6),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten().fieldErrors });
      }

      const { email, code } = parsed.data;
      const user = await storage.verifyEmailCode(email, code);

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }

      await storage.markEmailVerified(user.id);

      const freshUser = await storage.getUser(user.id);
      const token = generateToken(freshUser!);
      const { password: _, ...safeUser } = freshUser!;

      return res.json({ message: "Email verified successfully. You are now logged in.", token, user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Verification failed" });
    }
  });

  /**
   * POST /api/auth/resend-verification
   * Public — resends a new verification code to the user's email.
   * Body: { email }
   */
  app.post("/api/auth/resend-verification", registerLimiter, async (req: Request, res: Response) => {
    try {
      const schema = z.object({ email: z.string().email() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid email" });

      const user = await storage.getUserByEmail(parsed.data.email);
      if (!user) return res.status(404).json({ message: "No account found with that email" });
      if (user.emailVerified) return res.status(400).json({ message: "Email is already verified" });

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.setVerificationCode(user.id, code, expiresAt);

      const emailResult = await sendVerificationEmail(user.email, user.name, code);

      return res.json({
        message: "A new verification code has been sent.",
        emailSent: emailResult.sent,
        ...(process.env.NODE_ENV !== "production" && emailResult.devCode ? { devCode: emailResult.devCode } : {}),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to resend verification" });
    }
  });

  /**
   * POST /api/auth/login
   * Public — validates credentials and returns a signed JWT.
   * Body: { email, password }
   */
  app.post("/api/auth/login", loginLimiter, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email:    z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

      const { email, password } = parsed.data;

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });

      if (!user.isActive) {
        return res.status(403).json({ message: "Your account has been suspended. Please contact an administrator." });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) return res.status(401).json({ message: "Invalid email or password" });

      if (!user.emailVerified) {
        return res.status(403).json({
          message: "Please verify your email before logging in.",
          requiresVerification: true,
          email: user.email,
        });
      }

      const token = generateToken(user);
      const { password: _, ...safeUser } = user;

      return res.json({ message: "Login successful", token, user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Login failed" });
    }
  });

  /**
   * GET /api/auth/profile
   * Protected — returns the current user's full profile.
   */
  app.get("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = user;
      return res.json({ user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch profile" });
    }
  });

  /**
   * PUT /api/user/profile/update
   * Protected — updates name, email, and department/studentId.
   * Body: { name?, email?, department?, studentId? }
   */
  app.put("/api/user/profile/update", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;

      const schema = z.object({
        name:       z.string().min(2, "Name must be at least 2 characters").optional(),
        email:      z.string().email("Invalid email address").optional(),
        department: z.string().optional(),
        studentId:  z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });

      if (parsed.data.email) {
        const existing = await storage.getUserByEmail(parsed.data.email);
        if (existing && existing.id !== userId) {
          return res.status(409).json({ message: "That email address is already in use" });
        }
      }

      const updated = await storage.updateUser(userId, parsed.data);
      if (!updated) return res.status(404).json({ message: "User not found" });

      const { password: _, ...safeUser } = updated;
      return res.json({ message: "Profile updated successfully", user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Profile update failed" });
    }
  });

  /**
   * PUT /api/user/profile/password
   * Protected — changes the current user's password.
   * Body: { currentPassword, newPassword }
   */
  app.put("/api/user/profile/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;

      const schema = z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword:     z.string().min(6, "New password must be at least 6 characters"),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const match = await bcrypt.compare(parsed.data.currentPassword, user.password);
      if (!match) return res.status(401).json({ message: "Current password is incorrect" });

      const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
      await storage.updatePassword(userId, hashed);

      return res.json({ message: "Password updated successfully" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Password update failed" });
    }
  });

  /**
   * POST /api/user/profile/photo
   * Protected — upload / replace profile photo. Returns the URL of the saved file.
   */
  app.post("/api/user/profile/photo", requireAuth, uploadProfilePhoto.single("photo"), async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const photoPath = `/uploads/profile_photos/${req.file.filename}`;
      const updated = await storage.updateUser(userId, { profilePhoto: photoPath });
      if (!updated) return res.status(404).json({ message: "User not found" });

      const { password: _, ...safeUser } = updated;
      return res.json({ message: "Profile photo updated", photoUrl: photoPath, user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Photo upload failed" });
    }
  });

  /**
   * GET /api/user/profile
   * Alias for /api/auth/profile — returns current user.
   */
  app.get("/api/user/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = user;
      return res.json({ user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch profile" });
    }
  });

  /**
   * PATCH /api/auth/profile
   * Protected (legacy alias) — kept for backward compatibility.
   */
  app.patch("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;
      const schema = z.object({
        name:       z.string().min(2).optional(),
        department: z.string().optional(),
        studentId:  z.string().optional(),
        avatar:     z.string().url().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      const updated = await storage.updateUser(userId, parsed.data);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = updated;
      return res.json({ message: "Profile updated", user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Profile update failed" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT (admin only)
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/users", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const all = await storage.getUsers();
      return res.json(all.map(({ password, ...u }) => u));
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch users" });
    }
  });

  /** GET /api/users/staff — staff + admin list (for assignment dropdowns) */
  app.get("/api/users/staff", requireAuth, async (_req: Request, res: Response) => {
    try {
      return res.json(await storage.getStaffUsers());
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch staff" });
    }
  });

  /** PATCH /api/users/:id/role — change a user's role (admin only) */
  app.patch("/api/users/:id/role", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userIdParam = Array.isArray(id) ? id[0] : id;

      const schema = z.object({
        role: z.enum(["student", "staff", "admin"]),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { role } = parsed.data;
      const user = await storage.updateUserRole(userIdParam, role);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to update role" });
    }
  });

  /** PATCH /api/users/:id/suspend — suspend or unsuspend a user (admin only) */
  app.patch("/api/users/:id/suspend", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;
      const { id } = req.params;
      const userIdParam = Array.isArray(id) ? id[0] : id;

      if (userIdParam === userId) {
        return res.status(400).json({ message: "You cannot suspend yourself" });
      }

      const schema = z.object({
        isActive: z.boolean(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { isActive } = parsed.data;
      const user = await storage.toggleUserSuspension(userIdParam, isActive);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      return res.json(safeUser);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to update suspension status" });
    }
  });

  /**
   * DELETE /api/user/account
   * Authenticated user deletes their own account.
   * Body: { type: "temporary" | "permanent", password: string }
   */
  app.delete("/api/user/account", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;
      const schema = z.object({
        type: z.enum(["temporary", "permanent"]),
        password: z.string().min(1, "Password is required to confirm deletion"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Verify password before allowing deletion
      const passwordOk = await bcrypt.compare(parsed.data.password, user.password);
      if (!passwordOk) return res.status(401).json({ message: "Incorrect password" });

      // Block demo accounts from being deleted
      const demoEmails = ["admin@university.edu", "staff@university.edu", "student@university.edu"];
      if (demoEmails.includes(user.email)) {
        return res.status(403).json({ message: "Demo accounts cannot be deleted" });
      }

      if (parsed.data.type === "temporary") {
        await storage.softDeleteUser(userId);
        return res.json({ message: "Your account has been deactivated. Contact support to restore it." });
      } else {
        await storage.hardDeleteUser(userId);
        return res.json({ message: "Your account and all associated data have been permanently deleted." });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to delete account" });
    }
  });

  /**
   * DELETE /api/admin/users/:id
   * Admin deletes any user account.
   * Body: { type: "temporary" | "permanent" }
   */
  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId: adminId } = req as AuthRequest;
      const targetId = toParamValue(req.params.id);

      if (targetId === adminId) {
        return res.status(400).json({ message: "You cannot delete your own account from here. Use the profile page." });
      }

      const schema = z.object({ type: z.enum(["temporary", "permanent"]) });
      const rawType = req.body?.type ?? req.query?.type;
      const parsed = schema.safeParse({ type: rawType });
      if (!parsed.success) {
        return res.status(400).json({ message: "Specify type: temporary or permanent" });
      }

      const target = await storage.getUser(targetId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const demoEmails = ["admin@university.edu", "staff@university.edu", "student@university.edu"];
      if (demoEmails.includes(target.email)) {
        return res.status(403).json({ message: "Demo accounts cannot be deleted" });
      }

      if (parsed.data.type === "temporary") {
        await storage.softDeleteUser(targetId);
        return res.json({ message: `${target.name}'s account has been deactivated.`, type: "temporary" });
      } else {
        await storage.hardDeleteUser(targetId);
        return res.json({ message: `${target.name}'s account and all data have been permanently deleted.`, type: "permanent" });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to delete user" });
    }
  });

  /**
   * PATCH /api/admin/users/:id/restore
   * Admin restores a temporarily deactivated user.
   */
  app.patch("/api/admin/users/:id/restore", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const targetId = toParamValue(req.params.id);
      const user = await storage.restoreUser(targetId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      return res.json({ message: `${user.name}'s account has been restored.`, user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to restore user" });
    }
  });

  /** GET /api/activity-logs — system-wide activity log (admin only) */
  app.get("/api/activity-logs", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        limit: z.preprocess((val) => parseInt(val as string, 10), z.number().min(1).max(200).default(50)),
      });

      const queryParsed = querySchema.safeParse(req.query);
      const limit = queryParsed.success ? queryParsed.data.limit : 50;

      const logs = await db
        .select({
          id: activityLogs.id,
          action: activityLogs.action,
          description: activityLogs.description,
          metadata: activityLogs.metadata,
          createdAt: activityLogs.createdAt,
          userId: activityLogs.userId,
          complaintId: activityLogs.complaintId,
          userName: users.name,
          userEmail: users.email,
          userRole: users.role,
        })
        .from(activityLogs)
        .leftJoin(users, eq(activityLogs.userId, users.id))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
      return res.json(logs);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch activity logs" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DEPARTMENTS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/departments", requireAuth, async (_req: Request, res: Response) => {
    try {
      return res.json(await storage.getDepartments());
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        code: z.string().min(2, "Code must be at least 2 characters"),
        description: z.string().optional(),
        headName: z.string().optional(),
        email: z.string().email("Invalid email address").optional().or(z.literal("")),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { name, code, description, headName, email } = parsed.data;
      return res.json(await storage.createDepartment({ name, code, description, headName, email: email || null }));
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to create department" });
    }
  });

  app.delete("/api/departments/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deptIdParam = Array.isArray(id) ? id[0] : id;
      await storage.deleteDepartment(deptIdParam);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to delete department" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // COMPLAINTS
  // ══════════════════════════════════════════════════════════════════════════

  /** GET /api/complaints — students see only their own; staff/admin see all */
  app.get("/api/complaints", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, userRole } = req as AuthRequest;

      const querySchema = z.object({
        status: z.enum(["pending", "assigned", "in_progress", "resolved", "closed"]).optional(),
        category: z.enum(["academic", "financial", "facilities", "administrative", "library", "hostel", "sports", "it_support", "health", "other"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        search: z.string().optional(),
      });

      const queryParsed = querySchema.safeParse(req.query);
      if (!queryParsed.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: queryParsed.error.flatten().fieldErrors,
        });
      }

      const { status, category, priority, search } = queryParsed.data;

      const filter: Record<string, string> = {};
      if (userRole === "student") filter.studentId = userId as string;
      if (status)   filter.status   = status;
      if (category) filter.category = category;
      if (priority) filter.priority = priority;
      if (search)   filter.search   = search;

      return res.json(await storage.getComplaints(filter));
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch complaints" });
    }
  });

  /** POST /api/complaints — students and admins submit complaints */
  app.post("/api/complaints", requireAuth, upload.array("files", 5), async (req: Request, res: Response) => {
    try {
      const { userId, userRole } = req as AuthRequest;

      if (userRole === "staff") {
        return res.status(403).json({ message: "Staff cannot submit complaints" });
      }

      const { title, description, category, priority, departmentId } = req.body;

      if (!title || !description || !category) {
        return res.status(400).json({ message: "Title, description, and category are required" });
      }

      const complaint = await storage.createComplaint({
        title, description, category,
        priority:        priority || "medium",
        status:          "pending",
        departmentId:    departmentId || null,
        studentId:       userId,
        assignedStaff:   null,
        resolutionNotes: null,
      });

      // Save attachments
      const files = req.files as Express.Multer.File[];
      if (files?.length) {
        for (const f of files) {
          await storage.createAttachment({
            complaintId:  complaint.id,
            filename:     f.filename,
            originalName: f.originalname,
            mimeType:     f.mimetype,
            size:         f.size,
            uploadedById: userId,
          });
        }
      }

      await logActivity({
        userId,
        complaintId: complaint.id,
        action: "complaint_created",
        description: `Complaint submitted: "${title}"`,
        metadata: { ticketId: complaint.ticketId, category, priority },
      });

      // Notify all staff / admin
      const staffUsers = await storage.getStaffUsers();
      for (const s of staffUsers) {
        if (s.id && s.id !== userId) {
          await storage.createNotification({
            userId: s.id,
            type: "complaint_submitted",
            title: "New Complaint Submitted",
            message: `Ticket ${complaint.ticketId}: ${title}`,
            read: false,
            complaintId: complaint.id,
          });
        }
      }

      return res.status(201).json(complaint);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Submission failed" });
    }
  });

  /** GET /api/complaints/:id */
  app.get("/api/complaints/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, userRole } = req as AuthRequest;
      const complaintId = toParamValue(req.params.id);
      const complaint = await storage.getComplaint(complaintId);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      if (userRole === "student" && complaint.studentId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      return res.json(complaint);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch complaint" });
    }
  });

  /** PATCH /api/complaints/:id — staff and admin only */
  app.patch("/api/complaints/:id", requireAuth, requireStaff, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;
      const complaintId = toParamValue(req.params.id);
      const complaint = await storage.getComplaint(complaintId);
      if (!complaint) return res.status(404).json({ message: "Not found" });

      const { status, priority, assignedStaff, departmentId, resolutionNotes } = req.body;
      const update: Record<string, unknown> = {};
      if (status          !== undefined) update.status          = status;
      if (priority        !== undefined) update.priority        = priority;
      if (assignedStaff   !== undefined) {
        update.assignedStaff = assignedStaff || null;
        if (assignedStaff && assignedStaff !== complaint.assignedStaff) update.assignedAt = new Date();
      }
      if (departmentId    !== undefined) update.departmentId    = departmentId    || null;
      if (resolutionNotes !== undefined) update.resolutionNotes = resolutionNotes;

      const updated = await storage.updateComplaint(complaintId, update as any);

      // Activity log entry
      const changes: string[] = [];
      if (status          !== undefined && status   !== complaint.status)   changes.push(`status → ${status}`);
      if (priority        !== undefined && priority !== complaint.priority) changes.push(`priority → ${priority}`);
      if (assignedStaff   !== undefined) changes.push("assigned staff updated");
      if (departmentId    !== undefined) changes.push("department updated");
      if (resolutionNotes !== undefined) changes.push("resolution notes updated");

      if (changes.length > 0) {
        await logActivity({
          userId,
          complaintId,
          action: "complaint_updated",
          description: changes.join(", "),
          metadata: update,
        });
      }

      // Notify student on status change
      if (status && status !== complaint.status && complaint.studentId && complaint.studentId !== userId) {
        const isResolved = status === "resolved" || status === "closed";
        await storage.createNotification({
          userId: complaint.studentId,
          type: isResolved ? "resolved" : "status_changed",
          title: isResolved ? "Your Complaint Has Been Resolved" : "Complaint Status Updated",
          message: isResolved
            ? `Ticket ${complaint.ticketId} has been marked as ${status}. Thank you for your patience.`
            : `Ticket ${complaint.ticketId} status changed to "${status.replace(/_/g, " ")}"`,
          read: false,
          complaintId: complaint.id,
        });
      }

      // Notify newly assigned staff
      if (assignedStaff && assignedStaff !== complaint.assignedStaff) {
        await storage.createNotification({
          userId: assignedStaff,
          type: "assigned",
          title: "Complaint Assigned to You",
          message: `Ticket ${complaint.ticketId}: "${complaint.title}" has been assigned to you`,
          read: false,
          complaintId: complaint.id,
        });
        // Also notify the student their complaint is being worked on
        if (complaint.studentId && complaint.studentId !== userId) {
          await storage.createNotification({
            userId: complaint.studentId,
            type: "assigned",
            title: "Complaint Being Reviewed",
            message: `Ticket ${complaint.ticketId} has been assigned to a staff member and is under review`,
            read: false,
            complaintId: complaint.id,
          });
        }
      }

      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to update complaint" });
    }
  });

  /**
   * PUT /api/complaints/:id
   * Staff / Admin — full complaint update.
   * Accepts the same fields as PATCH but intended for complete replacement of
   * mutable fields: status, priority, assignedStaff, departmentId, resolutionNotes.
   * Students cannot update complaints via this endpoint.
   */
  app.put("/api/complaints/:id", requireAuth, requireStaff, async (req, res) => {
    try {
      const { userId } = req as AuthRequest;
      const complaintId = toParamValue(req.params.id);
      const complaint = await storage.getComplaint(complaintId);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      const schema = z.object({
        status:          z.enum(["pending", "assigned", "in_progress", "resolved", "closed"]).optional(),
        priority:        z.enum(["low", "medium", "high", "urgent"]).optional(),
        assignedStaff:   z.string().nullable().optional(),
        departmentId:    z.string().nullable().optional(),
        resolutionNotes: z.string().nullable().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const data = parsed.data;
      const update: Record<string, unknown> = {};
      if (data.status          !== undefined) update.status          = data.status;
      if (data.priority        !== undefined) update.priority        = data.priority;
      if (data.assignedStaff   !== undefined) {
        update.assignedStaff = data.assignedStaff ?? null;
        if (data.assignedStaff && data.assignedStaff !== complaint.assignedStaff) update.assignedAt = new Date();
      }
      if (data.departmentId    !== undefined) update.departmentId    = data.departmentId    ?? null;
      if (data.resolutionNotes !== undefined) update.resolutionNotes = data.resolutionNotes ?? null;

      const updated = await storage.updateComplaint(complaintId, update as any);

      const changes: string[] = [];
      if (data.status        && data.status    !== complaint.status)   changes.push(`status → ${data.status}`);
      if (data.priority      && data.priority  !== complaint.priority) changes.push(`priority → ${data.priority}`);
      if (data.assignedStaff !== undefined) changes.push("assigned staff updated");
      if (data.departmentId  !== undefined) changes.push("department updated");
      if (data.resolutionNotes !== undefined) changes.push("resolution notes updated");

      if (changes.length > 0) {
        await logActivity({
          userId,
          complaintId,
          action: "complaint_updated",
          description: `[PUT] ${changes.join(", ")}`,
          metadata: update,
        });
      }

      // Notify student on status change
      if (data.status && data.status !== complaint.status && complaint.studentId && complaint.studentId !== userId) {
        const isResolved = data.status === "resolved" || data.status === "closed";
        await storage.createNotification({
          userId: complaint.studentId,
          type: isResolved ? "resolved" : "status_changed",
          title: isResolved ? "Your Complaint Has Been Resolved" : "Complaint Status Updated",
          message: isResolved
            ? `Ticket ${complaint.ticketId} has been marked as ${data.status}. Thank you for your patience.`
            : `Ticket ${complaint.ticketId} status changed to "${data.status.replace(/_/g, " ")}"`,
          read: false,
          complaintId: complaint.id,
        });
      }

      // Notify newly assigned staff
      if (data.assignedStaff && data.assignedStaff !== complaint.assignedStaff) {
        await storage.createNotification({
          userId: data.assignedStaff,
          type: "assigned",
          title: "Complaint Assigned to You",
          message: `Ticket ${complaint.ticketId}: "${complaint.title}" has been assigned to you`,
          read: false,
          complaintId: complaint.id,
        });
        // Also notify the student their complaint is being worked on
        if (complaint.studentId && complaint.studentId !== userId) {
          await storage.createNotification({
            userId: complaint.studentId,
            type: "assigned",
            title: "Complaint Being Reviewed",
            message: `Ticket ${complaint.ticketId} has been assigned to a staff member and is under review`,
            read: false,
            complaintId: complaint.id,
          });
        }
      }

      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  /**
   * DELETE /api/complaints/:id
   * Admin only — soft-deletes a complaint (is_deleted = true).
   */
  app.delete("/api/complaints/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req as AuthRequest;
      const complaintId = toParamValue(req.params.id);
      const complaint = await storage.getComplaint(complaintId);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      await storage.deleteComplaint(complaintId);

      await logActivity({
        userId,
        complaintId: complaint.id,
        action:      "admin_complaint_deleted",
        description: `[Admin] Soft-deleted complaint ${complaint.ticketId}: "${complaint.title}"`,
        metadata:    { ticketId: complaint.ticketId, deletedAt: new Date().toISOString() },
      });

      return res.json({
        message: "Complaint deleted successfully",
        deleted: { id: complaint.id, ticketId: complaint.ticketId, title: complaint.title },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVITY LOG
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/complaints/:id/activity", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, userRole } = req as AuthRequest;
      const { id } = req.params;
      const complaintIdParam = id as string;

      const complaint = await storage.getComplaint(complaintIdParam);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });
      if (userRole === "student" && complaint.studentId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      return res.json(await storage.getActivityLogs(complaintIdParam));
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch activity logs" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // COMMENTS
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/complaints/:id/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, userRole } = req as AuthRequest;
      const { id } = req.params;
      const complaintIdParam = id as string;
      const { content, isInternal } = req.body;

      if (!content?.trim()) return res.status(400).json({ message: "Comment cannot be empty" });

      const complaint = await storage.getComplaint(complaintIdParam);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      if (userRole === "student" && complaint.studentId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const internal = userRole !== "student" ? Boolean(isInternal) : false;

      const comment = await storage.createComment({
        complaintId: complaintIdParam,
        userId,
        content: content.trim(),
        isInternal: internal,
      });

      await logActivity({
        userId,
        complaintId: complaintIdParam,
        action: internal ? "internal_note_added" : "comment_added",
        description: internal ? "Internal staff note added" : "Public comment added",
      });

      // Notify relevant parties
      const notifyIds = new Set<string>();
      if (complaint.studentId    && complaint.studentId    !== userId) notifyIds.add(complaint.studentId);
      if (complaint.assignedStaff && complaint.assignedStaff !== userId) notifyIds.add(complaint.assignedStaff);

      for (const nId of Array.from(notifyIds)) {
        if (internal) {
          const target = await storage.getUser(nId);
          if (target?.role === "student") continue;
        }
        await storage.createNotification({
          userId: nId,
          type: "comment_added",
          title: "New Comment on Complaint",
          message: `A comment was added to ticket ${complaint.ticketId}`,
          read: false,
          complaintId: complaint.id,
        });
      }

      return res.status(201).json(comment);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Comment submission failed" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      return res.json(await storage.getNotifications((req as AuthRequest).userId));
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req: Request, res: Response) => {
    try {
      return res.json({ count: await storage.getUnreadCount((req as AuthRequest).userId) });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch unread count" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;
      const { id } = req.params;
      const notifIdParam = Array.isArray(id) ? id[0] : id;

      const notifications = await storage.getNotifications(userId);
      const targetNotif = notifications.find(n => n.id === notifIdParam);

      if (!targetNotif) {
        return res.status(404).json({ message: "Notification not found" });
      }

      if (targetNotif.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.markNotificationRead(notifIdParam);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.markAllNotificationsRead((req as AuthRequest).userId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to mark all notifications as read" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DASHBOARD & ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, userRole } = req as AuthRequest;
      return res.json(await storage.getDashboardStats(userId, userRole));
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/analytics", requireAuth, requireStaff, async (_req: Request, res: Response) => {
    try {
      return res.json(await storage.getAnalytics());
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch analytics" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ATTACHMENTS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/complaints/:id/attachments
   * Returns all file attachments linked to a complaint.
   */
  app.get("/api/complaints/:id/attachments", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, userRole } = req as AuthRequest;
      const { id } = req.params;
      const complaintIdParam = Array.isArray(id) ? id[0] : id;

      const complaint = await storage.getComplaint(complaintIdParam);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      if (userRole === "student" && complaint.studentId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const files = await storage.getComplaintAttachments(complaintIdParam);
      return res.json(files);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch attachments" });
    }
  });

  /**
   * POST /api/complaints/:id/attachments
   * Upload one or more files and attach them to an existing complaint.
   * Students can only attach to their own complaints.
   * Accepts: multipart/form-data, field name "files"
   */
  app.post(
    "/api/complaints/:id/attachments",
    requireAuth,
    (req: Request, res: Response, next) => {
      uploadSingle.array("files", 10)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "File too large — maximum 10 MB per file" });
          }
          if (err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({ message: "Too many files — maximum 10 at once" });
          }
          return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        if (err) {
          return res.status(400).json({ message: err.message });
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const { userId, userRole } = req as AuthRequest;
        const files = req.files as Express.Multer.File[];
        const { id } = req.params;
        const complaintIdParam = Array.isArray(id) ? id[0] : id;

        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No files uploaded. Use field name \"files\"" });
        }

        const complaint = await storage.getComplaint(complaintIdParam);
        if (!complaint) {
          // Clean up uploaded files if complaint not found
          files.forEach((f) => fs.unlink(f.path, () => {}));
          return res.status(404).json({ message: "Complaint not found" });
        }

        if (userRole === "student" && complaint.studentId !== userId) {
          files.forEach((f) => fs.unlink(f.path, () => {}));
          return res.status(403).json({ message: "You can only attach files to your own complaints" });
        }

        const saved = await Promise.all(
          files.map((f) =>
            storage.createAttachment({
              complaintId:  complaint.id,
              filename:     f.filename,
              originalName: f.originalname,
              mimeType:     f.mimetype,
              size:         f.size,
              uploadedById: userId,
            })
          )
        );

        await logActivity({
          userId,
          complaintId: complaint.id,
          action: "files_uploaded",
          description: `${files.length} file(s) attached: ${files.map((f) => f.originalname).join(", ")}`,
          metadata: { count: files.length, fileNames: files.map((f) => f.originalname) },
        });

        return res.status(201).json({
          message: `${saved.length} file(s) uploaded successfully`,
          attachments: saved,
        });
      } catch (err: any) {
        return res.status(500).json({ message: err.message || "Upload failed" });
      }
    }
  );

  /**
   * GET /api/attachments/:id/download
   * Forces the browser to download the file with its original filename.
   */
  app.get("/api/attachments/:id/download", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, userRole } = req as AuthRequest;
      const { id } = req.params;
      const attIdParam = Array.isArray(id) ? id[0] : id;

      const att = await storage.getAttachment(attIdParam);
      if (!att) return res.status(404).json({ message: "Attachment not found" });

      const complaint = await storage.getComplaint(att.complaintId);
      if (!complaint) return res.status(404).json({ message: "Associated complaint not found" });

      if (userRole === "student" && complaint.studentId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const filePath = path.join(UPLOAD_DIR, att.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk — it may have been deleted" });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${att.originalName}"`);
      res.setHeader("Content-Type", att.mimeType);
      res.setHeader("Content-Length", att.size);
      return res.sendFile(filePath);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Download failed" });
    }
  });

  /**
   * GET /api/attachments/:id/view
   * Serves the file inline so images open in the browser rather than downloading.
   */
  app.get("/api/attachments/:id/view", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, userRole } = req as AuthRequest;
      const { id } = req.params;
      const attIdParam = Array.isArray(id) ? id[0] : id;

      const att = await storage.getAttachment(attIdParam);
      if (!att) return res.status(404).json({ message: "Attachment not found" });

      const complaint = await storage.getComplaint(att.complaintId);
      if (!complaint) return res.status(404).json({ message: "Associated complaint not found" });

      if (userRole === "student" && complaint.studentId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const filePath = path.join(UPLOAD_DIR, att.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.setHeader("Content-Disposition", `inline; filename="${att.originalName}"`);
      res.setHeader("Content-Type", att.mimeType);
      res.setHeader("Content-Length", att.size);
      return res.sendFile(filePath);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to view attachment" });
    }
  });

  /**
   * DELETE /api/attachments/:id
   * Removes the attachment record from the database and deletes the file from disk.
   * Allowed by: the uploader (any role) OR staff / admin.
   */
  app.delete("/api/attachments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, userRole } = req as AuthRequest;
      const { id } = req.params;
      const attIdParam = Array.isArray(id) ? id[0] : id;

      const att = await storage.getAttachment(attIdParam);
      if (!att) return res.status(404).json({ message: "Attachment not found" });

      const isUploader   = att.uploadedById === userId;
      const isPrivileged = userRole === "staff" || userRole === "admin";

      if (!isUploader && !isPrivileged) {
        return res.status(403).json({ message: "You can only delete your own attachments" });
      }

      // Remove from database first
      await storage.deleteAttachment(att.id);

      // Remove file from disk (non-blocking, silent failure)
      const filePath = path.join(UPLOAD_DIR, att.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.warn(`[upload] Could not delete file ${filePath}:`, err.message);
      });

      return res.json({
        message: "Attachment deleted successfully",
        deleted: { id: att.id, originalName: att.originalName },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN — COMPLAINT MANAGEMENT
  // Full CRUD for admin users with activity logging and notifications.
  // All routes require: requireAuth + requireAdmin
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/admin/complaints
   * List all complaints with optional filters.
   * Query params: status, category, priority, search, assignedStaff, departmentId, page, limit
   */
  app.get("/api/admin/complaints", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        status:        z.enum(["pending", "assigned", "in_progress", "resolved", "closed"]).optional(),
        category:      z.enum(["academic", "financial", "facilities", "administrative", "library", "hostel", "sports", "it_support", "health", "other"]).optional(),
        priority:      z.enum(["low", "medium", "high", "urgent"]).optional(),
        search:        z.string().max(200).optional(),
        assignedStaff: z.string().optional(),
        departmentId:  z.string().optional(),
        dateFrom:      z.string().optional(),
        dateTo:        z.string().optional(),
        page:          z.coerce.number().int().min(1).default(1),
        limit:         z.coerce.number().int().min(1).max(200).default(50),
      });

      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { status, category, priority, search, assignedStaff, departmentId, dateFrom, dateTo } = parsed.data;

      const filter: Record<string, string> = {};
      if (status)        filter.status        = status;
      if (category)      filter.category      = category;
      if (priority)      filter.priority      = priority;
      if (search)        filter.search        = search;
      if (assignedStaff) filter.assignedStaff = assignedStaff;
      if (departmentId)  filter.departmentId  = departmentId;
      if (dateFrom)      filter.dateFrom      = dateFrom;
      if (dateTo)        filter.dateTo        = dateTo;

      const all = await storage.getComplaints(filter);

      // Pagination
      const { page, limit } = parsed.data;
      const total   = all.length;
      const pages   = Math.ceil(total / limit);
      const results = all.slice((page - 1) * limit, page * limit);

      return res.json({
        data:  results,
        meta:  { total, page, limit, pages },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch complaints" });
    }
  });

  /**
   * GET /api/admin/complaints/:id
   * Full detail view of any complaint.
   */
  app.get("/api/admin/complaints/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }
      return res.json(complaint);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch complaint" });
    }
  });

  /**
   * PUT /api/admin/complaints/:id
   * Full update of any complaint field.
   * Admin may change title, description, category, priority, status,
   * assignedStaff, departmentId, and resolutionNotes.
   * Triggers notifications and activity logs for status / assignment changes.
   */
  app.put("/api/admin/complaints/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;
      const id = req.params.id as string;

      const bodySchema = z.object({
        title:           z.string().min(5).max(200).optional(),
        description:     z.string().min(10).max(5000).optional(),
        category:        z.enum(["academic", "financial", "facilities", "administrative", "library", "hostel", "sports", "it_support", "health", "other"]).optional(),
        priority:        z.enum(["low", "medium", "high", "urgent"]).optional(),
        status:          z.enum(["pending", "assigned", "in_progress", "resolved", "closed"]).optional(),
        assignedStaff:   z.string().nullable().optional(),
        departmentId:    z.string().nullable().optional(),
        resolutionNotes: z.string().max(5000).nullable().optional(),
      }).refine((d) => Object.keys(d).length > 0, { message: "At least one field must be provided" });

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }

      // If assigning to staff, verify the user exists and is staff/admin
      if (parsed.data.assignedStaff) {
        const assignee = await storage.getUser(parsed.data.assignedStaff);
        if (!assignee) {
          return res.status(400).json({ message: "Assigned staff user not found" });
        }
        if (assignee.role === "student") {
          return res.status(400).json({ message: "Cannot assign complaint to a student" });
        }
      }

      const data      = parsed.data;
      const update: Record<string, unknown> = {};
      if (data.title           !== undefined) update.title           = data.title;
      if (data.description     !== undefined) update.description     = data.description;
      if (data.category        !== undefined) update.category        = data.category;
      if (data.priority        !== undefined) update.priority        = data.priority;
      if (data.status          !== undefined) update.status          = data.status;
      if (data.assignedStaff   !== undefined) update.assignedStaff   = data.assignedStaff   ?? null;
      if (data.departmentId    !== undefined) update.departmentId    = data.departmentId    ?? null;
      if (data.resolutionNotes !== undefined) update.resolutionNotes = data.resolutionNotes ?? null;

      const updated = await storage.updateComplaint(id, update as any);

      // Build descriptive change summary for the activity log
      const changes: string[] = [];
      if (data.title           !== undefined && data.title           !== complaint.title)           changes.push(`title updated`);
      if (data.description     !== undefined && data.description     !== complaint.description)     changes.push(`description updated`);
      if (data.category        !== undefined && data.category        !== complaint.category)        changes.push(`category → ${data.category}`);
      if (data.priority        !== undefined && data.priority        !== complaint.priority)        changes.push(`priority → ${data.priority}`);
      if (data.status          !== undefined && data.status          !== complaint.status)          changes.push(`status → ${data.status}`);
      if (data.assignedStaff   !== undefined && data.assignedStaff   !== complaint.assignedStaff)  changes.push(`staff assignment updated`);
      if (data.departmentId    !== undefined && data.departmentId    !== complaint.departmentId)    changes.push(`department updated`);
      if (data.resolutionNotes !== undefined && data.resolutionNotes !== complaint.resolutionNotes) changes.push(`resolution notes updated`);

      await logActivity({
        userId,
        complaintId: id,
        action: "admin_complaint_updated",
        description: changes.length > 0 ? `[Admin] ${changes.join(", ")}` : "[Admin] No effective changes",
        metadata: { changes, updatedFields: Object.keys(update) },
      });

      // Notify student on status change
      if (data.status && data.status !== complaint.status && complaint.studentId && complaint.studentId !== userId) {
        const isResolved = data.status === "resolved" || data.status === "closed";
        await storage.createNotification({
          userId:      complaint.studentId,
          type:        isResolved ? "resolved" : "status_changed",
          title:       isResolved ? "Your Complaint Has Been Resolved" : "Complaint Status Updated",
          message:     isResolved
            ? `Ticket ${complaint.ticketId} has been marked as ${data.status}. Thank you for your patience.`
            : `Ticket ${complaint.ticketId} status changed to "${data.status.replace(/_/g, " ")}"`,
          read:        false,
          complaintId: id,
        });
      }

      // Notify newly assigned staff member
      if (data.assignedStaff && data.assignedStaff !== complaint.assignedStaff) {
        await storage.createNotification({
          userId:      data.assignedStaff,
          type:        "assigned",
          title:       "Complaint Assigned to You",
          message:     `Ticket ${complaint.ticketId}: "${complaint.title}" has been assigned to you by an admin`,
          read:        false,
          complaintId: id,
        });
        // Also notify the student their complaint is now being handled
        if (complaint.studentId && complaint.studentId !== userId) {
          await storage.createNotification({
            userId:      complaint.studentId,
            type:        "assigned",
            title:       "Complaint Being Reviewed",
            message:     `Ticket ${complaint.ticketId} has been assigned to a staff member and is under review`,
            read:        false,
            complaintId: id,
          });
        }
      }

      return res.json({
        message:   "Complaint updated successfully",
        complaint: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to update complaint" });
    }
  });

  /**
   * DELETE /api/admin/complaints/:id
   * Soft-deletes a complaint (sets is_deleted = true, deleted_at = now).
   * Only admin role may delete. Logs deletion to activity_logs.
   */
  app.delete("/api/admin/complaints/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;
      const id = req.params.id as string;

      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }

      // Perform soft delete first (record stays in DB, is_deleted = true)
      await storage.deleteComplaint(id);

      // Log after soft-delete — the row still exists so the FK is valid
      await logActivity({
        userId,
        complaintId: id,
        action:      "admin_complaint_deleted",
        description: `[Admin] Soft-deleted complaint ${complaint.ticketId}: "${complaint.title}"`,
        metadata:    {
          ticketId:  complaint.ticketId,
          title:     complaint.title,
          status:    complaint.status,
          priority:  complaint.priority,
          category:  complaint.category,
          studentId: complaint.studentId,
          deletedAt: new Date().toISOString(),
          deletedBy: userId,
        },
      });

      return res.json({
        message: "Complaint deleted successfully",
        deleted: { id, ticketId: complaint.ticketId, title: complaint.title },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to delete complaint" });
    }
  });

  /**
   * POST /api/admin/complaints/assign
   * Assign (or reassign) a complaint to a staff member and optionally a department.
   * Body: { complaintId, assignedStaff, departmentId? }
   * - Updates assigned_staff and department_id on the complaint.
   * - Automatically sets status to "assigned" if currently "pending".
   * - Sends notifications to the assigned staff member and the submitting student.
   */
  app.post("/api/admin/complaints/assign", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthRequest;

      const bodySchema = z.object({
        complaintId:   z.string().min(1, "complaintId is required"),
        assignedStaff: z.string().min(1, "assignedStaff (user ID) is required"),
        departmentId:  z.string().nullable().optional(),
        priority:      z.enum(["low", "medium", "high", "urgent"]).optional(),
        notes:         z.string().max(500).optional(),
      });

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { complaintId, assignedStaff, departmentId, priority, notes } = parsed.data;

      // Verify the complaint exists
      const complaint = await storage.getComplaint(complaintId);
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }

      // Verify the assignee exists and is eligible
      const assignee = await storage.getUser(assignedStaff);
      if (!assignee) {
        return res.status(400).json({ message: "Staff user not found" });
      }
      if (assignee.role === "student") {
        return res.status(400).json({ message: "Cannot assign complaint to a student account" });
      }

      const previousStaff = complaint.assignedStaff;
      const isReassignment = !!previousStaff && previousStaff !== assignedStaff;

      // Build the update — auto-promote status from pending → assigned
      const update: Record<string, unknown> = {
        assignedStaff,
        assignedAt: new Date(),
        ...(departmentId !== undefined ? { departmentId: departmentId ?? null } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(complaint.status === "pending" ? { status: "assigned" } : {}),
      };

      const updated = await storage.updateComplaint(complaintId, update as any);

      // If notes provided, create an internal comment
      if (notes && notes.trim()) {
        await storage.createComment({
          complaintId,
          userId,
          content: `[Assignment Note] ${notes.trim()}`,
          isInternal: true,
        });
      }

      // Activity log
      const activityParts: string[] = [
        isReassignment ? `Reassigned to ${assignee.name}` : `Assigned to ${assignee.name}`,
      ];
      if (priority && priority !== complaint.priority) activityParts.push(`priority → ${priority}`);
      if (departmentId) activityParts.push(`department updated`);

      await logActivity({
        userId,
        complaintId,
        action:      isReassignment ? "admin_complaint_reassigned" : "admin_complaint_assigned",
        description: `[Admin] ${activityParts.join(", ")} — ${complaint.ticketId}`,
        metadata: {
          assignedStaff,
          assigneeName: assignee.name,
          departmentId: departmentId ?? null,
          previousStaff,
          priority: priority ?? null,
          notes: notes ?? null,
          statusChange: complaint.status === "pending" ? "pending → assigned" : null,
        },
      });

      // Notify the newly assigned staff member
      await storage.createNotification({
        userId:      assignedStaff,
        type:        "assigned",
        title:       isReassignment ? "Complaint Reassigned to You" : "Complaint Assigned to You",
        message:     `Ticket ${complaint.ticketId}: "${complaint.title}" has been ${isReassignment ? "reassigned" : "assigned"} to you by an admin`,
        read:        false,
        complaintId,
      });

      // Notify the student
      if (complaint.studentId && complaint.studentId !== userId) {
        await storage.createNotification({
          userId:      complaint.studentId,
          type:        "assigned",
          title:       "Complaint Being Reviewed",
          message:     `Ticket ${complaint.ticketId} has been assigned to a staff member and is under review`,
          read:        false,
          complaintId,
        });
      }

      // If reassignment, optionally notify the previous assignee
      if (isReassignment && previousStaff) {
        await storage.createNotification({
          userId:      previousStaff,
          type:        "status_changed",
          title:       "Complaint Reassigned",
          message:     `Ticket ${complaint.ticketId} has been reassigned away from you`,
          read:        false,
          complaintId,
        });
      }

      return res.status(200).json({
        message:    isReassignment
          ? `Complaint reassigned to ${assignee.name}`
          : `Complaint assigned to ${assignee.name}`,
        complaint:  updated,
        assignee:   { id: assignee.id, name: assignee.name, email: assignee.email, role: assignee.role },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Assignment failed" });
    }
  });

  return httpServer;
}
