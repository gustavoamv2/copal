// src/jobs/social-publish.job.ts
// Worker de BullMQ — procesa los posts en segundo plano
// Agregar este worker a tu proceso de workers existente

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { ayrshareService, SocialPlatform, InstagramPostType, FacebookPostType, AyrsharePostOptions } from '../services/ayrshare.service';
import { prisma } from '../prisma';
import { config } from '../config';

export interface SocialPublishJobData {
  postId: string;
  dbPostId?: string; // Post record id in DB (if created by social route)
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  scheduledAt?: string;
  instagramType?: InstagramPostType;
  facebookType?: FacebookPostType;
  userId: string;
  accounts?: AyrsharePostOptions['accounts'];
}

const QUEUE_NAME = 'social-publish';

const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

export const socialPublishWorker = new Worker<SocialPublishJobData>(
  QUEUE_NAME,
  async (job: Job<SocialPublishJobData>) => {
    const { postId, dbPostId, content, platforms, mediaUrls, scheduledAt, instagramType, facebookType, userId, accounts } = job.data;

    console.log(`[SocialPublish] Procesando post ${postId} para: ${platforms.join(', ')}`);

    const result = await ayrshareService.publish({
      content,
      platforms,
      mediaUrls,
      scheduledAt,
      instagramType,
      facebookType,
      userId,
      accounts,
    });

    // Persist per-platform results as PostPlatformVariant records so errors
    // are visible in History (failureReason reads variant.error_message)
    if (dbPostId && result.platformResults) {
      await Promise.allSettled(
        Object.entries(result.platformResults)
          .filter(([, r]) => r.socialAccountId)
          .map(([platform, r]) =>
            prisma.postPlatformVariant.create({
              data: {
                post_id: dbPostId,
                social_account_id: r.socialAccountId!,
                platform: platform as 'instagram' | 'facebook' | 'linkedin',
                caption: content,
                status: r.status === 'success' ? 'published' : 'failed',
                platform_post_id: r.postUrl ?? null,
                published_at: r.status === 'success' ? new Date() : null,
                error_message: r.error ?? null,
              },
            }).catch(() => {})
          )
      );
    }

    if (!result.success) {
      const details = result.platformResults
        ? Object.entries(result.platformResults)
            .filter(([, v]) => v.status === 'error')
            .map(([p, v]) => `${p}: ${v.error}`)
            .join('; ')
        : result.error;

      if (dbPostId) {
        await prisma.post.update({
          where: { id: dbPostId },
          data: { status: 'failed' },
        }).catch(() => {});
      }

      throw new Error(`Publish failed — ${details}`);
    }

    if (dbPostId) {
      await prisma.post.update({
        where: { id: dbPostId },
        data: { status: 'published', published_at: new Date() },
      }).catch(() => {});
    }

    console.log(`[SocialPublish] Post ${postId} publicado.`);
    return result;
  },
  {
    connection,
    concurrency: 3,
  }
);

socialPublishWorker.on('completed', (job) => {
  console.log(`[SocialPublish] Job ${job.id} completado`);
});

socialPublishWorker.on('failed', (job, err) => {
  console.error(`[SocialPublish] Job ${job?.id} falló:`, err.message);
});
