import { db } from "./db";
import {
  users, complaints, comments, departments, notifications, attachments, activityLogs,
  type User, type InsertUser, type Complaint, type InsertComplaint,
  type Comment, type InsertComment, type Department, type InsertDepartment,
  type Notification, type InsertNotification, type Attachment, type InsertAttachment,
  type ActivityLog, type InsertActivityLog, type ComplaintWithDetails,
} from "@shared/schema";
import { eq, desc, and, or, ilike, count, gte, lte, inArray, ne, isNull } from "drizzle-orm";
import fs from "fs";
import path from "path";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<Pick<User, "name" | "email" | "department" | "studentId" | "avatar" | "profilePhoto">>): Promise<User | undefined>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  toggleUserSuspension(id: string, isActive: boolean): Promise<User | undefined>;
  softDeleteUser(id: string): Promise<User | undefined>;
  restoreUser(id: string): Promise<User | undefined>;
  hardDeleteUser(id: string): Promise<void>;
  getUsers(): Promise<User[]>;
  getStaffUsers(): Promise<Partial<User>[]>;
  setVerificationCode(userId: string, code: string, expiresAt: Date): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<User | null>;
  markEmailVerified(userId: string): Promise<void>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;

  // Complaints
  getComplaints(filter?: {
    studentId?: string;
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    assignedStaff?: string;
    departmentId?: string;
  }): Promise<ComplaintWithDetails[]>;
  getComplaint(id: string): Promise<ComplaintWithDetails | undefined>;
  createComplaint(c: InsertComplaint): Promise<Complaint>;
  updateComplaint(id: string, data: Partial<Complaint>): Promise<Complaint | undefined>;
  deleteComplaint(id: string): Promise<void>;
  generateTicketId(): Promise<string>;

  // Comments
  createComment(c: InsertComment): Promise<Comment>;

  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(d: InsertDepartment): Promise<Department>;
  deleteDepartment(id: string): Promise<void>;

  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadCount(userId: string): Promise<number>;
  createNotification(n: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // Attachments
  createAttachment(a: InsertAttachment): Promise<Attachment>;
  getAttachment(id: string): Promise<Attachment | undefined>;
  getComplaintAttachments(complaintId: string): Promise<Attachment[]>;
  deleteAttachment(id: string): Promise<void>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(complaintId: string): Promise<(ActivityLog & { user?: Partial<User> | null })[]>;

  // Dashboard & Analytics
  getDashboardStats(userId: string, role: string): Promise<object>;
  getAnalytics(): Promise<object>;
}

