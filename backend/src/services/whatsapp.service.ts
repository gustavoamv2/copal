import { prisma } from "../prisma";
import { SocialAccount } from "@prisma/client";

export function getWhatsAppStatus(userId: string): { registered: boolean; deviceName?: string } {
  return { registered: false };
}

export async function getWhatsAppAccount(userId: string): Promise<SocialAccount | null> {
  return prisma.socialAccount.findFirst({
    where: { user_id: userId, platform: "whatsapp", is_active: true },
  });
}

export async function registerWhatsAppDevice(userId: string, deviceName: string, phoneNumber: string): Promise<SocialAccount> {
  const existing = await prisma.socialAccount.findFirst({
    where: { user_id: userId, platform: "whatsapp" },
  });

  if (existing) {
    return prisma.socialAccount.update({
      where: { id: existing.id },
      data: { account_name: deviceName || phoneNumber, account_id: phoneNumber, is_active: true },
    });
  }

  return prisma.socialAccount.create({
    data: {
      user_id: userId,
      platform: "whatsapp",
      account_name: deviceName || phoneNumber,
      account_id: phoneNumber,
      access_token_enc: "",
      is_active: true,
    },
  });
}

export async function unregisterWhatsAppDevice(userId: string): Promise<void> {
  await prisma.socialAccount.updateMany({
    where: { user_id: userId, platform: "whatsapp" },
    data: { is_active: false },
  });
}

export async function getPendingPublication(userId: string) {
  const stuckThreshold = new Date(Date.now() - 3 * 60 * 1000);
  await prisma.scheduledPublication.updateMany({
    where: {
      status: "processing",
      last_attempt_at: { lt: stuckThreshold },
      post_variant: { platform: "whatsapp", post: { user_id: userId } },
    },
    data: { status: "pending" },
  });

  const result = await prisma.$transaction(async (tx) => {
    const scheduled = await tx.scheduledPublication.findFirst({
      where: {
        status: "pending",
        publish_at: { lte: new Date() },
        post_variant: {
          platform: "whatsapp",
          post: { user_id: userId },
        },
      },
      include: {
        post_variant: {
          include: {
            post: {
              include: {
                post_media: {
                  include: { media_asset: true },
                  orderBy: { order_index: "asc" },
                },
              },
            },
          },
        },
      },
      orderBy: { publish_at: "asc" },
    });

    if (!scheduled) return null;

    await tx.scheduledPublication.update({
      where: { id: scheduled.id },
      data: { status: "processing", attempt_count: { increment: 1 }, last_attempt_at: new Date() },
    });

    const { post_variant } = scheduled;
    const { post } = post_variant;

    const assetUrls = post.post_media.map((pm) => pm.media_asset.storage_url);
    const jobData = scheduled.job_data as { mediaUrls?: string[] } | null;
    const mediaUrls = assetUrls.length > 0 ? assetUrls : (jobData?.mediaUrls ?? []);

    return {
      id: scheduled.id,
      caption: post_variant.caption,
      mediaUrls,
      postTitle: post.title,
    };
  });

  return result;
}

export async function reportPublicationResult(
  scheduledId: string,
  userId: string,
  success: boolean,
  error?: string
): Promise<void> {
  const scheduled = await prisma.scheduledPublication.findFirst({
    where: {
      id: scheduledId,
      post_variant: { platform: "whatsapp", post: { user_id: userId } },
    },
    include: { post_variant: { select: { id: true, post_id: true } } },
  });

  if (!scheduled) throw new Error("ScheduledPublication not found");

  const isLastAttempt = scheduled.attempt_count >= 3;

  if (success) {
    await prisma.$transaction([
      prisma.scheduledPublication.update({
        where: { id: scheduled.id },
        data: { status: "published" },
      }),
      prisma.postPlatformVariant.update({
        where: { id: scheduled.post_variant.id },
        data: { status: "published", published_at: new Date() },
      }),
    ]);

    const pendingVariants = await prisma.postPlatformVariant.count({
      where: { post_id: scheduled.post_variant.post_id, status: { notIn: ["published", "failed"] } },
    });
    if (pendingVariants === 0) {
      await prisma.post.update({
        where: { id: scheduled.post_variant.post_id },
        data: { status: "published", published_at: new Date() },
      });
    }
  } else {
    await prisma.$transaction([
      prisma.scheduledPublication.update({
        where: { id: scheduled.id },
        data: {
          status: isLastAttempt ? "failed" : "pending",
          ...(isLastAttempt ? {} : { publish_at: new Date(Date.now() + 60 * 1000) }),
        },
      }),
      prisma.postPlatformVariant.update({
        where: { id: scheduled.post_variant.id },
        data: {
          status: isLastAttempt ? "failed" : "scheduled",
          error_message: error ?? "Unknown error",
        },
      }),
    ]);

    if (isLastAttempt) {
      await prisma.post.update({
        where: { id: scheduled.post_variant.post_id },
        data: { status: "failed" },
      });
    }
  }
}
