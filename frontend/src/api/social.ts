import apiClient from "./client";

export type SocialPlatform = "facebook" | "linkedin" | "instagram" | "whatsapp";
export type InstagramPostType = "feed" | "story" | "carousel" | "reel";
export type FacebookPostType = "post" | "reel";

export interface PublishPayload {
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  mediaIds?: string[];
  scheduledAt?: string;
  instagramType?: InstagramPostType;
  facebookType?: FacebookPostType;
  accounts?: Partial<Record<SocialPlatform, string>>;
}

export const socialApi = {
  publish: (payload: PublishPayload) =>
    apiClient.post<{ message: string; jobId: string }>("/social/publish", {
      content: payload.content,
      platforms: payload.platforms,
      mediaUrls: payload.mediaUrls ?? [],
      instagramType: payload.instagramType ?? "feed",
      facebookType: payload.facebookType ?? "post",
      ...(payload.mediaIds?.length ? { mediaIds: payload.mediaIds } : {}),
      ...(payload.accounts ? { accounts: payload.accounts } : {}),
      ...(payload.scheduledAt ? { scheduledAt: payload.scheduledAt } : {}),
    }),

  schedule: (payload: PublishPayload & { scheduledAt: string }) =>
    apiClient.post<{ message: string; jobId: string; scheduledAt: string }>("/social/schedule", {
      content: payload.content,
      platforms: payload.platforms,
      mediaUrls: payload.mediaUrls ?? [],
      scheduledAt: payload.scheduledAt,
      instagramType: payload.instagramType ?? "feed",
      facebookType: payload.facebookType ?? "post",
      ...(payload.mediaIds?.length ? { mediaIds: payload.mediaIds } : {}),
      ...(payload.accounts ? { accounts: payload.accounts } : {}),
    }),

  getJob: (jobId: string) =>
    apiClient.get<{ jobId: string; state: string; data: unknown }>(`/social/job/${jobId}`),
};