export class DatabaseStorage implements IStorage {
  // ─── Users ─────────────────────────────────────────────────────────────────
  async getUser(id: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.email, email));
    return u;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [u] = await db.insert(users).values(user).returning();
    return u;
  }

  async updateUser(id: string, data: Partial<Pick<User, "name" | "email" | "department" | "studentId" | "avatar" | "profilePhoto">>): Promise<User | undefined> {
    const [u] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return u;
  }

  async setVerificationCode(userId: string, code: string, expiresAt: Date): Promise<void> {
    await db.update(users).set({ emailVerificationCode: code, verificationExpiresAt: expiresAt, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async verifyEmailCode(email: string, code: string): Promise<User | null> {
    const [u] = await db.select().from(users).where(eq(users.email, email));
    if (!u) return null;
    if (u.emailVerificationCode !== code) return null;
    if (!u.verificationExpiresAt || u.verificationExpiresAt < new Date()) return null;
    return u;
  }

  async markEmailVerified(userId: string): Promise<void> {
    await db.update(users).set({ emailVerified: true, emailVerificationCode: null, verificationExpiresAt: null, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [u] = await db.update(users).set({ role: role as any }).where(eq(users.id, id)).returning();
    return u;
  }

  async toggleUserSuspension(id: string, isActive: boolean): Promise<User | undefined> {
    const [u] = await db.update(users).set({ isActive }).where(eq(users.id, id)).returning();
    return u;
  }

  async softDeleteUser(id: string): Promise<User | undefined> {
    const [u] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() } as any)
      .where(eq(users.id, id))
      .returning();
    return u;
  }

  async restoreUser(id: string): Promise<User | undefined> {
    const [u] = await db
      .update(users)
      .set({ isActive: true, updatedAt: new Date() } as any)
      .where(eq(users.id, id))
      .returning();
    return u;
  }

  async hardDeleteUser(id: string): Promise<void> {
    // 1. Get all complaint IDs belonging to this user as student
    const userComplaints = await db
      .select({ id: complaints.id })
      .from(complaints)
      .where(eq(complaints.studentId, id));
    const complaintIds = userComplaints.map((c) => c.id);

    // 2. For each of the user's complaints, cascade-delete related data
    if (complaintIds.length > 0) {
      // Delete notifications linked to those complaints
      await db.delete(notifications).where(inArray(notifications.complaintId, complaintIds));
      // Delete comments on those complaints (by anyone)
      await db.delete(comments).where(inArray(comments.complaintId, complaintIds));
      // Get attachment file paths before deleting records
      const attRecords = await db
        .select({ filename: attachments.filename })
        .from(attachments)
        .where(inArray(attachments.complaintId, complaintIds));
      for (const att of attRecords) {
        const filePath = path.join(process.cwd(), "uploads", att.filename);
        try { fs.unlinkSync(filePath); } catch {}
      }
      await db.delete(attachments).where(inArray(attachments.complaintId, complaintIds));
      // Nullify activity log complaint references
      await db
        .update(activityLogs)
        .set({ complaintId: null } as any)
        .where(inArray(activityLogs.complaintId as any, complaintIds));
      // Delete the complaints themselves
      await db.delete(complaints).where(inArray(complaints.id, complaintIds));
    }

    // 3. Delete notifications sent to this user
    await db.delete(notifications).where(eq(notifications.userId, id));
    // 4. Delete comments this user left on other complaints
    await db.delete(comments).where(eq(comments.userId, id));
    // 5. Nullify activity log user references (preserve audit trail)
    await db.update(activityLogs).set({ userId: null } as any).where(eq(activityLogs.userId as any, id));
    // 6. Unassign this staff member from complaints
    await db
      .update(complaints)
      .set({ assignedStaff: null })
      .where(eq(complaints.assignedStaff, id));
    // 7. Nullify attachment uploader reference
    await db
      .update(attachments)
      .set({ uploadedById: null })
      .where(eq(attachments.uploadedById, id));
    // 8. Delete profile photo from disk
    const [userRow] = await db.select({ profilePhoto: users.profilePhoto }).from(users).where(eq(users.id, id));
    if (userRow?.profilePhoto) {
      const photoPath = path.join(process.cwd(), userRow.profilePhoto.replace(/^\//, ""));
      try { fs.unlinkSync(photoPath); } catch {}
    }
    // 9. Delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getStaffUsers(): Promise<Partial<User>[]> {
    return db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, department: users.department })
      .from(users)
      .where(or(eq(users.role, "staff"), eq(users.role, "admin")));
  }

  // ─── Complaints ────────────────────────────────────────────────────────────
  async getComplaints(filter?: {
    studentId?: string;
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    assignedStaff?: string;
    departmentId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ComplaintWithDetails[]> {
    const conditions: any[] = [eq(complaints.isDeleted, false)];
    if (filter?.studentId)    conditions.push(eq(complaints.studentId, filter.studentId));
    if (filter?.status)       conditions.push(eq(complaints.status, filter.status as any));
    if (filter?.category)     conditions.push(eq(complaints.category, filter.category as any));
    if (filter?.priority)     conditions.push(eq(complaints.priority, filter.priority as any));
    if (filter?.assignedStaff) conditions.push(eq(complaints.assignedStaff, filter.assignedStaff));
    if (filter?.departmentId)  conditions.push(eq(complaints.departmentId, filter.departmentId));
    if (filter?.dateFrom)      conditions.push(gte(complaints.createdAt, new Date(filter.dateFrom)));
    if (filter?.dateTo) {
      const to = new Date(filter.dateTo);
      to.setHours(23, 59, 59, 999);
      conditions.push(lte(complaints.createdAt, to));
    }
    if (filter?.search) {
      const matchingStudents = await db.select({ id: users.id }).from(users)
        .where(ilike(users.name, `%${filter.search}%`));
      const studentIds = matchingStudents.map((u) => u.id);
      const searchClauses: any[] = [
        ilike(complaints.title, `%${filter.search}%`),
        ilike(complaints.description, `%${filter.search}%`),
        ilike(complaints.ticketId, `%${filter.search}%`),
      ];
      if (studentIds.length > 0) searchClauses.push(inArray(complaints.studentId, studentIds));
      conditions.push(or(...searchClauses));
    }

    const rows = await db.select().from(complaints)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(complaints.createdAt));

    return Promise.all(rows.map((c) => this._enrichComplaint(c, false)));
  }

  async getComplaint(id: string): Promise<ComplaintWithDetails | undefined> {
    const [c] = await db.select().from(complaints)
      .where(and(eq(complaints.id, id), eq(complaints.isDeleted, false)));
    if (!c) return undefined;
    return this._enrichComplaint(c, true);
  }

  /** Internal helper: joins student, staff, dept, comments, attachments, activityLogs */
  private async _enrichComplaint(c: Complaint, full: boolean): Promise<ComplaintWithDetails> {
    const student = c.studentId
      ? await db.select({ id: users.id, name: users.name, email: users.email, role: users.role })
          .from(users).where(eq(users.id, c.studentId)).then((r) => r[0] ?? null)
      : null;

    const staff = c.assignedStaff
      ? await db.select({ id: users.id, name: users.name, email: users.email })
          .from(users).where(eq(users.id, c.assignedStaff)).then((r) => r[0] ?? null)
      : null;

    const department = c.departmentId
      ? await db.select().from(departments).where(eq(departments.id, c.departmentId)).then((r) => r[0] ?? null)
      : null;

    const [commentCount] = await db.select({ count: count() }).from(comments).where(eq(comments.complaintId, c.id));
    const [attachCount]  = await db.select({ count: count() }).from(attachments).where(eq(attachments.complaintId, c.id));

    if (!full) {
      return {
        ...c,
        student,
        staff,
        department,
        _count: {
          comments: Number(commentCount?.count ?? 0),
          attachments: Number(attachCount?.count ?? 0),
        },
      };
    }

    // Full detail: include comments, attachments, activityLogs
    const commentRows = await db.select().from(comments)
      .where(eq(comments.complaintId, c.id)).orderBy(comments.createdAt);

    const commentsWithUsers = await Promise.all(commentRows.map(async (cm) => {
      const u = await db.select({ id: users.id, name: users.name, role: users.role })
        .from(users).where(eq(users.id, cm.userId)).then((r) => r[0] ?? null);
      return { ...cm, user: u };
    }));

    const attachmentRows = await db.select().from(attachments).where(eq(attachments.complaintId, c.id));
    const logRows = await this.getActivityLogs(c.id);

    return {
      ...c,
      student,
      staff,
      department,
      comments: commentsWithUsers,
      attachments: attachmentRows,
      activityLogs: logRows,
      _count: { comments: commentsWithUsers.length, attachments: attachmentRows.length },
    };
  }

  async createComplaint(c: InsertComplaint): Promise<Complaint> {
    const ticketId = await this.generateTicketId();
    const [created] = await db.insert(complaints).values({ ...c, ticketId } as any).returning();
    return created;
  }

  async updateComplaint(id: string, data: Partial<Complaint>): Promise<Complaint | undefined> {
    const [updated] = await db
      .update(complaints)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(complaints.id, id))
      .returning();
    return updated;
  }

  async deleteComplaint(id: string): Promise<void> {
    await db.update(complaints)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(complaints.id, id));
  }

  async generateTicketId(): Promise<string> {
    const [result] = await db.select({ count: count() }).from(complaints)
      .where(eq(complaints.isDeleted, false));
    const num  = (Number(result?.count ?? 0) + 1).toString().padStart(4, "0");
    const year = new Date().getFullYear();
    return `UC-${year}-${num}`;
  }

  // ─── Comments ──────────────────────────────────────────────────────────────
  async createComment(c: InsertComment): Promise<Comment> {
    const [created] = await db.insert(comments).values(c).returning();
    return created;
  }

  // ─── Departments ───────────────────────────────────────────────────────────
  async getDepartments(): Promise<Department[]> {
    return db.select().from(departments).orderBy(departments.name);
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [d] = await db.select().from(departments).where(eq(departments.id, id));
    return d;
  }

  async createDepartment(d: InsertDepartment): Promise<Department> {
    const [created] = await db.insert(departments).values(d).returning();
    return created;
  }

  async deleteDepartment(id: string): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  // ─── Notifications ─────────────────────────────────────────────────────────
  async getNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(60) as unknown as Notification[];
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return Number(result?.count ?? 0);
  }

  async createNotification(n: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(n).returning();
    return created as unknown as Notification;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }

  // ─── Attachments ───────────────────────────────────────────────────────────
  async createAttachment(a: InsertAttachment): Promise<Attachment> {
    const [created] = await db.insert(attachments).values(a).returning();
    return created;
  }

  async getAttachment(id: string): Promise<Attachment | undefined> {
    const [a] = await db.select().from(attachments).where(eq(attachments.id, id));
    return a;
  }

  async getComplaintAttachments(complaintId: string): Promise<Attachment[]> {
    return db.select().from(attachments)
      .where(eq(attachments.complaintId, complaintId))
      .orderBy(desc(attachments.createdAt));
  }

  async deleteAttachment(id: string): Promise<void> {
    await db.delete(attachments).where(eq(attachments.id, id));
  }

  // ─── Activity Logs ─────────────────────────────────────────────────────────
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
  }

  async getActivityLogs(complaintId: string): Promise<(ActivityLog & { user?: Partial<User> | null })[]> {
    const logs = await db.select().from(activityLogs)
      .where(eq(activityLogs.complaintId, complaintId))
      .orderBy(desc(activityLogs.createdAt));

    return Promise.all(logs.map(async (log) => {
      const u = log.userId
        ? await db.select({ id: users.id, name: users.name, role: users.role })
            .from(users).where(eq(users.id, log.userId)).then((r) => r[0] ?? null)
        : null;
      return { ...log, user: u };
    }));
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboardStats(userId: string, role: string): Promise<object> {
    const all = role === "student"
      ? await db.select().from(complaints).where(and(eq(complaints.studentId, userId), eq(complaints.isDeleted, false)))
      : await db.select().from(complaints).where(eq(complaints.isDeleted, false));

    const total      = all.length;
    const pending    = all.filter((c) => c.status === "pending").length;
    const assigned   = all.filter((c) => c.status === "assigned").length;
    const inProgress = all.filter((c) => c.status === "in_progress").length;
    const resolved   = all.filter((c) => c.status === "resolved").length;
    const closed     = all.filter((c) => c.status === "closed").length;
    const urgent     = all.filter((c) => c.priority === "urgent").length;
    const resolutionRate = total > 0 ? Math.round(((resolved + closed) / total) * 100) : 0;

    const recentQuery = role === "student"
      ? await db.select().from(complaints).where(and(eq(complaints.studentId, userId), eq(complaints.isDeleted, false))).orderBy(desc(complaints.createdAt)).limit(5)
      : await db.select().from(complaints).where(eq(complaints.isDeleted, false)).orderBy(desc(complaints.createdAt)).limit(5);

    const recentComplaints = await Promise.all(recentQuery.map((c) => this._enrichComplaint(c, false)));

    return { total, pending, assigned, inProgress, resolved, closed, urgent, resolutionRate, recentComplaints };
  }

  // ─── Analytics ─────────────────────────────────────────────────────────────
  async getAnalytics(): Promise<object> {
    const all = await db.select().from(complaints).where(eq(complaints.isDeleted, false));

    const statuses = ["pending", "assigned", "in_progress", "resolved", "closed"] as const;
    const byStatus = statuses
      .map((s) => ({ status: s, count: all.filter((c) => c.status === s).length }))
      .filter((s) => s.count > 0);

    const cats = ["academic", "financial", "facilities", "administrative", "library", "hostel", "sports", "it_support", "health", "other"] as const;
    const byCategory = cats
      .map((cat) => ({ category: cat, count: all.filter((c) => c.category === cat).length }))
      .filter((c) => c.count > 0);

    const depts = await db.select().from(departments);
    const byDepartment = depts
      .map((d) => ({ department: d.name, count: all.filter((c) => c.departmentId === d.id).length }))
      .filter((d) => d.count > 0);

    const now = new Date();
    const byMonth = Array.from({ length: 6 }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const month = start.toLocaleString("en-US", { month: "short" });
      const submitted = all.filter((c) => { const d = new Date(c.createdAt); return d >= start && d < end; }).length;
      const resolved  = all.filter((c) => {
        const d = new Date(c.updatedAt);
        return d >= start && d < end && (c.status === "resolved" || c.status === "closed");
      }).length;
      return { month, submitted, resolved };
    });

    const totalComplaints    = all.length;
    const resolvedComplaints = all.filter((c) => c.status === "resolved" || c.status === "closed").length;
    const pendingComplaints  = all.filter((c) => c.status === "pending" || c.status === "assigned" || c.status === "in_progress").length;
    const resolutionRate     = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0;

    // Compute real average resolution days for resolved/closed complaints
    const resolvedItems = all.filter((c) => c.status === "resolved" || c.status === "closed");
    const avgResolutionDays = resolvedItems.length > 0
      ? Math.round(
          resolvedItems.reduce((sum, c) => {
            const ms = new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime();
            return sum + ms / 86400000;
          }, 0) / resolvedItems.length
        )
      : 0;

    // Resolution time buckets for resolved/closed complaints
    const buckets = [
      { label: "< 1 day",   min: 0,   max: 1   },
      { label: "1–3 days",  min: 1,   max: 3   },
      { label: "3–7 days",  min: 3,   max: 7   },
      { label: "1–2 weeks", min: 7,   max: 14  },
      { label: "> 2 weeks", min: 14,  max: Infinity },
    ];
    const byResolutionTime = buckets.map(({ label, min, max }) => ({
      label,
      count: resolvedItems.filter((c) => {
        const days = (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / 86400000;
        return days >= min && days < max;
      }).length,
    }));

    // Open vs Resolved for donut
    const openCount     = all.filter((c) => ["pending","assigned","in_progress"].includes(c.status)).length;
    const resolvedCount = all.filter((c) => ["resolved","closed"].includes(c.status)).length;
    const openVsResolved = [
      { name: "Open",     value: openCount },
      { name: "Resolved", value: resolvedCount },
    ];

    // Priority breakdown
    const priorities = ["low","medium","high","urgent"] as const;
    const byPriority = priorities
      .map((p) => ({ priority: p, count: all.filter((c) => c.priority === p).length }))
      .filter((p) => p.count > 0);

    return {
      totalComplaints, resolvedComplaints, pendingComplaints, resolutionRate, avgResolutionDays,
      byStatus, byCategory, byDepartment, byMonth, byResolutionTime, openVsResolved, byPriority,
    };
  }
}

export const storage = new DatabaseStorage();
