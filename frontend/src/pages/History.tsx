import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, AlertCircle } from "lucide-react";
import { postsApi } from "@/api/posts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function failureReason(post: Post): string | null {
  if (post.status !== "failed") return null;
  const msg = post.variants.find((v) => v.error_message)?.error_message;
  return msg ?? null;
}

export function History() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["posts", { status, page }],
    queryFn: () =>
      postsApi.list({ status: status || undefined, page, limit: LIMIT }).then((r) => r.data),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);

  const filtered = (data?.data ?? []).filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.base_caption.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="text-muted-foreground text-sm mt-1">Todas tus publicaciones pasadas y presentes</p>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f}
              variant={status === f ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatus(f); setPage(1); setSearch(""); }}
            >
              {STATUS_LABELS[f]}
            </Button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar publicaciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {search ? `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}` : `${data?.total ?? 0} publicaciones`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-muted rounded-md" />
              ))}
            </div>
          ) : !filtered.length ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              {search ? "Sin resultados para esa búsqueda" : "Sin publicaciones"}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((post) => {
                const reason = failureReason(post);
                return (
                  <div
                    key={post.id}
                    className="flex items-start gap-4 px-6 py-3 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedPost(post)}
                  >
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.published_at
                          ? `Publicado ${formatDateTime(post.published_at)}`
                          : post.scheduled_at
                          ? `Programado ${formatDateTime(post.scheduled_at)}`
                          : `Creado ${formatDateTime(post.created_at)}`}
                      </p>
                      {reason && (
                        <p className="text-xs text-red-400 mt-0.5 flex items-center gap-1 truncate">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {reason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mt-1">
                      {post.variants.slice(0, 3).map((v) => (
                        <PlatformBadge key={v.id} platform={v.platform as Platform} />
                      ))}
                    </div>
                    <div className="shrink-0 mt-1">
                      <StatusBadge status={post.status as PostStatus} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!search && totalPages > 1 && (
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
