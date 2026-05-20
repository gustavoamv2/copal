import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  REFRESH_COOKIE,
  REFRESH_COOKIE_OPTIONS,
} from "../utils/jwt";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import { createError } from "../middleware/error.middleware";
import { z } from "zod";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "editor"]).optional().default("editor"),
});

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, role } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw createError("Email already exists", 409);

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password_hash, role },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: hashToken(refreshToken),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res
      .cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS)
      .status(201)
      .json({
        access_token: accessToken,
        user: { id: user.id, email: user.email, role: user.role, timezone: user.timezone },
      });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw createError("Invalid credentials", 401);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw createError("Invalid credentials", 401);

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: hashToken(refreshToken),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res
      .cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS)
      .json({
        access_token: accessToken,
        user: { id: user.id, email: user.email, role: user.role, timezone: user.timezone },
      });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token_hash: hashToken(refreshToken) },
      });
    }
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" }).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw createError("No refresh token", 401);

    const payload = verifyRefreshToken(token);
    const stored = await prisma.refreshToken.findUnique({
      where: { token_hash: hashToken(token) },
    });
    if (!stored || stored.expires_at < new Date()) {
      throw createError("Refresh token expired", 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw createError("User not found", 401);

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const newRefresh = signRefreshToken({ sub: user.id, email: user.email, role: user.role });
    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: hashToken(newRefresh),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

    res
      .cookie(REFRESH_COOKIE, newRefresh, REFRESH_COOKIE_OPTIONS)
      .json({ access_token: accessToken });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, email: true, role: true, timezone: true, created_at: true },
    });
    if (!user) throw createError("User not found", 404);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
