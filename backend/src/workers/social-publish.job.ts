// src/jobs/social-publish.job.ts
// Worker de BullMQ — procesa los posts en segundo plano
// Agregar este worker a tu proceso de workers existente

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { ayrshareService, SocialPlatform, InstagramPostType, AyrsharePostOptions } from '../services/ayrshare.service';
import { config } from '../config';

export interface SocialPublishJobData {
  postId: string;
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  scheduledAt?: string;
  instagramType?: InstagramPostType;
  userId: string;
  accounts?: AyrsharePostOptions['accounts'];
}

const QUEUE_NAME = 'social-publish';

const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

export const socialPublishWorker = new Worker<SocialPublishJobData>(
  QUEUE_NAME,
  async (job: Job<SocialPublishJobData>) => {
    const { postId, content, platforms, mediaUrls, scheduledAt, instagramType, userId, accounts } = job.data;

    console.log(`[SocialPublish] Procesando post ${postId} para: ${platforms.join(', ')}`);

    const result = await ayrshareService.publish({
      content,
      platforms,
      mediaUrls,
      scheduledAt,
      instagramType,
      userId,
      accounts,
    });

    if (!result.success) {
      const details = result.platformResults
        ? Object.entries(result.platformResults)
            .filter(([, v]) => v.status === 'error')
            .map(([p, v]) => `${p}: ${v.error}`)
            .join('; ')
        : result.error;
      throw new Error(`Publish failed — ${details}`);
    }

    console.log(`[SocialPublish] Post ${postId} publicado. ID: ${result.postId}`);

    // Aquí puedes actualizar el estado del post en Prisma
    // await prisma.post.update({
    //   where: { id: postId },
    //   data: {
    //     publishedAt: new Date(),
    //     zernioPostId: result.postId,
    //     status: 'PUBLISHED',
    //   },
    // });

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
