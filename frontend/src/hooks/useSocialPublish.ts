// src/hooks/useSocialPublish.ts (Frontend React)
// Hook para publicar posts desde cualquier componente

import { useState } from 'react';

type Platform = 'facebook' | 'linkedin' | 'instagram';

interface PublishOptions {
  content: string;
  platforms: Platform[];
  mediaUrls?: string[];
  scheduledAt?: string; // ISO 8601 para programar
}

interface PublishResult {
  success: boolean;
  jobId?: string;
  message?: string;
  error?: string;
}

export const useSocialPublish = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);

  const publish = async (options: PublishOptions): Promise<PublishResult> => {
    setLoading(true);
    setResult(null);

    try {
      const endpoint = options.scheduledAt
        ? '/api/social/schedule'
        : '/api/social/publish';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Para enviar la cookie JWT httpOnly
        body: JSON.stringify(options),
      });

      const data = await response.json();

      const res: PublishResult = response.ok
        ? { success: true, jobId: data.jobId, message: data.message }
        : { success: false, error: data.error };

      setResult(res);
      return res;
    } catch (error) {
      const res: PublishResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión',
      };
      setResult(res);
      return res;
    } finally {
      setLoading(false);
    }
  };

  return { publish, loading, result };
};
