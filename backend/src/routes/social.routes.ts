import { Router, Response } from "express";
import { ayrshareService, SocialPlatform, InstagramPostType, FacebookPostType } from "../services/ayrshare.service";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

const VALID_PLATFORMS: SocialPlatform[] = ["facebook", "linkedin", "instagram"];

router.use(requireAuth);

router.post("/publish", async (req: AuthRequest, res: Response) => {
  const { content, platforms, mediaUrls, mediaIds, instagramType, facebookType, accounts } = req.body;
  const userId = req.user!.sub;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return res.status(400).json({ error: "El contenido del post es requerido" });
  }

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: "Debes seleccionar al menos una plataforma" });
  }

  const invalidPlatforms = platforms.filter((p: string) => !VALID_PLATFORMS.includes(p as SocialPlatform));
  if (invalidPlatforms.length > 0) {
    return res.status(400).json({
      error: `Plataformas invalidas: ${invalidPlatforms.join(", ")}. Validas: ${VALID_PLATFORMS.join(", ")}`,
    });
  }

  try {
    const dbPost = await prisma.post.create({
      data: {
        user_id: userId,
        title: content.trim().slice(0, 80) || "Sin titulo",
        base_caption: content.trim(),
        status: "pending",
        scheduled_at: null,
        ...(Array.isArray(mediaIds) && mediaIds.length > 0
          ? {
              post_media: {
                create: (mediaIds as string[]).map((id, idx) => ({
                  media_asset_id: id,
                  order_index: idx,
                })),
              },
            }
          : {}),
      },
    });

    const result = await ayrshareService.publish({
      content: content.trim(),
      platforms: platforms as SocialPlatform[],
      mediaUrls: mediaUrls || [],
      instagramType: instagramType || "feed",
      facebookType: facebookType || "post",
      userId,
      accounts: accounts || undefined,
    });

    if (result.platformResults) {
      await Promise.allSettled(
        Object.entries(result.platformResults)
          .filter(([, r]) => r.socialAccountId)
          .map(([platform, r]) =>
            prisma.postPlatformVariant.create({
              data: {
                post_id: dbPost.id,
                social_account_id: r.socialAccountId!,
                platform: platform as "instagram" | "facebook" | "linkedin",
                caption: content.trim(),
                status: r.status === "success" ? "published" : "failed",
                platform_post_id: r.postUrl ?? null,
                published_at: r.status === "success" ? new Date() : null,
                error_message: r.error ?? null,
              },
            }).catch(() => {})
          )
      );
    }

    const postStatus = result.success ? "published" : "failed";
    await prisma.post.update({
      where: { id: dbPost.id },
      data: { status: postStatus, published_at: result.success ? new Date() : null },
    }).catch(() => {});

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Error al publicar" });
    }

    return res.json({ message: "Post publicado exitosamente", postId: dbPost.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return res.status(500).json({ error: message });
  }
});

router.post("/schedule", async (req: AuthRequest, res: Response) => {
  const { content, platforms, mediaUrls, mediaIds, scheduledAt, instagramType, facebookType, accounts } = req.body;
  const userId = req.user!.sub;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return res.status(400).json({ error: "El contenido del post es requerido" });
  }

  if (!scheduledAt || isNaN(Date.parse(scheduledAt))) {
    return res.status(400).json({ error: "scheduledAt debe ser una fecha valida en formato ISO 8601" });
  }

  const scheduleDate = new Date(scheduledAt);
  if (scheduleDate <= new Date()) {
    return res.status(400).json({ error: "La fecha programada debe ser en el futuro" });
  }

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: "Debes seleccionar al menos una plataforma" });
  }

  try {
    const dbPost = await prisma.post.create({
      data: {
        user_id: userId,
        title: content.trim().slice(0, 80) || "Sin titulo",
        base_caption: content.trim(),
        status: "scheduled",
        scheduled_at: scheduleDate,
        ...(Array.isArray(mediaIds) && mediaIds.length > 0
          ? {
              post_media: {
                create: (mediaIds as string[]).map((id, idx) => ({
                  media_asset_id: id,
                  order_index: idx,
                })),
              },
            }
          : {}),
      },
    });

    const platformsArr = platforms as SocialPlatform[];
    let firstVariantId: string | null = null;

    for (const platform of platformsArr) {
      let account = accounts?.[platform]
        ? await prisma.socialAccount.findFirst({
            where: { id: accounts[platform], user_id: userId, is_active: true },
          })
        : await prisma.socialAccount.findFirst({
            where: { user_id: userId, platform, is_active: true },
          });

      if (!account) continue;

      const variant = await prisma.postPlatformVariant.create({
        data: {
          post_id: dbPost.id,
          social_account_id: account.id,
          platform,
          caption: content.trim(),
          status: "scheduled",
        },
      });

      if (!firstVariantId) firstVariantId = variant.id;
    }

    if (!firstVariantId) {
      await prisma.post.delete({ where: { id: dbPost.id } });
      return res.status(400).json({ error: "No tienes cuentas conectadas para las plataformas seleccionadas" });
    }

    await prisma.scheduledPublication.create({
      data: {
        post_id: dbPost.id,
        post_variant_id: firstVariantId,
        publish_at: scheduleDate,
        status: "pending",
        job_data: {
          source: "ayrshare",
          content: content.trim(),
          platforms: platformsArr,
          mediaUrls: mediaUrls || [],
          instagramType: instagramType || "feed",
          facebookType: facebookType || "post",
          userId,
          accounts: accounts || undefined,
        },
      },
    });

    return res.json({ message: "Post programado exitosamente", postId: dbPost.id, scheduledAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return res.status(500).json({ error: message });
  }
});

router.get("/history", async (_req: AuthRequest, res: Response) => {
  try {
    const result = await ayrshareService.getHistory(20);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.json({ posts: result.posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return res.status(500).json({ error: message });
  }
});

router.get("/job/:jobId", async (req: AuthRequest, res: Response) => {
  try {
    const scheduled = await prisma.scheduledPublication.findFirst({
      where: { id: req.params.jobId },
      include: { post_variant: { select: { status: true, platform: true, error_message: true } } },
    });

    if (!scheduled) {
      return res.status(404).json({ error: "Job no encontrado" });
    }

    return res.json({
      jobId: scheduled.id,
      state: scheduled.status,
      data: scheduled.job_data,
      failedReason: scheduled.post_variant?.error_message ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return res.status(500).json({ error: message });
  }
});

router.delete("/post/:postId", async (req: AuthRequest, res: Response) => {
  try {
    const result = await ayrshareService.deletePost(req.params.postId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.json({ message: "Post eliminado exitosamente" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return res.status(500).json({ error: message });
  }
});

export default router;
