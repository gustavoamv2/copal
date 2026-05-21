import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);

router.get("/metrics", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [scheduled, publishedToday, published, drafts, failed, upcoming] = await Promise.all([
      prisma.post.count({ where: { user_id: userId, status: "scheduled" } }),
      prisma.post.count({
        where: { user_id: userId, status: "published", published_at: { gte: today, lt: tomorrow } },
      }),
      prisma.post.count({ where: { user_id: userId, status: "published" } }),
      prisma.post.count({ where: { user_id: userId, status: "draft" } }),
      prisma.post.count({ where: { user_id: userId, status: "failed" } }),
      prisma.scheduledPublication.findMany({
        where: {
          post: { user_id: userId },
          status: "pending",
          publish_at: { gte: new Date() },
        },
        orderBy: { publish_at: "asc" },
        take: 10,
        include: {
          post: { select: { id: true, title: true } },
          post_variant: { select: { platform: true } },
        },
      }),
    ]);

    res.json({ scheduled, publishedToday, published, drafts, failed, upcoming });
  } catch (err) {
    next(err);
  }
});

export default router;
