import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import { createError } from "../middleware/error.middleware";
import { decrypt } from "../utils/crypto";
import { config } from "../config";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { user_id: req.user!.sub },
      select: {
        id: true,
        platform: true,
        account_name: true,
        account_id: true,
        is_active: true,
        token_expires_at: true,
        created_at: true,
        // never expose tokens
      },
    });
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.socialAccount.findFirst({
      where: { id: req.params.id, user_id: req.user!.sub },
    });
    if (!account) throw createError("Account not found", 404);
    await prisma.socialAccount.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Debug: check what permissions the stored token has
router.get("/:id/debug-token", async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.socialAccount.findFirst({
      where: { id: req.params.id, user_id: req.user!.sub },
    });
    if (!account) throw createError("Account not found", 404);

    const token = decrypt(account.access_token_enc);
    // debug_token requires an App Access Token (not a user/page token) as access_token
    const appToken = `${config.META_APP_ID}|${config.META_APP_SECRET}`;
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appToken}`
    );
    const debug = await debugRes.json();
    res.json({ platform: account.platform, account_id: account.account_id, debug });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/toggle", async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.socialAccount.findFirst({
      where: { id: req.params.id, user_id: req.user!.sub },
    });
    if (!account) throw createError("Account not found", 404);
    const updated = await prisma.socialAccount.update({
      where: { id: req.params.id },
      data: { is_active: !account.is_active },
      select: { id: true, is_active: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
