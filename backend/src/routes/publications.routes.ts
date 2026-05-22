import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import { createError } from "../middleware/error.middleware";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [pubs, total] = await Promise.all([
      prisma.scheduledPublication.findMany({
        where: {
          post: { user_id: req.user!.sub },
          ...(status ? { status: status as any } : {}),
        },
        skip,
        take: parseInt(limit),
        orderBy: { publish_at: "asc" },
        include: {
          post: { select: { id: true, title: true, status: true } },
          post_variant: { select: { platform: true, caption: true } },
        },
      }),
      prisma.scheduledPublication.count({
        where: { post: { user_id: req.user!.sub } },
      }),
    ]);

    res.json({ data: pubs, total });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/retry", async (req: AuthRequest, res, next) => {
  try {
    const pub = await prisma.scheduledPublication.findFirst({
      where: {
        id: req.params.id,
        post: { user_id: req.user!.sub },
        status: "failed",
      },
    });
    if (!pub) throw createError("Publication not found or not in failed state", 404);

    await prisma.scheduledPublication.update({
      where: { id: pub.id },
      data: { status: "pending", attempt_count: 0 },
    });

    res.json({ ok: true, message: "Retry scheduled" });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/logs", async (req: AuthRequest, res, next) => {
  try {
    const logs = await prisma.publicationLog.findMany({
      where: {
        post_variant: { post: { user_id: req.user!.sub } },
        post_variant_id: req.params.id,
      },
      orderBy: { logged_at: "desc" },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
