import apiClient from "./client";

export type SocialPlatform = "facebook" | "linkedin" | "instagram" | "whatsapp";
export type InstagramPostType = "feed" | "story" | "carousel";

export interface PublishPayload {
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  scheduledAt?: string;
  instagramType?: InstagramPostType;
}

export const socialApi = {
  publish: (payload: PublishPayload) =>
    apiClient.post<{ message: string; jobId: string }>("/social/publish", {
      content: payload.content,
      platforms: payload.platforms,
      mediaUrls: payload.mediaUrls ?? [],
      instagramType: payload.instagramType ?? "feed",
      ...(payload.scheduledAt ? { scheduledAt: payload.scheduledAt } : {}),
    }),

  schedule: (payload: PublishPayload & { scheduledAt: string }) =>
    apiClient.post<{ message: string; jobId: string; scheduledAt: string }>("/social/schedule", {
      content: payload.content,
      platforms: payload.platforms,
      mediaUrls: payload.mediaUrls ?? [],
      scheduledAt: payload.scheduledAt,
    }),

  getJob: (jobId: string) =>
    apiClient.get<{ jobId: string; state: string; data: unknown }>(`/social/job/${jobId}`),
};
