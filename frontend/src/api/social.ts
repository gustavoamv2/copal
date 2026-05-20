import apiClient from "./client";

export type SocialPlatform = "facebook" | "linkedin" | "instagram";

export interface PublishPayload {
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  scheduledAt?: string;
}

export const socialApi = {
  publish: (payload: PublishPayload) =>
    apiClient.post<{ message: string; jobId: string }>("/social/publish", {
      content: payload.content,
      platforms: payload.platforms,
      mediaUrls: payload.mediaUrls ?? [],
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
