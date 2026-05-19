import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import { createError } from "../middleware/error.middleware";
import { schedulePublication } from "../services/scheduler.service";
import { z } from "zod";

const router = Router();
router.use(requireAuth);

const variantSchema = z.object({
  social_account_id: z.string().uuid(),
  platform: z.enum(["instagram", "facebook", "linkedin"]),
  caption: z.string(),
});

const postSchema = z.object({
  title: z.string().min(1),
  base_caption: z.string(),
  status: z.enum(["draft", "pending", "approved", "scheduled"]).optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
  variants: z.array(variantSchema).optional(),
  media_ids: z.array(z.string().uuid()).optional(),
});

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      user_id: req.user!.sub,
      ...(status ? { status: status as any } : {}),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: "desc" },
        include: {
          variants: { include: { social_account: { select: { account_name: true, platform: true } } } },
          post_media: { include: { media_asset: true }, orderBy: { order_index: "asc" } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    res.json({ data: posts, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, user_id: req.user!.sub },
      include: {
        variants: { include: { social_account: { select: { id: true, account_name: true, platform: true } } } },
        post_media: { include: { media_asset: true }, orderBy: { order_index: "asc" } },
        scheduled_pubs: true,
      },
    });
    if (!post) throw createError("Post not found", 404);
    res.json(post);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: AuthRequest, res, next) => {
  try {
    const body = postSchema.parse(req.body);
    const userId = req.user!.sub;

    const post = await prisma.post.create({
      data: {
        user_id: userId,
        title: body.title,
        base_caption: body.base_caption,
        status: body.status ?? "draft",
        scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : null,
        variants: body.variants
          ? {
              create: body.variants.map((v) => ({
                social_account_id: v.social_account_id,
                platform: v.platform,
                caption: v.caption,
                status: body.status === "scheduled" ? "scheduled" : "draft",
              })),
            }
          : undefined,
        post_media: body.media_ids
          ? {
              create: body.media_ids.map((id, idx) => ({
                media_asset_id: id,
                order_index: idx,
              })),
            }
          : undefined,
      },
      include: { variants: true },
    });

    if (post.status === "scheduled" && post.scheduled_at) {
      for (const variant of post.variants) {
        await schedulePublication(post.id, variant.id, variant.social_account_id, post.scheduled_at);
      }
    }

    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: AuthRequest, res, next) => {
  try {
    const body = postSchema.partial().parse(req.body);
    const existing = await prisma.post.findFirst({
      where: { id: req.params.id, user_id: req.user!.sub },
    });
    if (!existing) throw createError("Post not found", 404);

    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.base_caption !== undefined && { base_caption: body.base_caption }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.scheduled_at !== undefined && {
          scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : null,
        }),
      },
      include: { variants: true },
    });

    if (post.status === "scheduled" && post.scheduled_at) {
      for (const variant of post.variants) {
        await schedulePublication(post.id, variant.id, variant.social_account_id, post.scheduled_at);
      }
    }

    res.json(post);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.post.findFirst({
      where: { id: req.params.id, user_id: req.user!.sub },
    });
    if (!existing) throw createError("Post not found", 404);
    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
