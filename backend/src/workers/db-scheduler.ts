import { prisma } from "../prisma";
import { publishToInstagram } from "../services/instagram.service";
import { publishToFacebook } from "../services/facebook.service";
import { publishToLinkedIn } from "../services/linkedin.service";
import { ayrshareService } from "../services/ayrshare.service";
import type { SocialPlatform, AyrsharePostOptions, InstagramPostType, FacebookPostType } from "../services/ayrshare.service";
import type { MediaAsset, PostStatus } from "@prisma/client";

const POLL_INTERVAL_MS = 60_000;

interface AyrshareJobData {
  source: "ayrshare";
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  instagramType?: InstagramPostType;
  facebookType?: FacebookPostType;
  userId: string;
  accounts?: AyrsharePostOptions["accounts"];
}

function isAyrshareJob(data: unknown): data is AyrshareJobData {
  return typeof data === "object" && data !== null && (data as any).source === "ayrshare";
}

async function processAyrshareJob(scheduled: {
  id: string;
  post_id: string;
  post_variant_id: string;
  attempt_count: number;
  job_data: unknown;
  post_variant: {
    id: string;
    platform: string;
    status: PostStatus;
    post: {
      id: string;
      title: string;
      status: PostStatus;
    };
  };
}) {
  const data = scheduled.job_data as AyrshareJobData;

  const result = await ayrshareService.publish({
    content: data.content,
    platforms: data.platforms,
    mediaUrls: data.mediaUrls,
    instagramType: data.instagramType,
    facebookType: data.facebookType,
    userId: data.userId,
    accounts: data.accounts,
  });

  if (result.platformResults) {
    for (const [platform, r] of Object.entries(result.platformResults)) {
      if (r.socialAccountId) {
        const existing = await prisma.postPlatformVariant.findFirst({
          where: { post_id: scheduled.post_id, platform: platform as "instagram" | "facebook" | "linkedin", social_account_id: r.socialAccountId },
        });

        if (existing) {
          await prisma.postPlatformVariant.update({
            where: { id: existing.id },
            data: {
              status: r.status === "success" ? "published" : "failed",
              platform_post_id: r.postUrl ?? null,
              published_at: r.status === "success" ? new Date() : null,
              error_message: r.error ?? null,
            },
          }).catch(() => {});
        } else if (r.status === "success") {
          await prisma.postPlatformVariant.create({
            data: {
              post_id: scheduled.post_id,
              social_account_id: r.socialAccountId,
              platform: platform as "instagram" | "facebook" | "linkedin",
              caption: data.content,
              status: "published",
              platform_post_id: r.postUrl ?? null,
              published_at: new Date(),
            },
          }).catch(() => {});
        }
      }
    }
  }

  if (!result.success) {
    const details = result.platformResults
      ? Object.entries(result.platformResults)
          .filter(([, v]) => v.status === "error")
          .map(([p, v]) => `${p}: ${v.error}`)
          .join("; ")
      : result.error;

    const isLastAttempt = scheduled.attempt_count >= 3;

    const failedVariants = await prisma.postPlatformVariant.findMany({
      where: { post_id: scheduled.post_id },
      select: { id: true },
    });

    if (failedVariants.length > 0) {
      await prisma.postPlatformVariant.updateMany({
        where: { post_id: scheduled.post_id },
        data: isLastAttempt
          ? { status: "failed", error_message: details ?? "Publish failed" }
          : {},
      });
    }

    await prisma.scheduledPublication.update({
      where: { id: scheduled.id },
      data: { status: isLastAttempt ? "failed" : "pending" },
    });

    if (isLastAttempt) {
      await prisma.post.update({ where: { id: scheduled.post_id }, data: { status: "failed" } });
    }

    console.error(`[Scheduler] Ayrshare job ${scheduled.id} failed: ${details}`);
    return;
  }

  await prisma.$transaction([
    prisma.scheduledPublication.update({
      where: { id: scheduled.id },
      data: { status: "published" },
    }),
    prisma.post.update({
      where: { id: scheduled.post_id },
      data: { status: "published", published_at: new Date() },
    }),
  ]);

  console.log(`[Scheduler] Ayrshare job ${scheduled.id} completed`);
}

