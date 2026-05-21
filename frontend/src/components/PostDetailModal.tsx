import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Check, Heart, MessageCircle, Send,
  Bookmark, ThumbsUp, Share2, MoreHorizontal, ChevronLeft,
  Trash2, Zap, ExternalLink,
} from "lucide-react";
import { BrandAvatar } from "@/components/BrandAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { postsApi } from "@/api/posts";
import { useSocialPublish } from "@/hooks/useSocialPublish";
import { toast } from "@/hooks/useToast";
import type { Post, Platform } from "@/types";

type ViewMode  = "preview" | "edit";
type NetworkTab = Platform | "generic";

// ---------------------------------------------------------------------------
// Shared image block — shows all images; carousels are slideable
// ---------------------------------------------------------------------------
function PostImage({ urls, isStory }: { urls: string[]; isStory?: boolean }) {
  const [idx, setIdx] = useState(0);
  const maxH = isStory ? "520px" : "480px";

  if (urls.length === 0) {
    return (
      <div className={`w-full bg-[#222] flex items-center justify-center text-gray-500 text-xs ${isStory ? "min-h-[320px]" : "min-h-[200px]"}`}>
        Sin imagen
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black select-none">
      <img
        src={urls[idx]}
        alt=""
        className="w-full block object-contain"
        style={{ maxHeight: maxH }}
      />
      {/* Carousel counter + arrows */}
      {urls.length > 1 && (
        <>
          <span className="absolute top-2 right-2 bg-black/60 text-white rounded-full px-2 py-0.5 text-[10px]">
            {idx + 1} / {urls.length}
          </span>
          {idx > 0 && (
            <button
              onClick={() => setIdx(idx - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
            >
              ‹
            </button>
          )}
          {idx < urls.length - 1 && (
            <button
              onClick={() => setIdx(idx + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
            >
              ›
            </button>
          )}
          {/* Dot indicators */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
// Avatar delegated to BrandAvatar component
function Avatar({ size = 36, ring = false }: { size?: number; ring?: boolean }) {
  return <BrandAvatar size={size} ring={ring} />;
}

// ---------------------------------------------------------------------------
// Caption with expand
// ---------------------------------------------------------------------------
function Caption({ text, className = "text-gray-300" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 300;
  const short = text.length > LIMIT && !expanded ? text.slice(0, LIMIT) + "…" : text;
  return (
    <span className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {short}
      {text.length > LIMIT && !expanded && (
        <button className="text-gray-500 ml-1 text-xs" onClick={() => setExpanded(true)}>
          más
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Instagram card
// ---------------------------------------------------------------------------
function InstagramCard({ caption, imageUrls, instagramType, dateLabel }: {
  caption: string; imageUrls: string[]; instagramType?: string; dateLabel: string;
}) {
  const isStory    = instagramType === "story";
  const isCarousel = instagramType === "carousel" || imageUrls.length > 1;

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#111] text-white text-sm shadow-xl">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar size={32} ring />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-tight">actualizateconia</p>
          {isStory    && <p className="text-[10px] text-gray-400">Historia</p>}
          {isCarousel && <p className="text-[10px] text-gray-400">Carrusel</p>}
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>
      <PostImage urls={imageUrls} isStory={isStory} />
      <div className="flex items-center gap-3.5 px-3 py-2.5">
        <Heart className="h-6 w-6" />
        <MessageCircle className="h-6 w-6" />
        <Send className="h-6 w-6" />
        <Bookmark className="h-6 w-6 ml-auto" />
      </div>
      <div className="px-3 pb-4 space-y-1.5">
        <p className="text-xs">
          <span className="font-semibold mr-1">actualizateconia</span>
          <Caption text={caption} className="text-gray-200" />
        </p>
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{dateLabel}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Facebook card
// ---------------------------------------------------------------------------
function FacebookCard({ caption, imageUrls, dateLabel }: {
  caption: string; imageUrls: string[]; dateLabel: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#18191a] text-white text-sm shadow-xl">
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <Avatar size={40} />
        <div className="flex-1">
          <p className="text-xs font-semibold leading-tight">Actualizate con IA</p>
          <p className="text-[10px] text-gray-400">{dateLabel} · 🌐</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>
      <div className="px-3 pb-2.5">
        <p className="text-xs text-gray-200 leading-relaxed">
          <Caption text={caption} className="text-gray-200" />
        </p>
      </div>
      <PostImage urls={imageUrls} />
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-gray-400 border-t border-[#3a3b3c]">
        <span>👍 ❤️ Me gusta</span>
        <span className="flex gap-3"><span>Comentar</span><span>Compartir</span></span>
      </div>
      <div className="flex items-center px-3 pb-2 gap-1 border-t border-[#3a3b3c]">
        {[
          { icon: <ThumbsUp className="h-4 w-4" />, label: "Me gusta" },
          { icon: <MessageCircle className="h-4 w-4" />, label: "Comentar" },
          { icon: <Share2 className="h-4 w-4" />, label: "Compartir" },
        ].map(({ icon, label }) => (
          <button key={label} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-gray-400 hover:bg-[#3a3b3c] rounded-md">
            {icon} {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkedIn card
// ---------------------------------------------------------------------------
function LinkedInCard({ caption, imageUrls, dateLabel }: {
  caption: string; imageUrls: string[]; dateLabel: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#1b1f23] text-white text-sm shadow-xl">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
        <Avatar size={44} />
        <div className="flex-1">
          <p className="text-xs font-semibold leading-tight">Actualizate con IA</p>
          <p className="text-[10px] text-gray-400">Empresa · {dateLabel}</p>
          <p className="text-[10px] text-gray-500">🌐 Para todos</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-200 leading-relaxed">
          <Caption text={caption} className="text-gray-200" />
        </p>
      </div>
      <PostImage urls={imageUrls} />
      <div className="px-4 py-1.5 flex items-center justify-between text-[10px] text-gray-500 border-t border-[#2c3036]">
        <span>👍 💡 ❤️ 12</span>
        <span>0 comentarios · 0 reposts</span>
      </div>
      <div className="flex items-center px-2 pb-3 gap-0.5 border-t border-[#2c3036]">
        {[
          { icon: <ThumbsUp className="h-4 w-4" />, label: "Recomendar" },
          { icon: <MessageCircle className="h-4 w-4" />, label: "Comentar" },
          { icon: <Share2 className="h-4 w-4" />, label: "Compartir" },
          { icon: <Send className="h-4 w-4" />, label: "Enviar" },
        ].map(({ icon, label }) => (
          <button key={label} className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] text-gray-400 hover:bg-[#2c3036] rounded-md">
            {icon} {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic card (no platform)
// ---------------------------------------------------------------------------
function GenericCard({ caption, imageUrls, dateLabel }: {
  caption: string; imageUrls: string[]; dateLabel: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card text-foreground text-sm shadow-xl">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <Avatar size={36} />
        <div className="flex-1">
          <p className="text-xs font-semibold">Actualizate con IA</p>
          <p className="text-[10px] text-muted-foreground">{dateLabel}</p>
        </div>
      </div>
      <PostImage urls={imageUrls} />
      <div className="px-3 py-3">
        <Caption text={caption} className="text-foreground/80" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostDetailModal
// ---------------------------------------------------------------------------
interface PostDetailModalProps {
  post: Post;
  onClose: () => void;
}

export function PostDetailModal({ post, onClose }: PostDetailModalProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<ViewMode>("preview");

  const platforms    = post.variants.map((v) => v.platform as Platform);
  const unique       = Array.from(new Set(platforms));
  const tabs: NetworkTab[] = unique.length > 0 ? unique : ["generic"];
  const [activeTab, setActiveTab] = useState<NetworkTab>(tabs[0]);

  const imageUrls = (post.post_media ?? [])
    .map((pm) => pm.media_asset?.storage_url)
    .filter((url): url is string => Boolean(url));

  const dateRef = post.published_at ?? post.scheduled_at;
  const dateLabel = dateRef
    ? new Date(dateRef).toLocaleString("es-CL", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "Sin fecha";

  // Detect instagram type from title
  const titleLower = post.title.toLowerCase();
  const instagramType = titleLower.includes("story") || titleLower.includes("reel") ? "story"
    : titleLower.includes("carrusel") || titleLower.includes("carousel") ? "carousel"
    : "feed";

  // Edit state
  const [title,       setTitle]       = useState(post.title);
  const [caption,     setCaption]     = useState(post.base_caption);
  const [scheduledAt, setScheduledAt] = useState(post.scheduled_at?.slice(0, 16) ?? "");

  const updateMutation = useMutation({
    mutationFn: () =>
      postsApi.update(post.id, {
        title,
        base_caption: caption,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Publicación actualizada" });
      onClose();
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => postsApi.delete(post.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Publicación eliminada" });
      onClose();
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);

  // Publish now
  const { publish, loading: publishing } = useSocialPublish();
  const publishPlatforms = unique.length > 0
    ? (unique as string[]).filter((p): p is "instagram" | "facebook" | "linkedin" => p !== "generic")
    : (titleLower.includes("instagram") ? ["instagram"]
      : titleLower.includes("facebook") ? ["facebook"]
      : ["linkedin"]) as ("instagram" | "facebook" | "linkedin")[];

  const handlePublish = async () => {
    const mediaUrls = imageUrls.length > 0 ? imageUrls : undefined;
    const mediaIds = (post.post_media ?? []).map((pm) => pm.media_asset_id).filter(Boolean);
    const res = await publish({
      content: post.base_caption,
      platforms: publishPlatforms,
      mediaUrls,
      mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
      instagramType: instagramType as "feed" | "story" | "carousel",
    });
    if (res.success) {
      toast({ title: "¡Publicado correctamente!" });
      onClose();
    } else {
      toast({ title: res.error ?? "Error al publicar", variant: "destructive" });
    }
  };

  const handleReprogramar = () => {
    navigate("/posts/new", {
      state: {
        prefill: {
          title: post.title,
          caption: post.base_caption,
          scheduledAt: post.scheduled_at,
          media: (post.post_media ?? []).map((pm) => pm.media_asset),
          platforms: publishPlatforms,
          instagramType: instagramType as "feed" | "story" | "carousel",
          facebookType: "post" as "post" | "reel",
        },
      },
    });
    onClose();
  };

  const TAB_COLORS: Record<NetworkTab, string> = {
    instagram: "bg-pink-600 text-white border-transparent",
    facebook:  "bg-blue-700 text-white border-transparent",
    linkedin:  "bg-blue-900 text-white border-transparent",
    generic:   "bg-primary text-primary-foreground border-transparent",
  };
  const TAB_LABELS: Record<NetworkTab, string> = {
    instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", generic: "Vista previa",
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {mode === "edit" && (
              <button
                onClick={() => setMode("preview")}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent/30 text-muted-foreground shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <span className="text-sm font-medium truncate">{post.title}</span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent/30 text-muted-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Network tabs (preview mode only) ───────────────── */}
        {tabs.length > 1 && mode === "preview" && (
          <div className="flex gap-1 px-4 pt-3 shrink-0">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeTab === t ? TAB_COLORS[t] : "border-border text-muted-foreground hover:border-border/60"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        )}

        {/* ── Scrollable body ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mode === "preview" ? (
            <>
              {activeTab === "instagram" && (
                <InstagramCard
                  caption={caption}
                  imageUrls={imageUrls}
                  instagramType={instagramType}
                  dateLabel={dateLabel}
                />
              )}
              {activeTab === "facebook" && (
                <FacebookCard caption={caption} imageUrls={imageUrls} dateLabel={dateLabel} />
              )}
              {activeTab === "linkedin" && (
                <LinkedInCard caption={caption} imageUrls={imageUrls} dateLabel={dateLabel} />
              )}
              {activeTab === "generic" && (
                <GenericCard caption={caption} imageUrls={imageUrls} dateLabel={dateLabel} />
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Título interno</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Caption</Label>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={9}
                  className="text-sm resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha y hora de publicación</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="px-4 pb-4 pt-3 border-t border-border shrink-0 space-y-2">
          {mode === "preview" ? (
            <>
              {/* Delete confirm row */}
              {confirmDelete && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2">
                  <p className="text-xs text-destructive flex-1">¿Eliminar esta publicación?</p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDelete(false)}>
                    No
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs gap-1"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                    {deleteMutation.isPending ? "Eliminando..." : "Sí, eliminar"}
                  </Button>
                </div>
              )}

              {/* Action buttons row */}
              <div className="flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </Button>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={onClose}>
                    Cerrar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReprogramar} className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" /> Reprogramar/Editar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={handlePublish}
                    disabled={publishing}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {publishing ? "Publicando..." : "Publicar"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] text-muted-foreground/50">Los cambios se guardan en la base de datos</p>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setMode("preview")}>Cancelar</Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !title.trim()}
                  className="gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  {updateMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
