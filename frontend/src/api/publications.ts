import api from "./client";
import { ScheduledPublication, PublicationLog, PaginatedResponse } from "@/types";

export const publicationsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<ScheduledPublication>>("/publications", { params }),

  retry: (id: string) => api.post(`/publications/${id}/retry`),

  logs: (variantId: string) => api.get<PublicationLog[]>(`/publications/${variantId}/logs`),
};
