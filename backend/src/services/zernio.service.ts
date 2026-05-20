// src/services/zernio.service.ts

export type SocialPlatform = 'facebook' | 'linkedin' | 'instagram';

export interface ZernioPostOptions {
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];       // URLs de imágenes/videos (puede usar URLs de Cloudinary)
  scheduledAt?: string;       // ISO 8601, ej: "2026-05-20T10:00:00Z"
}

export interface ZernioPostResult {
  success: boolean;
  postId?: string;
  platformResults?: Record<string, { success: boolean; postId?: string; error?: string }>;
  error?: string;
}

class ZernioService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://zernio.com/api/v1';

  constructor() {
    this.apiKey = process.env.ZERNIO_API_KEY ?? '';
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
  async publish(options: ZernioPostOptions): Promise<ZernioPostResult> {
    try {
      const body: Record<string, unknown> = {
        content: options.content,
        platforms: options.platforms.map(p => ({ platform: p })),
      };

      if (options.mediaUrls && options.mediaUrls.length > 0) {
        body.mediaUrls = options.mediaUrls;
      }

      if (options.scheduledAt) {
        body.scheduledFor = options.scheduledAt;
      }

      const response = await fetch(`${this.baseUrl}/posts`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `Error HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        postId: data.id || data.postId,
        platformResults: data.platforms,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return { success: false, error: message };
    }
  }

  /**
   * Programa un post para publicarse en el futuro
   */
  async schedule(options: ZernioPostOptions & { scheduledAt: string }): Promise<ZernioPostResult> {
    return this.publish(options);
  }

  /**
   * Obtiene el historial de posts publicados
   */
  async getHistory(limit = 20): Promise<{ success: boolean; posts?: unknown[]; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/posts?limit=${limit}`, {
        method: 'GET',
        headers: this.headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || `Error HTTP ${response.status}` };
      }

      return { success: true, posts: data.posts || data };
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
      const response = await fetch(`${this.baseUrl}/posts/${postId}`, {
        method: 'DELETE',
        headers: this.headers,
      });

      if (!response.ok) {
        const data = await response.json();
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
export const zernioService = new ZernioService();
