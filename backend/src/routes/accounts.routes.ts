import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import { createError } from "../middleware/error.middleware";

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
