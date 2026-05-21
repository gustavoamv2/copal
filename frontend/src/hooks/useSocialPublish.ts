import { useState } from "react";
import { socialApi, SocialPlatform, InstagramPostType } from "@/api/social";

interface PublishOptions {
  content: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  scheduledAt?: string;
  instagramType?: InstagramPostType;
  accounts?: Partial<Record<SocialPlatform, string>>;
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
      const isScheduled = !!options.scheduledAt;
      const response = isScheduled
        ? await socialApi.schedule({ ...options, scheduledAt: options.scheduledAt!, accounts: options.accounts })
        : await socialApi.publish({ ...options, accounts: options.accounts });

      const res: PublishResult = {
        success: true,
        jobId: response.data.jobId,
        message: response.data.message,
      };
      setResult(res);
      return res;
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (error instanceof Error ? error.message : "Error de conexión");
      const res: PublishResult = { success: false, error: message };
      setResult(res);
      return res;
    } finally {
      setLoading(false);
    }
  };

  return { publish, loading, result };
};
