import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.SESSION_SECRET || "unicore-jwt-secret-2024";
export const JWT_EXPIRES_IN = "7d";

export type Role = "student" | "staff" | "admin";

/** Extended Request with authenticated user context */
export interface AuthRequest extends Request {
  userId: string;
  userRole: Role;
}

/** Signs a short-lived JWT for a given user */
export function generateToken(user: { id: string; role: string }): string {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * requireAuth middleware
 * Validates the Bearer token and attaches userId / userRole to the request.
 * Returns 401 if the token is missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: no token provided" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    (req as AuthRequest).userId   = payload.id;
    (req as AuthRequest).userRole = payload.role as Role;
    return next();
  } catch (err: any) {
    const message = err.name === "TokenExpiredError"
      ? "Unauthorized: token expired"
      : "Unauthorized: invalid token";
    return res.status(401).json({ message });
  }
}

/**
 * requireRole(...roles) middleware factory
 * Must be used AFTER requireAuth.
 * Returns 403 if the authenticated user's role is not in the allowed list.
 *
 * Example:
 *   router.delete("/users/:id", requireAuth, requireRole("admin"), handler)
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as AuthRequest).userRole;

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        message: `Access denied: requires ${roles.join(" or ")} role`,
      });
    }

    return next();
  };
}

/**
 * requireStudent — shorthand: only students
 * requireStaff   — shorthand: staff OR admin (staff-level access)
 * requireAdmin   — shorthand: only admin
 */
export const requireStudent = requireRole("student");
export const requireStaff   = requireRole("staff", "admin");
export const requireAdmin   = requireRole("admin");
