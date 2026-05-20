import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsApi } from "@/api/posts";
import { publicationsApi } from "@/api/publications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { PostDetailModal } from "@/components/PostDetailModal";
import { toast } from "@/hooks/useToast";
import { formatDateTime } from "@/lib/utils";
import { ImportCalendarButton } from "@/components/ImportCalendarModal";
import type { Post } from "@/types";
import { Platform, PublicationStatus } from "@/types";
import { RefreshCw, FileText, Rss } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500",
  facebook: "bg-blue-600",
  linkedin: "bg-blue-800",
};

function PlatformDot({ platform }: { platform?: string }) {
  if (!platform) return <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />;
  return (
    <span
      className={`h-2 w-2 rounded-full shrink-0 ${PLATFORM_COLORS[platform] ?? "bg-indigo-500"}`}
      title={platform}
    />
  );
}

// ─── Tab types ───────────────────────────────────────────────────────────────

type Tab = "posts" | "jobs";

// ─── Posts tab (imported + manually saved) ───────────────────────────────────

const POST_STATUS_FILTERS = [
  { label: "Todas", value: "" },
  { label: "Programadas", value: "scheduled" },
  { label: "Borrador", value: "draft" },
];

function PostsTab() {
  const qc = useQueryClient();
  const [status,       setStatus]       = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [checked,      setChecked]      = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["posts", { status, limit: 500 }],
    queryFn: () =>
      postsApi.list({ status: status || undefined, limit: 500 }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const posts = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => postsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Publicación eliminada" });
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const toggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checked.size === posts.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(posts.map((p) => p.id)));
    }
  };

  const bulkDelete = async () => {
    if (checked.size === 0) return;
    setBulkDeleting(true);
    let ok = 0;
    for (const id of checked) {
      try { await postsApi.delete(id); ok++; } catch { /* continue */ }
    }
    setChecked(new Set());
    qc.invalidateQueries({ queryKey: ["posts"] });
    toast({ title: `${ok} publicación${ok !== 1 ? "es" : ""} eliminada${ok !== 1 ? "s" : ""}` });
    setBulkDeleting(false);
  };

  return (
    <div className="space-y-4">
      {/* Filters + bulk actions */}
      <div className="flex flex-wrap gap-2 items-center">
        {POST_STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={status === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatus(f.value); setChecked(new Set()); }}
          >
            {f.label}
          </Button>
        ))}

        {checked.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={bulkDelete}
            disabled={bulkDeleting}
          >
            {bulkDeleting ? "Eliminando..." : `Eliminar ${checked.size} seleccionada${checked.size !== 1 ? "s" : ""}`}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary cursor-pointer"
            checked={posts.length > 0 && checked.size === posts.length}
            onChange={toggleAll}
            title="Seleccionar todas"
          />
          <CardTitle className="text-base">{data?.total ?? 0} publicaciones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-px p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-muted/50 mb-2 rounded-md" />
              ))}
            </div>
          ) : !posts.length ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              No hay publicaciones con este filtro
            </p>
          ) : (
            <div className="divide-y divide-border">
              {posts.map((post) => {
                const platforms = post.variants.map((v) => v.platform);
                const inferredPlatform = platforms.length === 0
                  ? post.title.toLowerCase().includes("instagram") ? "Instagram"
                    : post.title.toLowerCase().includes("facebook") ? "Facebook"
                    : post.title.toLowerCase().includes("linkedin") ? "LinkedIn"
                    : null
                  : null;
                const inferredType = post.title.toLowerCase().includes("story") || post.title.toLowerCase().includes("reel") ? "Story/Reel"
                  : post.title.toLowerCase().includes("carrusel") || post.title.toLowerCase().includes("carousel") ? "Carrusel"
                  : platforms.length === 0 ? "Post" : null;
                const isChecked = checked.has(post.id);

                return (
                  <div
                    key={post.id}
                    className={`flex items-center gap-4 px-6 py-3 hover:bg-accent/30 transition-colors cursor-pointer ${isChecked ? "bg-accent/20" : ""}`}
                    onClick={() => setSelectedPost(post)}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary cursor-pointer shrink-0"
                      checked={isChecked}
                      onClick={(e) => toggleCheck(post.id, e)}
                      onChange={() => {}}
                    />

                    {/* Platform dot */}
                    <div className="flex gap-1 shrink-0">
                      {platforms.length > 0
                        ? platforms.map((p, i) => <PlatformDot key={i} platform={p} />)
                        : <PlatformDot platform={inferredPlatform?.toLowerCase()} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5 flex-wrap">
                        {platforms.length > 0 ? (
                          <span className="capitalize font-medium text-foreground/70">
                            {platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" / ")}
                          </span>
                        ) : inferredPlatform ? (
                          <span className="font-medium text-foreground/70">{inferredPlatform}</span>
                        ) : null}
                        {(platforms.length > 0 || inferredPlatform) && inferredType && <span className="text-muted-foreground/50">·</span>}
                        {inferredType && <span>{inferredType}</span>}
                      </div>
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.scheduled_at ? formatDateTime(post.scheduled_at) : "Sin fecha programada"}
                      </p>
                    </div>

                    <StatusBadge status={post.status as PublicationStatus} />

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(post.id); }}
                      disabled={deleteMutation.isPending}
                    >
                      Eliminar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}

// ─── Jobs tab (BullMQ via scheduled_publications) ────────────────────────────

const JOB_STATUS_FILTERS = [
  { label: "Todas", value: "" },
  { label: "Pendientes", value: "pending" },
  { label: "Publicadas", value: "published" },
  { label: "Fallidas", value: "failed" },
];

function JobsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["publications", { status }],
    queryFn: () =>
      publicationsApi.list({ status: status || undefined, limit: 50 }).then((r) => r.data),
    refetchInterval: 15_000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => publicationsApi.retry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
      toast({ title: "Publicación puesta en cola para reintento" });
    },
    onError: () => toast({ title: "Error al reintentar", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {JOB_STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={status === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{data?.total ?? 0} jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-px p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-muted/50 mb-2 rounded-md" />
              ))}
            </div>
          ) : !data?.data.length ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              No hay jobs con este filtro
            </p>
          ) : (
            <div className="divide-y divide-border">
              {data.data.map((pub) => (
                <div key={pub.id} className="flex items-center gap-4 px-6 py-3 hover:bg-accent/30 transition-colors">
                  <PlatformDot platform={pub.post_variant?.platform as Platform} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pub.post?.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(pub.publish_at)}</p>
                  </div>
                  <StatusBadge status={pub.status as PublicationStatus} />
                  {pub.status === "failed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => retryMutation.mutate(pub.id)}
                      disabled={retryMutation.isPending}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Reintentar
                    </Button>
                  )}
                  {pub.attempt_count > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {pub.attempt_count} intento(s)
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function Scheduled() {
  const [tab, setTab] = useState<Tab>("posts");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Publicaciones programadas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona el contenido guardado y los jobs de publicación
          </p>
        </div>
        <ImportCalendarButton />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border border-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("posts")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "posts"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          Publicaciones
        </button>
        <button
          onClick={() => setTab("jobs")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "jobs"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Rss className="h-4 w-4" />
          Jobs de red social
        </button>
      </div>

      {tab === "posts" ? <PostsTab /> : <JobsTab />}
    </div>
  );
}
