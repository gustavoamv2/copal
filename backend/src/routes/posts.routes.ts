import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import { createError } from "../middleware/error.middleware";
import { schedulePublication } from "../services/scheduler.service";
import { deleteFromCloudinary } from "../services/cloudinary.service";
import { publishToInstagram } from "../services/instagram.service";
import { publishToFacebook } from "../services/facebook.service";
import { publishToLinkedIn } from "../services/linkedin.service";
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

    // When filtering by scheduled status, order by scheduled_at ascending
    // so the soonest publications come first. Otherwise order by created_at desc.
    const orderBy = status === "scheduled"
      ? { scheduled_at: "asc" as const }
      : { created_at: "desc" as const };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy,
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

// ── Publish a post immediately via direct platform API (no Ayrshare) ──────────
router.post("/:id/publish", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, user_id: userId },
      include: {
        variants: { include: { social_account: true } },
        post_media: { include: { media_asset: true }, orderBy: { order_index: "asc" } },
      },
    });
    if (!post) throw createError("Post not found", 404);
    if (post.status === "published") {
      return res.json({ ok: true, alreadyPublished: true });
    }

    const mediaAssets = post.post_media.map((pm) => pm.media_asset);
    const titleLower  = post.title.toLowerCase();

    // Derive instagram type from title prefix set at import time
    const igType: "feed" | "story" | "carousel" | "reel" =
      mediaAssets.length > 1                                                  ? "carousel"
      : titleLower.includes("reel")                                           ? "reel"
      : titleLower.includes("story") || titleLower.includes("historia")       ? "story"
      : "feed";

    const errors: string[] = [];
    let successCount = 0;

    if (post.variants.length > 0) {
      // Posts created manually — one variant per platform/account
      for (const variant of post.variants as typeof post.variants & { social_account: NonNullable<(typeof post.variants)[0]["social_account"]> }[]) {
        if ((variant as any).status === "published") { successCount++; continue; }
        const account = (variant as any).social_account;
        try {
          let result: { platform_post_id: string };
          if (variant.platform === "instagram") {
            result = await publishToInstagram(account, variant.caption, mediaAssets, igType);
          } else if (variant.platform === "facebook") {
            result = await publishToFacebook(account, variant.caption, mediaAssets);
          } else {
            result = await publishToLinkedIn(account, variant.caption, mediaAssets);
          }
          await prisma.postPlatformVariant.update({
            where: { id: variant.id },
            data: { status: "published", platform_post_id: result.platform_post_id, published_at: new Date() },
          });
          successCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Error desconocido";
          errors.push(`${variant.platform}: ${msg}`);
          await prisma.postPlatformVariant.update({
            where: { id: variant.id },
            data: { status: "failed", error_message: msg },
          }).catch(() => {});
        }
      }
    } else {
      // Imported posts — derive platforms from title, use active account
      const platforms: ("instagram" | "facebook" | "linkedin")[] = [];
      if (titleLower.includes("instagram")) platforms.push("instagram");
      if (titleLower.includes("facebook"))  platforms.push("facebook");
      if (titleLower.includes("linkedin"))  platforms.push("linkedin");
      if (platforms.length === 0) platforms.push("instagram");

      for (const platform of platforms) {
        const account = await prisma.socialAccount.findFirst({
          where: {
            user_id: userId, platform, is_active: true,
            ...(platform === "linkedin" ? { account_id: { startsWith: "urn:li:organization:" } } : {}),
          },
        });
        if (!account) { errors.push(`${platform}: sin cuenta activa`); continue; }
        try {
          if (platform === "instagram") {
            await publishToInstagram(account, post.base_caption, mediaAssets, igType);
          } else if (platform === "facebook") {
            await publishToFacebook(account, post.base_caption, mediaAssets);
          } else {
            await publishToLinkedIn(account, post.base_caption, mediaAssets);
          }
          successCount++;
        } catch (err) {
          errors.push(`${platform}: ${err instanceof Error ? err.message : "Error"}`);
        }
      }
    }

    const newStatus = successCount > 0 ? "published" : "failed";
    await prisma.post.update({
      where: { id: post.id },
      data: { status: newStatus, ...(newStatus === "published" ? { published_at: new Date() } : {}) },
    });

    if (successCount === 0) throw createError(errors.join(" | "), 422);

    res.json({ ok: true, ...(errors.length ? { warnings: errors } : {}) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.post.findFirst({
      where: { id: req.params.id, user_id: req.user!.sub },
      include: {
        post_media: { include: { media_asset: true } },
      },
    });
    if (!existing) throw createError("Post not found", 404);

    // Delete associated media assets from Cloudinary and DB
    for (const pm of existing.post_media) {
      const asset = pm.media_asset;
      try {
        await deleteFromCloudinary(asset.storage_url);
      } catch {
        // If Cloudinary deletion fails, continue — we still want to remove the DB record
      }
      await prisma.mediaAsset.delete({ where: { id: asset.id } });
    }

    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
