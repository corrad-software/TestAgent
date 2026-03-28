import { describe, it, expect, vi } from "vitest";
import {
  hashPassword, verifyPassword, signToken, verifyToken,
  requireAuth, requireAdmin,
} from "../../src/auth";

describe("auth", () => {
  // ─── Password helpers ────────────────────────────────────────────────────────
  describe("hashPassword / verifyPassword", () => {
    it("returns a bcrypt hash", async () => {
      const hash = await hashPassword("test123");
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it("produces different hashes for the same input (salt)", async () => {
      const h1 = await hashPassword("same");
      const h2 = await hashPassword("same");
      expect(h1).not.toBe(h2);
    });

    it("verifies correct password", async () => {
      const hash = await hashPassword("correct");
      expect(await verifyPassword("correct", hash)).toBe(true);
    });

    it("rejects wrong password", async () => {
      const hash = await hashPassword("correct");
      expect(await verifyPassword("wrong", hash)).toBe(false);
    });
  });

  // ─── Token helpers ───────────────────────────────────────────────────────────
  describe("signToken / verifyToken", () => {
    const payload = { userId: "u1", email: "a@b.com", role: "Admin" };

    it("returns a JWT string with 3 parts", () => {
      const token = signToken(payload);
      expect(token.split(".")).toHaveLength(3);
    });

    it("round-trips: verifyToken returns original payload fields", () => {
      const token = signToken(payload);
      const decoded = verifyToken(token);
      expect(decoded).toMatchObject(payload);
    });

    it("returns null for garbage token", () => {
      expect(verifyToken("not.a.token")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(verifyToken("")).toBeNull();
    });
  });

  // ─── Middleware ──────────────────────────────────────────────────────────────
  function mockReqResNext(opts: { cookies?: Record<string, string>; headers?: Record<string, string>; user?: any }) {
    const req: any = {
      cookies: opts.cookies ?? {},
      headers: opts.headers ?? {},
      user: opts.user,
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
  }

  describe("requireAuth", () => {
    it("calls next() and sets req.user with valid cookie token", () => {
      const token = signToken({ userId: "u1", email: "a@b.com", role: "Admin" });
      const { req, res, next } = mockReqResNext({ cookies: { ta_session: token } });
      requireAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toMatchObject({ userId: "u1", email: "a@b.com" });
    });

    it("calls next() with valid Bearer token in header", () => {
      const token = signToken({ userId: "u2", email: "b@c.com", role: "Tester" });
      const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` } });
      requireAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toMatchObject({ userId: "u2" });
    });

    it("returns 401 with no token", () => {
      const { req, res, next } = mockReqResNext({});
      requireAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns 401 with invalid token", () => {
      const { req, res, next } = mockReqResNext({ cookies: { ta_session: "bad" } });
      requireAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("requireAdmin", () => {
    it("calls next() for Admin role", () => {
      const { req, res, next } = mockReqResNext({ user: { role: "Admin" } });
      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("returns 403 for non-Admin role", () => {
      const { req, res, next } = mockReqResNext({ user: { role: "Tester" } });
      requireAdmin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("returns 403 with no user", () => {
      const { req, res, next } = mockReqResNext({});
      requireAdmin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
