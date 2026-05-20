import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Pencil,
  Check,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  ThumbsUp,
  Share2,
  MoreHorizontal,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { postsApi } from "@/api/posts";
import { toast } from "@/hooks/useToast";
import type { Post, Platform } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ViewMode = "preview" | "edit";
type NetworkTab = Platform | "generic";

// ---------------------------------------------------------------------------
// Avatar placeholder
// ---------------------------------------------------------------------------
function AvatarPlaceholder({ size = 9 }: { size?: number }) {
  return (
    <div
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
      className="rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0"
    >
      M
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instagram preview
// ---------------------------------------------------------------------------
function InstagramCard({
  caption,
  imageUrl,
  instagramType,
  dateLabel,
}: {
  caption: string;
  imageUrl?: string;
  instagramType?: string;
  dateLabel: string;
}) {
  const isStory = instagramType === "story";
  const isCarousel = instagramType === "carousel";
  const [expanded, setExpanded] = useState(false);
  const short = caption.length > 280 && !expanded ? caption.slice(0, 280) + "…" : caption;

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-[#111] text-white text-sm shadow-md">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px] shrink-0">
          <div className="h-full w-full rounded-full bg-[#111] flex items-center justify-center text-xs font-bold">M</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">tu_marca</p>
          {isStory && <p className="text-[10px] text-gray-400">Historia</p>}
          {isCarousel && <p className="text-[10px] text-gray-400">Carrusel</p>}
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>

      {imageUrl ? (
        <div className={`w-full bg-black ${isStory ? "aspect-[9/16]" : "aspect-square"} overflow-hidden relative`}>
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          {isCarousel && (
            <div className="absolute top-2 right-2 bg-black/60 rounded-full px-2 py-0.5 text-[10px]">1 / 3</div>
          )}
        </div>
      ) : (
        <div className={`w-full bg-[#222] ${isStory ? "aspect-[9/16]" : "aspect-square"} flex items-center justify-center text-gray-600 text-xs`}>
          Sin imagen
        </div>
      )}

      <div className="flex items-center gap-3 px-3 py-2">
        <Heart className="h-5 w-5" /><MessageCircle className="h-5 w-5" /><Send className="h-5 w-5" />
        <Bookmark className="h-5 w-5 ml-auto" />
      </div>

      <div className="px-3 pb-3 space-y-1">
        <p className="text-xs font-semibold">tu_marca{" "}
          <span className="font-normal text-gray-300 whitespace-pre-wrap break-words">{short}</span>
          {caption.length > 280 && !expanded && (
            <button className="text-gray-500 ml-1" onClick={() => setExpanded(true)}>más</button>
          )}
        </p>
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{dateLabel}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Facebook preview
// ---------------------------------------------------------------------------
function FacebookCard({ caption, imageUrl, dateLabel }: { caption: string; imageUrl?: string; dateLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const short = caption.length > 280 && !expanded ? caption.slice(0, 280) + "…" : caption;

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-[#18191a] text-white text-sm shadow-md">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <AvatarPlaceholder size={9} />
        <div className="flex-1">
          <p className="text-xs font-semibold">Tu Marca</p>
          <p className="text-[10px] text-gray-400">{dateLabel} · 🌐</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>
      <div className="px-3 pb-2">
        <p className="text-xs text-gray-200 whitespace-pre-wrap break-words leading-relaxed">{short}
          {caption.length > 280 && !expanded && (
            <button className="text-blue-400 ml-1" onClick={() => setExpanded(true)}>Ver más</button>
          )}
        </p>
      </div>
      {imageUrl ? (
        <div className="w-full aspect-video bg-black overflow-hidden">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-video bg-[#3a3b3c] flex items-center justify-center text-gray-500 text-xs">Sin imagen</div>
      )}
      <div className="flex items-center justify-between px-3 py-2 text-gray-400 text-[11px] border-t border-[#3a3b3c]">
        <span>👍 ❤️ <span className="text-gray-500">Me gusta</span></span>
        <span className="flex gap-3"><span>Comentar</span><span>Compartir</span></span>
      </div>
      <div className="flex items-center px-3 pb-2 gap-1 border-t border-[#3a3b3c]">
        {[{ icon: <ThumbsUp className="h-4 w-4" />, label: "Me gusta" }, { icon: <MessageCircle className="h-4 w-4" />, label: "Comentar" }, { icon: <Share2 className="h-4 w-4" />, label: "Compartir" }].map(({ icon, label }) => (
          <button key={label} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-gray-400 hover:bg-[#3a3b3c] rounded-md">
            {icon} {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkedIn preview
// ---------------------------------------------------------------------------
function LinkedInCard({ caption, imageUrl, dateLabel }: { caption: string; imageUrl?: string; dateLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const short = caption.length > 280 && !expanded ? caption.slice(0, 280) + "…" : caption;

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-[#1b1f23] text-white text-sm shadow-md">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
        <AvatarPlaceholder size={10} />
        <div className="flex-1">
          <p className="text-xs font-semibold">Tu Marca</p>
          <p className="text-[10px] text-gray-400">Empresa · {dateLabel} · 🌐</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-200 whitespace-pre-wrap break-words leading-relaxed">{short}
          {caption.length > 280 && !expanded && (
            <button className="text-[#70b5f9] ml-1" onClick={() => setExpanded(true)}>...más</button>
          )}
        </p>
      </div>
      {imageUrl ? (
        <div className="w-full aspect-video bg-black overflow-hidden">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-video bg-[#2c3036] flex items-center justify-center text-gray-500 text-xs">Sin imagen</div>
      )}
      <div className="px-4 py-2 flex items-center justify-between text-[10px] text-gray-500 border-t border-[#2c3036]">
        <span>👍 💡 ❤️</span><span>0 comentarios</span>
      </div>
      <div className="flex items-center px-2 pb-3 gap-0.5 border-t border-[#2c3036]">
        {[{ icon: <ThumbsUp className="h-4 w-4" />, label: "Recomendar" }, { icon: <MessageCircle className="h-4 w-4" />, label: "Comentar" }, { icon: <Share2 className="h-4 w-4" />, label: "Compartir" }, { icon: <Send className="h-4 w-4" />, label: "Enviar" }].map(({ icon, label }) => (
          <button key={label} className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] text-gray-400 hover:bg-[#2c3036] rounded-md">
            {icon} {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic preview (no platform info)
// ---------------------------------------------------------------------------
function GenericCard({ caption, imageUrl, dateLabel }: { caption: string; imageUrl?: string; dateLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const short = caption.length > 280 && !expanded ? caption.slice(0, 280) + "…" : caption;

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card text-foreground text-sm shadow-md">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <AvatarPlaceholder size={9} />
        <div className="flex-1">
          <p className="text-xs font-semibold">Tu Marca</p>
          <p className="text-[10px] text-muted-foreground">{dateLabel}</p>
        </div>
      </div>
      {imageUrl ? (
        <div className="w-full aspect-video overflow-hidden">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground text-xs">Sin imagen</div>
      )}
      <div className="px-3 py-3">
        <p className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed">{short}
          {caption.length > 280 && !expanded && (
            <button className="text-primary ml-1" onClick={() => setExpanded(true)}>Ver más</button>
          )}
        </p>
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
  const [mode, setMode] = useState<ViewMode>("preview");

  // Determine available network tabs
  const platforms = post.variants.map((v) => v.platform as Platform);
  const uniquePlatforms = Array.from(new Set(platforms));
  const tabs: NetworkTab[] = uniquePlatforms.length > 0 ? uniquePlatforms : ["generic"];
  const [activeTab, setActiveTab] = useState<NetworkTab>(tabs[0]);

  // Image from first media asset
  const imageUrl = post.post_media?.[0]?.media_asset?.storage_url;

  const dateLabel = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString("es-CL", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "Sin fecha";

  // Edit state
  const [title, setTitle] = useState(post.title);
  const [caption, setCaption] = useState(post.base_caption);
  const [scheduledAt, setScheduledAt] = useState(
    post.scheduled_at ? post.scheduled_at.slice(0, 16) : ""
  );

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

  // Current caption for preview (use edited if in edit mode)
  const previewCaption = mode === "edit" ? caption : post.base_caption;

  const TAB_LABELS: Record<NetworkTab, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    generic: "Vista previa",
  };

  const NETWORK_TAB_COLORS: Record<NetworkTab, string> = {
    instagram: "bg-pink-600 text-white border-transparent",
    facebook: "bg-blue-700 text-white border-transparent",
    linkedin: "bg-blue-900 text-white border-transparent",
    generic: "bg-primary text-primary-foreground border-transparent",
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
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

        {/* Network tabs */}
        {tabs.length > 1 && mode === "preview" && (
          <div className="flex gap-1 px-4 pt-3 shrink-0">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeTab === t
                    ? NETWORK_TAB_COLORS[t]
                    : "border-border text-muted-foreground hover:border-border/60"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mode === "preview" ? (
            <>
              {activeTab === "instagram" && (
                <InstagramCard
                  caption={previewCaption}
                  imageUrl={imageUrl}
                  dateLabel={dateLabel}
                />
              )}
              {activeTab === "facebook" && (
                <FacebookCard caption={previewCaption} imageUrl={imageUrl} dateLabel={dateLabel} />
              )}
              {activeTab === "linkedin" && (
                <LinkedInCard caption={previewCaption} imageUrl={imageUrl} dateLabel={dateLabel} />
              )}
              {activeTab === "generic" && (
                <GenericCard caption={previewCaption} imageUrl={imageUrl} dateLabel={dateLabel} />
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Título interno</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Caption</Label>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={8}
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

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <p className="text-[10px] text-muted-foreground/50">
            {mode === "preview" ? "Vista previa ilustrativa" : "Los cambios se guardan en la base de datos"}
          </p>
          {mode === "preview" ? (
            <Button size="sm" variant="outline" onClick={() => setMode("edit")} className="gap-1.5 shrink-0">
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setMode("preview")}>
                Cancelar
              </Button>
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
          )}
        </div>
      </div>
    </div>
  );
}