async function processDirectJob(scheduled: {
  id: string;
  post_id: string;
  post_variant_id: string;
  attempt_count: number;
  post_variant: {
    id: string;
    platform: string;
    caption: string;
    status: PostStatus;
    social_account: { id: string };
    post: {
      id: string;
      title: string;
      status: PostStatus;
      post_media: { media_asset: MediaAsset }[];
    };
  };
}) {
  const { post_variant } = scheduled;
  const { social_account, post, platform, caption } = post_variant;
  const mediaAssets = post.post_media.map((pm) => pm.media_asset);
  const titleLower = post.title.toLowerCase();

  try {
    let platformPostId: string;
    let apiResponse: unknown;

    if (platform === "whatsapp") {
      // WhatsApp publications are handled by the phone device (MacroDroid polling)
      // Don't fail — leave as pending. The phone will pick it up and report back.
      await prisma.scheduledPublication.update({
        where: { id: scheduled.id },
        data: { status: "pending" },
      });
      return;
    }

    if (platform === "instagram") {
      const igType: "feed" | "story" | "carousel" | "reel" =
        mediaAssets.length > 1 ? "carousel"
        : titleLower.includes("reel") ? "reel"
        : titleLower.includes("story") || titleLower.includes("historia") ? "story"
        : "feed";
      const result = await publishToInstagram(social_account as any, caption, mediaAssets as any, igType);
      platformPostId = result.platform_post_id;
      apiResponse = result.api_response;
    } else if (platform === "facebook") {
      const fbType: "post" | "reel" | "story" =
        titleLower.includes("reel") ? "reel"
        : titleLower.includes("story") || titleLower.includes("historia") ? "story"
        : "post";
      const result = await publishToFacebook(social_account as any, caption, mediaAssets as any, fbType);
      platformPostId = result.platform_post_id;
      apiResponse = result.api_response;
    } else if (platform === "linkedin") {
      const result = await publishToLinkedIn(social_account as any, caption, mediaAssets as any);
      platformPostId = result.platform_post_id;
      apiResponse = result.api_response;
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    await prisma.$transaction([
      prisma.scheduledPublication.update({
        where: { id: scheduled.id },
        data: { status: "published" },
      }),
      prisma.postPlatformVariant.update({
        where: { id: post_variant.id },
        data: { status: "published", platform_post_id: platformPostId, published_at: new Date() },
      }),
      prisma.publicationLog.create({
        data: {
          post_variant_id: post_variant.id,
          social_account_id: social_account.id,
          action: "publish",
          result: "success",
          api_response: apiResponse as object,
        },
      }),
    ]);

    const pendingVariants = await prisma.postPlatformVariant.count({
      where: { post_id: post.id, status: { notIn: ["published", "failed"] } },
    });
    if (pendingVariants === 0) {
      await prisma.post.update({
        where: { id: post.id },
        data: { status: "published", published_at: new Date() },
      });
    }

    console.log(`[Scheduler] Published ${platform} post for variant ${post_variant.id}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isLastAttempt = scheduled.attempt_count >= 2;

    await prisma.$transaction([
      prisma.scheduledPublication.update({
        where: { id: scheduled.id },
        data: { status: isLastAttempt ? "failed" : "pending" },
      }),
      prisma.postPlatformVariant.update({
        where: { id: post_variant.id },
        data: { status: isLastAttempt ? "failed" : post_variant.status, error_message: errorMessage },
      }),
      prisma.publicationLog.create({
        data: {
          post_variant_id: post_variant.id,
          social_account_id: social_account.id,
          action: "publish",
          result: "error",
          error_detail: errorMessage,
        },
      }),
    ]);

    if (isLastAttempt) {
      await prisma.post.update({ where: { id: post.id }, data: { status: "failed" } });
    }

    console.error(`[Scheduler] Failed to publish variant ${post_variant.id} (attempt ${scheduled.attempt_count}): ${errorMessage}`);
  }
}

export async function processDuePublications(): Promise<void> {
  const due = await prisma.scheduledPublication.findMany({
    where: {
      status: "pending",
      publish_at: { lte: new Date() },
      post_variant: { platform: { not: "whatsapp" } },
    },
    include: {
      post_variant: {
        include: {
          social_account: true,
          post: {
            include: {
              post_media: { include: { media_asset: true }, orderBy: { order_index: "asc" } },
            },
          },
        },
      },
    },
    take: 20,
  });

  for (const scheduled of due) {
    await prisma.scheduledPublication.update({
      where: { id: scheduled.id },
      data: { status: "processing", attempt_count: { increment: 1 }, last_attempt_at: new Date() },
    });

    if (isAyrshareJob(scheduled.job_data)) {
      await processAyrshareJob(scheduled as any);
    } else {
      await processDirectJob(scheduled as any);
    }
  }
}

export function startDbScheduler(): NodeJS.Timeout {
  console.log("[Scheduler] DB-based scheduler started (polling every 60s)");
  processDuePublications().catch((e) => console.error("[Scheduler] Poll error:", e));
  return setInterval(() => {
    processDuePublications().catch((e) => console.error("[Scheduler] Poll error:", e));
  }, POLL_INTERVAL_MS);
}
