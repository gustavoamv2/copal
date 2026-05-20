// src/components/SocialPublishButton.tsx (Frontend React)
// Componente listo para usar en cualquier parte de Copal

import { useState } from 'react';
import { useSocialPublish } from '../hooks/useSocialPublish';

type Platform = 'facebook' | 'linkedin' | 'instagram';

interface Props {
  content: string;
  mediaUrls?: string[];
  onSuccess?: (jobId: string) => void;
  onError?: (error: string) => void;
}

const PLATFORMS: { id: Platform; label: string; color: string }[] = [
  { id: 'facebook',  label: 'Facebook',  color: 'bg-blue-600' },
  { id: 'linkedin',  label: 'LinkedIn',  color: 'bg-sky-700' },
  { id: 'instagram', label: 'Instagram', color: 'bg-pink-600' },
];

export const SocialPublishButton = ({ content, mediaUrls, onSuccess, onError }: Props) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['facebook', 'linkedin']);
  const [scheduledAt, setScheduledAt] = useState('');
  const [showScheduler, setShowScheduler] = useState(false);
  const { publish, loading, result } = useSocialPublish();

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) return;

    const res = await publish({
      content,
      platforms: selectedPlatforms,
      mediaUrls,
      scheduledAt: scheduledAt || undefined,
    });

    if (res.success && res.jobId) {
      onSuccess?.(res.jobId);
    } else if (res.error) {
      onError?.(res.error);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      {/* Selector de plataformas */}
      <p className="text-sm font-medium text-gray-700">Publicar en:</p>
      <div className="flex gap-2 flex-wrap">
        {PLATFORMS.map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => togglePlatform(id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all
              ${selectedPlatforms.includes(id)
                ? `${color} text-white`
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Programar publicación */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowScheduler(!showScheduler)}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          {showScheduler ? 'Publicar ahora' : 'Programar para después'}
        </button>
      </div>

      {showScheduler && (
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {/* Botón publicar */}
      <button
        onClick={handlePublish}
        disabled={loading || selectedPlatforms.length === 0 || !content}
        className="w-full py-2 px-4 rounded-lg text-white font-medium text-sm
          bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors"
      >
        {loading
          ? 'Publicando...'
          : scheduledAt
          ? 'Programar publicación'
          : 'Publicar ahora'}
      </button>

      {/* Feedback */}
      {result && (
        <p className={`text-sm ${result.success ? 'text-green-600' : 'text-red-500'}`}>
          {result.success ? `✓ ${result.message}` : `✗ ${result.error}`}
        </p>
      )}
    </div>
  );
};
