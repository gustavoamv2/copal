export type Platform = "instagram" | "facebook" | "linkedin";
export type PostStatus = "draft" | "pending" | "approved" | "scheduled" | "published" | "failed";
export type PublicationStatus = "pending" | "processing" | "published" | "failed";
export type UserRole = "admin" | "editor";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  timezone: string;
  created_at: string;
}

export interface SocialAccount {
  id: string;
  platform: Platform;
  account_name: string;
  account_id: string;
  is_active: boolean;
  token_expires_at: string | null;
  created_at: string;
}

export interface MediaAsset {
  id: string;
  user_id: string;
  filename: string;
  file_type: string;
  storage_url: string;
  thumbnail_url: string | null;
  file_size_bytes: number;
  tags: string[];
  uploaded_at: string;
}

export interface PostVariant {
  id: string;
  post_id: string;
  social_account_id: string;
  platform: Platform;
  caption: string;
  status: PostStatus;
  platform_post_id: string | null;
  published_at: string | null;
  error_message: string | null;
  social_account?: Pick<SocialAccount, "id" | "account_name" | "platform">;
}

export interface PostMedia {
  id: string;
  post_id: string;
  media_asset_id: string;
  order_index: number;
  media_asset: MediaAsset;
}

export interface Post {
  id: string;
  user_id: string;
  title: string;
  base_caption: string;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  variants: PostVariant[];
  post_media: PostMedia[];
}

export interface ScheduledPublication {
  id: string;
  post_id: string;
  post_variant_id: string;
  publish_at: string;
  status: PublicationStatus;
  attempt_count: number;
  last_attempt_at: string | null;
  worker_job_id: string | null;
  post?: Pick<Post, "id" | "title" | "status">;
  post_variant?: Pick<PostVariant, "platform" | "caption">;
}

export interface PublicationLog {
  id: string;
  post_variant_id: string;
  social_account_id: string;
  action: string;
  result: string;
  api_response: unknown;
  error_detail: string | null;
  logged_at: string;
}

export interface DashboardMetrics {
  scheduled: number;
  publishedToday: number;
  published: number;
  drafts: number;
  failed: number;
  upcoming: ScheduledPublication[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
}
