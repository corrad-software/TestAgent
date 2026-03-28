import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { PrismaClient } from "@prisma/client";

const JWT_SECRET  = process.env.JWT_SECRET ?? "testAgent-dev-secret-change-in-prod";
const COOKIE_NAME = "ta_session";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export interface JwtPayload { userId: string; email: string; role: string }

// ─── Password helpers ──────────────────────────────────────────────────────────
export const hashPassword   = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// ─── Token helpers ─────────────────────────────────────────────────────────────
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
export function verifyToken(token: string): JwtPayload | null {
  try { return jwt.verify(token, JWT_SECRET) as JwtPayload; }
  catch { return null; }
}

// ─── Auth middleware ───────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME]
    ?? (req.headers.authorization?.startsWith("Bearer ")
       ? req.headers.authorization.slice(7) : null);

  const payload = token ? verifyToken(token) : null;
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as any).user = payload;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as JwtPayload | undefined;
  if (user?.role !== "Admin") { res.status(403).json({ error: "Admin access required" }); return; }
  next();
}

// ─── Seed default admin on first run ──────────────────────────────────────────
export async function seedAdminIfNeeded(prisma: PrismaClient) {
  const count = await prisma.user.count();
  if (count > 0) return;
  const passwordHash = await hashPassword("admin123");
  await prisma.user.create({
    data: { email: "admin@testagent.local", name: "Admin", passwordHash, role: "Admin" },
  });
  console.log("✅ Default admin created: admin@testAgent.local / admin123");
}

// ─── Cookie helpers ────────────────────────────────────────────────────────────
export { COOKIE_NAME, COOKIE_OPTS };
