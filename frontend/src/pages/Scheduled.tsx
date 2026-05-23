import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsApi } from "@/api/posts";
import { publicationsApi } from "@/api/publications";
import { accountsApi } from "@/api/accounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { PostDetailModal } from "@/components/PostDetailModal";
import { toast } from "@/hooks/useToast";
import { formatDateTime } from "@/lib/utils";
import { ImportCalendarButton } from "@/components/ImportCalendarModal";
import type { Post } from "@/types";
import { Platform, PublicationStatus } from "@/types";
import { RefreshCw, FileText, Rss, Info, Linkedin, CheckCircle2 } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-500",
  facebook: "bg-blue-600",
  linkedin: "bg-blue-800",
  whatsapp: "bg-green-500",
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

type Tab = "posts" | "jobs" | "manual";

// ─── Posts tab (imported + manually saved) ───────────────────────────────────

const POST_STATUS_FILTERS = [
  { label: "Todas", value: "" },
  { label: "Programadas", value: "scheduled" },
  { label: "Publicadas", value: "published" },
  { label: "Borrador", value: "draft" },
  { label: "Fallidas", value: "failed" },
];

function PostsTab({ initialStatus = "" }: { initialStatus?: string }) {
  const qc = useQueryClient();
  const [status,       setStatus]       = useState(initialStatus);
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
                    : post.title.toLowerCase().includes("whatsapp") ? "WhatsApp"
                    : null
                  : null;
                const inferredType = post.title.toLowerCase().includes("story") || post.title.toLowerCase().includes("reel") ? "Story/Reel"
                  : post.title.toLowerCase().includes("carrusel") || post.title.toLowerCase().includes("carousel") ? "Carrusel"
                  : platforms.length === 0 ? "Post" : null;
                const isChecked = checked.has(post.id);

                return (
                  <div
                    key={post.id}
                    className={`flex items-center gap-4 px-6 py-3 hover:bg-accent/30 transition-colors cursor-pointer ${isChecked ? "bg-accent/20" : ""} ${post.status === "published" ? "opacity-50" : ""}`}
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

function JobsTab({ initialStatus = "", filterToday = false }: { initialStatus?: string; filterToday?: boolean }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(initialStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["publications", { status }],
    queryFn: () =>
      publicationsApi.list({ status: status || undefined, limit: 200 }).then((r) => r.data),
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

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const displayedJobs = filterToday
    ? (data?.data ?? []).filter((pub) => {
        const d = new Date(pub.publish_at);
        return d >= todayStart && d <= todayEnd;
      })
    : (data?.data ?? []);

  return (
    <div className="space-y-4">
      {filterToday && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/25 bg-green-500/8 px-3.5 py-2 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Mostrando publicaciones de <strong>hoy</strong></span>
        </div>
      )}
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
          <CardTitle className="text-base">{displayedJobs.length} jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-px p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-muted/50 mb-2 rounded-md" />
              ))}
            </div>
          ) : !displayedJobs.length ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              No hay jobs con este filtro
            </p>
          ) : (
            <div className="divide-y divide-border">
              {displayedJobs.map((pub) => (
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

// ─── Manual pending tab (LinkedIn) ──────────────────────────────────────────

function ManualPendingTab() {
  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list().then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["posts", { limit: 500 }],
    queryFn: () => postsApi.list({ limit: 500 }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  // URL de la página de empresa LinkedIn si existe
  const linkedInOrgAccount = (accountsData ?? []).find(
    (a) => a.platform === "linkedin" && a.is_active && a.account_id.startsWith("urn:li:organization:")
  );
  const linkedInOrgId = linkedInOrgAccount?.account_id.replace("urn:li:organization:", "");

  const downloadImages = async (assets: Array<{ storage_url: string; filename: string }>) => {
    for (const asset of assets) {
      try {
        const res = await fetch(asset.storage_url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = asset.filename || "imagen-linkedin.jpg";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(asset.storage_url, "_blank");
      }
    }
  };

  const copyAndOpenLinkedIn = async (
    caption: string,
    media: Array<{ storage_url: string; filename: string }>
  ) => {
    try { await navigator.clipboard.writeText(caption); } catch {}

    if (media.length > 0) {
      await downloadImages(media);
    }

    const url = linkedInOrgId
      ? `https://www.linkedin.com/company/${linkedInOrgId}/admin/page-posts/new/`
      : "https://www.linkedin.com/feed/";
    window.open(url, "_blank");

    const imgMsg = media.length > 0
      ? ` · ${media.length} imagen${media.length > 1 ? "es descargadas" : " descargada"}`
      : "";
    toast({ title: `Caption copiado${imgMsg} ✓ — pega el texto y sube la imagen en LinkedIn` });
  };

  const allPosts = data?.data ?? [];

  // Posts de LinkedIn no publicados aún
  const linkedInPosts = allPosts.filter((post) => {
    if (post.status === "published") return false;
    const hasLinkedInVariant = post.variants.some((v) => v.platform === "linkedin");
    const hasLinkedInInTitle = post.title.toLowerCase().includes("linkedin");
    return hasLinkedInVariant || hasLinkedInInTitle;
  });

  // Agrupar por día
  const grouped = linkedInPosts.reduce<Record<string, Post[]>>((acc, post) => {
    const dateKey = post.scheduled_at
      ? new Date(post.scheduled_at).toLocaleDateString("es-CL", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Sin fecha";
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(post);
    return acc;
  }, {});

  // Ordenar grupos por fecha real
  const sortedDays = Object.entries(grouped).sort(([, a], [, b]) => {
    const da = a[0].scheduled_at ? new Date(a[0].scheduled_at).getTime() : 0;
    const db = b[0].scheduled_at ? new Date(b[0].scheduled_at).getTime() : 0;
    return da - db;
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse bg-muted/50 rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Aviso informativo */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/25 bg-blue-500/8 px-3.5 py-2.5 text-sm text-blue-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Las publicaciones de LinkedIn importadas desde el calendario no se programan automáticamente.
          Usa el botón de cada post para copiar el texto y abrirlo directamente en LinkedIn Empresa.
        </span>
      </div>

      {linkedInPosts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm space-y-2">
          <p className="text-3xl">✅</p>
          <p>No hay publicaciones de LinkedIn pendientes de publicación manual</p>
        </div>
      ) : (
        sortedDays.map(([dayLabel, posts]) => (
          <div key={dayLabel} className="space-y-2">
            {/* Cabecera de día */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground capitalize px-2 tracking-wide">
                {dayLabel}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Posts del día */}
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {posts.map((post) => {
                  const caption = post.base_caption;
                  const mediaAssets = post.post_media.map((pm) => pm.media_asset);
                  const firstImage = mediaAssets[0];
                  const timeLabel = post.scheduled_at
                    ? new Date(post.scheduled_at).toLocaleTimeString("es-CL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  return (
                    <div key={post.id} className="flex items-start gap-3 px-4 py-3">
                      {/* Thumbnail o LinkedIn dot */}
                      {firstImage ? (
                        <img
                          src={firstImage.thumbnail_url ?? firstImage.storage_url}
                          alt={firstImage.filename}
                          className="h-14 w-14 rounded-md object-cover shrink-0 border border-border"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-md bg-[#0A66C2]/10 flex items-center justify-center shrink-0 border border-[#0A66C2]/20">
                          <Linkedin className="h-6 w-6 text-[#0A66C2]" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {timeLabel && (
                            <span className="text-xs font-mono text-muted-foreground bg-accent/30 px-1.5 py-0.5 rounded">
                              {timeLabel}
                            </span>
                          )}
                          <StatusBadge status={post.status as PublicationStatus} />
                          {mediaAssets.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {mediaAssets.length} imagen{mediaAssets.length > 1 ? "es" : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {caption.slice(0, 130)}{caption.length > 130 ? "…" : ""}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-[#0A66C2]/40 text-[#0A66C2] hover:bg-[#0A66C2]/10 hover:text-[#3b82f6] gap-1.5 whitespace-nowrap"
                        onClick={() => copyAndOpenLinkedIn(caption, mediaAssets)}
                      >
                        📋 {mediaAssets.length > 0 ? "Copiar + imagen" : "Copiar y abrir"}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function Scheduled() {
  const [searchParams] = useSearchParams();

  const urlTab     = (searchParams.get("tab") as Tab) ?? "posts";
  const urlStatus  = searchParams.get("status") ?? "";
  const urlToday   = searchParams.get("today") === "1";

  const [tab, setTab] = useState<Tab>(urlTab);

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
      <div className="flex gap-1 border border-border rounded-lg p-1 w-fit flex-wrap">
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
        <button
          onClick={() => setTab("manual")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "manual"
              ? "bg-[#0A66C2] text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Linkedin className="h-4 w-4" />
          Pendiente manual
        </button>
      </div>

      {tab === "posts"  ? <PostsTab initialStatus={urlStatus} /> :
       tab === "jobs"   ? <JobsTab  initialStatus={urlStatus} filterToday={urlToday} /> :
                          <ManualPendingTab />}
    </div>
  );
}
