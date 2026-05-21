// Servicio nativo de publicación social — reemplaza Ayrshare sin costo
// Llama directamente a Meta Graph API y LinkedIn API usando tokens OAuth almacenados en BD

import { prisma } from '../prisma';
import { publishToInstagram } from './instagram.service';
import { publishToFacebook, FacebookPostType } from './facebook.service';
import { publishToLinkedIn } from './linkedin.service';
import { SocialAccount, MediaAsset } from '@prisma/client';

export type SocialPlatform = 'facebook' | 'linkedin' | 'instagram';
export type InstagramPostType = 'feed' | 'story' | 'carousel';
export type { FacebookPostType };

export interface AyrsharePostOptions {
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  scheduledAt?: string;
  instagramType?: InstagramPostType;
  facebookType?: FacebookPostType;
  userId: string;
  /** Optional: map platform → specific account DB id to use instead of findFirst */
  accounts?: Partial<Record<SocialPlatform, string>>;
}

export interface AyrsharePostResult {
  success: boolean;
  postId?: string;
  platformResults?: Record<string, { status: string; postUrl?: string; error?: string; socialAccountId?: string }>;
  error?: string;
}

class NativeSocialService {

  async publish(options: AyrsharePostOptions): Promise<AyrsharePostResult> {
    const { content, platforms, mediaUrls = [], userId, facebookType } = options;
    const platformResults: Record<string, { status: string; postUrl?: string; error?: string; socialAccountId?: string }> = {};

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
      let account: SocialAccount | null = null;
      try {
        const specificId = options.accounts?.[platform];
        if (specificId) {
          account = await prisma.socialAccount.findFirst({
            where: { id: specificId, user_id: userId, is_active: true },
          });
        } else if (platform === 'linkedin') {
          // Prefer personal accounts — org accounts need w_organization_social (not approved)
          account =
            await prisma.socialAccount.findFirst({
              where: {
                user_id: userId, platform, is_active: true,
                NOT: { account_id: { startsWith: 'urn:li:organization:' } },
              },
            }) ??
            await prisma.socialAccount.findFirst({
              where: { user_id: userId, platform, is_active: true },
            });
        } else {
          account = await prisma.socialAccount.findFirst({
            where: { user_id: userId, platform, is_active: true },
          });
        }

        if (!account) {
          platformResults[platform] = { status: 'error', error: `No hay cuenta de ${platform} conectada` };
          continue;
        }

        if (platform === 'instagram') {
          const result = await publishToInstagram(account, content, mediaAssets, options.instagramType ?? 'feed');
          platformResults[platform] = { status: 'success', postUrl: result.platform_post_id, socialAccountId: account.id };
        } else if (platform === 'facebook') {
          const result = await publishToFacebook(account, content, mediaAssets, facebookType);
          platformResults[platform] = { status: 'success', postUrl: result.platform_post_id, socialAccountId: account.id };
        } else if (platform === 'linkedin') {
          const result = await publishToLinkedIn(account, content, mediaAssets);
          platformResults[platform] = { status: 'success', postUrl: result.platform_post_id, socialAccountId: account.id };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        platformResults[platform] = { status: 'error', error: message, ...(account ? { socialAccountId: account.id } : {}) };
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
