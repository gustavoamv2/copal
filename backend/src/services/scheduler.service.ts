import { publicationQueue } from "../workers/publication.worker";
import { prisma } from "../prisma";

export async function schedulePublication(
  postId: string,
  postVariantId: string,
  socialAccountId: string,
  publishAt: Date
): Promise<void> {
  const delay = Math.max(0, publishAt.getTime() - Date.now());

  // Cancel any existing pending job for this variant
  const existing = await prisma.scheduledPublication.findFirst({
    where: { post_variant_id: postVariantId, status: "pending" },
  });

  if (existing?.worker_job_id) {
    const job = await publicationQueue.getJob(existing.worker_job_id);
    await job?.remove();
    await prisma.scheduledPublication.delete({ where: { id: existing.id } });
  }

  const scheduled = await prisma.scheduledPublication.create({
    data: {
      post_id: postId,
      post_variant_id: postVariantId,
      social_account_id: socialAccountId,
      publish_at: publishAt,
      status: "pending",
    },
  });

  const job = await publicationQueue.add(
    "publish",
    { scheduledPublicationId: scheduled.id },
    {
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: false,
      removeOnFail: false,
    }
  );

  await prisma.scheduledPublication.update({
    where: { id: scheduled.id },
    data: { worker_job_id: job.id ?? null },
  });
}
