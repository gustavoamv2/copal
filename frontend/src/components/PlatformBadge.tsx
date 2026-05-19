import { cn } from "@/lib/utils";
import { Platform } from "@/types";
import { Instagram, Facebook, Linkedin } from "lucide-react";

const icons: Record<Platform, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
};

interface Props {
  platform: Platform;
  className?: string;
}

export function PlatformBadge({ platform, className }: Props) {
  const Icon = icons[platform];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        `platform-${platform}`,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </span>
  );
}
