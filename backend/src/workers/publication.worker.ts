import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";
import { prisma } from "../prisma";
import { publishToInstagram } from "../services/instagram.service";
import { publishToFacebook } from "../services/facebook.service";
import { publishToLinkedIn } from "../services/linkedin.service";

const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

export const publicationQueue = new Queue("publications", { connection });

interface PublishJobData {
  scheduledPublicationId: string;
}

async function processJob(job: Job<PublishJobData>): Promise<void> {
  const { scheduledPublicationId } = job.data;

  const scheduled = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
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
  });

  if (!scheduled) throw new Error(`ScheduledPublication ${scheduledPublicationId} not found`);
  if (scheduled.status === "published") return;

  await prisma.scheduledPublication.update({
    where: { id: scheduled.id },
    data: { status: "processing", attempt_count: { increment: 1 }, last_attempt_at: new Date() },
  });

  const { post_variant } = scheduled;
  const { social_account, post, platform, caption } = post_variant;
  const mediaAssets = post.post_media.map((pm) => pm.media_asset);

  let platformPostId: string;
  let apiResponse: unknown;

  try {
    let result: { platform_post_id: string; api_response: unknown };

    if (platform === "instagram") {
      // Infer instagram type from media: video → reel, multiple → carousel, else → feed
      const igType = mediaAssets.length > 1
        ? "carousel"
        : mediaAssets[0]?.file_type.startsWith("video/")
          ? "feed" // REELS handled inside service by detecting video
          : "feed";
      result = await publishToInstagram(social_account, caption, mediaAssets, igType);
    } else if (platform === "facebook") {
      result = await publishToFacebook(social_account, caption, mediaAssets);
    } else if (platform === "linkedin") {
      result = await publishToLinkedIn(social_account, caption, mediaAssets);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    platformPostId = result.platform_post_id;
    apiResponse = result.api_response;

    // Success
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

    // Mark parent post as published if all variants are done
    const pendingVariants = await prisma.postPlatformVariant.count({
      where: { post_id: post.id, status: { notIn: ["published", "failed"] } },
    });
    if (pendingVariants === 0) {
      await prisma.post.update({
        where: { id: post.id },
        data: { status: "published", published_at: new Date() },
      });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3) - 1;

    await prisma.$transaction([
      prisma.scheduledPublication.update({
        where: { id: scheduled.id },
        data: { status: isLastAttempt ? "failed" : "pending" },
      }),
      prisma.postPlatformVariant.update({
        where: { id: post_variant.id },
        data: {
          status: isLastAttempt ? "failed" : post_variant.status,
          error_message: errorMessage,
        },
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
      await prisma.post.update({
        where: { id: post.id },
        data: { status: "failed" },
      });
    }

    throw err; // Let BullMQ handle retries
  }
}

export function startWorker(): Worker<PublishJobData> {
  const worker = new Worker<PublishJobData>("publications", processJob, {
    connection,
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  return worker;
}
