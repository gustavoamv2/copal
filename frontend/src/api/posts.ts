import api from "./client";
import { Post, PaginatedResponse } from "@/types";

export interface CreatePostBody {
  title: string;
  base_caption: string;
  status?: string;
  scheduled_at?: string | null;
  variants?: { social_account_id: string; platform: string; caption: string }[];
  media_ids?: string[];
}

export const postsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Post>>("/posts", { params }),

  get: (id: string) => api.get<Post>(`/posts/${id}`),

  create: (body: CreatePostBody) => api.post<Post>("/posts", body),

  update: (id: string, body: Partial<CreatePostBody>) => api.put<Post>(`/posts/${id}`, body),

  delete: (id: string) => api.delete(`/posts/${id}`),
};
