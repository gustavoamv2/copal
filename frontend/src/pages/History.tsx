import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { postsApi } from "@/api/posts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformBadge } from "@/components/PlatformBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { PostDetailModal } from "@/components/PostDetailModal";
import { formatDateTime } from "@/lib/utils";
import type { Post } from "@/types";
import { Platform, PostStatus } from "@/types";

const STATUS_FILTERS = ["", "published", "failed", "draft", "scheduled"];
const STATUS_LABELS: Record<string, string> = {
  "": "Todos",
  published: "Publicados",
  failed: "Fallidos",
  draft: "Borradores",
  scheduled: "Programados",
};

export function History() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["posts", { status, page }],
    queryFn: () =>
      postsApi.list({ status: status || undefined, page, limit: LIMIT }).then((r) => r.data),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="text-muted-foreground text-sm mt-1">Todas tus publicaciones pasadas y presentes</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f}
            variant={status === f ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatus(f);
              setPage(1);
            }}
          >
            {STATUS_LABELS[f]}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{data?.total ?? 0} publicaciones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-muted rounded-md" />
              ))}
            </div>
          ) : !data?.data.length ? (
            <p className="text-center py-12 text-muted-foreground text-sm">Sin publicaciones</p>
          ) : (
            <div className="divide-y divide-border">
              {data.data.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-4 px-6 py-3 hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedPost(post)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {post.published_at
                        ? `Publicado ${formatDateTime(post.published_at)}`
                        : post.scheduled_at
                        ? `Programado ${formatDateTime(post.scheduled_at)}`
                        : `Creado ${formatDateTime(post.created_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {post.variants.slice(0, 3).map((v) => (
                      <PlatformBadge key={v.id} platform={v.platform as Platform} />
                    ))}
                  </div>
                  <StatusBadge status={post.status as PostStatus} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
