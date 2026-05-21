// Servicio nativo de publicación social — reemplaza Ayrshare sin costo
// Llama directamente a Meta Graph API y LinkedIn API usando tokens OAuth almacenados en BD

import { prisma } from '../prisma';
import { publishToInstagram } from './instagram.service';
import { publishToFacebook } from './facebook.service';
import { publishToLinkedIn } from './linkedin.service';
import { SocialAccount, MediaAsset } from '@prisma/client';

export type SocialPlatform = 'facebook' | 'linkedin' | 'instagram';
export type InstagramPostType = 'feed' | 'story' | 'carousel';

export interface AyrsharePostOptions {
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  scheduledAt?: string;
  instagramType?: InstagramPostType;
  userId: string;
}

export interface AyrsharePostResult {
  success: boolean;
  postId?: string;
  platformResults?: Record<string, { status: string; postUrl?: string; error?: string }>;
  error?: string;
}

class NativeSocialService {

  async publish(options: AyrsharePostOptions): Promise<AyrsharePostResult> {
    const { content, platforms, mediaUrls = [], userId } = options;
    const platformResults: Record<string, { status: string; postUrl?: string; error?: string }> = {};

    // Construir MediaAsset[] sintéticos a partir de las URLs de Cloudinary
    const mediaAssets: MediaAsset[] = mediaUrls.map((url, i) => ({
      id: `temp-${i}`,
      user_id: userId,
      filename: `media-${i}`,
      storage_url: url,
      thumbnail_url: null,
      file_type: url.match(/\.(mp4|mov|avi|webm)$/i) ? 'video/mp4' : 'image/jpeg',
      file_size_bytes: 0,
      tags: [],
      uploaded_at: new Date(),
    }));

    for (const platform of platforms) {
      try {
        const account = await prisma.socialAccount.findFirst({
          where: { user_id: userId, platform, is_active: true },
        });

        if (!account) {
          platformResults[platform] = { status: 'error', error: `No hay cuenta de ${platform} conectada` };
          continue;
        }

        if (platform === 'instagram') {
          const result = await publishToInstagram(account, content, mediaAssets);
          platformResults[platform] = { status: 'success', postUrl: result.platform_post_id };
        } else if (platform === 'facebook') {
          const result = await publishToFacebook(account, content, mediaAssets);
          platformResults[platform] = { status: 'success', postUrl: result.platform_post_id };
        } else if (platform === 'linkedin') {
          const result = await publishToLinkedIn(account, content, mediaAssets);
          platformResults[platform] = { status: 'success', postUrl: result.platform_post_id };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        platformResults[platform] = { status: 'error', error: message };
      }
    }

    const allFailed = Object.values(platformResults).every(r => r.status === 'error');

    return {
      success: !allFailed,
      postId: `native-${Date.now()}`,
      platformResults,
      ...(allFailed ? { error: 'Todos los envíos fallaron' } : {}),
    };
  }

  async getHistory(_limit = 20): Promise<{ success: boolean; posts?: unknown[]; error?: string }> {
    return { success: true, posts: [] };
  }

  async deletePost(_postId: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }
}

export const ayrshareService = new NativeSocialService();
