import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import { z } from "zod";

const router = Router();
router.use(requireAuth);

const settingsSchema = z.object({
  timezone: z.string().optional(),
});

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { timezone: true, email: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch("/", async (req: AuthRequest, res, next) => {
  try {
    const body = settingsSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: body,
      select: { timezone: true, email: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
