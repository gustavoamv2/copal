import api from "./client";
import { MediaAsset, PaginatedResponse } from "@/types";

export const mediaApi = {
  list: (params?: { type?: string; page?: number; limit?: number; tag?: string }) =>
    api.get<PaginatedResponse<MediaAsset>>("/media", { params }),

  upload: (file: File, tags?: string[]) => {
    const form = new FormData();
    form.append("file", file);
    if (tags?.length) form.append("tags", tags.join(","));
    return api.post<MediaAsset>("/media/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  delete: (id: string) => api.delete(`/media/${id}`),
};
