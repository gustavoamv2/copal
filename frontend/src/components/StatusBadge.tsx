import { cn } from "@/lib/utils";
import { PostStatus, PublicationStatus } from "@/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";

interface Props {
  status: PostStatus | PublicationStatus;
  className?: string;
}

export function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        STATUS_COLORS[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
