// src/services/ayrshare.service.ts

export type SocialPlatform = 'facebook' | 'linkedin' | 'instagram';

export interface AyrsharePostOptions {
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  scheduledAt?: string; // ISO 8601, ej: "2026-05-20T10:00:00Z"
}

export interface AyrsharePostResult {
  success: boolean;
  postId?: string;
  platformResults?: Record<string, { status: string; postUrl?: string; error?: string }>;
  error?: string;
}

class AyrshareService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://app.ayrshare.com/api';

  constructor() {
    this.apiKey = process.env.AYRSHARE_API_KEY ?? '';
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Publica un post en una o varias redes sociales
   */
  async publish(options: AyrsharePostOptions): Promise<AyrsharePostResult> {
    try {
      const body: Record<string, unknown> = {
        post: options.content,
        platforms: options.platforms,
      };

      if (options.mediaUrls && options.mediaUrls.length > 0) {
        body.mediaUrls = options.mediaUrls;
      }

      if (options.scheduledAt) {
        body.scheduleDate = options.scheduledAt;
      }

      const response = await fetch(`${this.baseUrl}/post`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await response.json() as any;

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `Error HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        postId: data.id,
        platformResults: data.postIds,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return { success: false, error: message };
    }
  }

  /**
   * Obtiene el historial de posts publicados
   */
  async getHistory(limit = 20): Promise<{ success: boolean; posts?: unknown[]; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/history?limit=${limit}`, {
        method: 'GET',
        headers: this.headers,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await response.json() as any;

      if (!response.ok) {
        return { success: false, error: data.message || `Error HTTP ${response.status}` };
      }

      return { success: true, posts: Array.isArray(data) ? data : data.history ?? [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return { success: false, error: message };
    }
  }

  /**
   * Elimina un post publicado
   */
  async deletePost(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/post`, {
        method: 'DELETE',
        headers: this.headers,
        body: JSON.stringify({ id: postId }),
      });

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await response.json() as any;
        return { success: false, error: data.message || `Error HTTP ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return { success: false, error: message };
    }
  }
}

// Singleton para reutilizar en toda la app
export const ayrshareService = new AyrshareService();
