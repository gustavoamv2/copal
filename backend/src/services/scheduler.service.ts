import { prisma } from "../prisma";

export async function schedulePublication(
  postId: string,
  postVariantId: string,
  socialAccountId: string,
  publishAt: Date
): Promise<void> {
  const existing = await prisma.scheduledPublication.findFirst({
    where: { post_variant_id: postVariantId, status: "pending" },
  });

  if (existing) {
    await prisma.scheduledPublication.delete({ where: { id: existing.id } });
  }

  await prisma.scheduledPublication.create({
    data: {
      post_id: postId,
      post_variant_id: postVariantId,
      social_account_id: socialAccountId,
      publish_at: publishAt,
      status: "pending",
    },
  });
}
