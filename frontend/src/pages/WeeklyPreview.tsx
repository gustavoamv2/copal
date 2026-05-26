import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { postsApi } from "@/api/posts";
import { PostDetailModal } from "@/components/PostDetailModal";
import { Button } from "@/components/ui/button";
import type { Post, Platform } from "@/types";

// ─── Brand colors ─────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "#E1306C",
  facebook:  "#1877F2",
  linkedin:  "#0A66C2",
  whatsapp:  "#25D366",
};

// ─── Platform icons ───────────────────────────────────────────────────────────

function InstagramIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className="shrink-0" style={{ color: "white" }}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function FacebookIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className="shrink-0" style={{ color: "white" }}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function LinkedInIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className="shrink-0" style={{ color: "white" }}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function WhatsAppIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className="shrink-0" style={{ color: "white" }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "instagram") return <InstagramIcon />;
  if (platform === "facebook")  return <FacebookIcon />;
  if (platform === "linkedin")  return <LinkedInIcon />;
  if (platform === "whatsapp")  return <WhatsAppIcon />;
  return null;
}

// ─── Parseo de metadatos del post ────────────────────────────────────────────

function parsePostMeta(post: Post): {
  platforms: string[];
  tipo: string;
  bg: string;
} {
  // Posts con variants: extraer plataformas únicas
  if (post.variants.length > 0) {
    const platforms = Array.from(new Set(post.variants.map((v) => v.platform)));
    const bg = PLATFORM_COLORS[platforms[0] as Platform] ?? "#6366f1";
    const t = post.title.toLowerCase();
    const tipo = t.includes("reel") ? "Reel"
      : t.includes("story") || t.includes("historia") ? "Story"
      : t.includes("carrusel") || t.includes("carousel") ? "Carrusel" : "Post";
    return { platforms, tipo, bg };
  }

  // Posts importados con prefijo "Tipo · Título"
  const dotIdx = post.title.indexOf(" · ");
  if (dotIdx !== -1) {
    const prefix = post.title.slice(0, dotIdx).toLowerCase();
    const platform =
      prefix.includes("instagram") ? "instagram" :
      prefix.includes("facebook")  ? "facebook"  :
      prefix.includes("linkedin")  ? "linkedin"  : null;
    if (platform) {
      const bg = PLATFORM_COLORS[platform as Platform];
      const tipo = prefix.includes("reel") ? "Reel"
        : prefix.includes("story") || prefix.includes("historia") ? "Story"
        : prefix.includes("carrusel") || prefix.includes("carousel") ? "Carrusel" : "Post";
      return { platforms: [platform], tipo, bg };
    }
  }

  // Fallback
  const tl = post.title.toLowerCase();
  const platform =
    tl.includes("instagram") ? "instagram" :
    tl.includes("facebook")  ? "facebook"  :
    tl.includes("linkedin")  ? "linkedin"  :
    tl.includes("whatsapp")  ? "whatsapp"  : "instagram";
  const bg = PLATFORM_COLORS[platform as Platform] ?? "#6366f1";
  const tipo = tl.includes("reel") ? "Reel"
    : tl.includes("story") || tl.includes("historia") ? "Story"
    : tl.includes("carrusel") || tl.includes("carousel") ? "Carrusel" : "Post";
  return { platforms: [platform], tipo, bg };
}

// ─── Semana utils ─────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// ─── Post preview card ────────────────────────────────────────────────────────

function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  const { platforms, tipo, bg } = parsePostMeta(post);
  const image = post.post_media[0]?.media_asset;
  const time = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
    : "";

  const isPublished = post.status === "published";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full text-left rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-150 bg-card group ${isPublished ? "opacity-50" : ""}`}
    >
      {/* Header: platform color bar */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5"
        style={{ backgroundColor: bg }}
      >
        <div className="flex items-center gap-0.5">
          {platforms.map((p) => (
            <PlatformIcon key={p} platform={p} />
          ))}
        </div>
        <span className="text-white text-xs font-semibold flex-1 truncate leading-none ml-0.5">
          {tipo}
        </span>
        {time && (
          <span className="text-white/90 text-xs shrink-0 font-mono">{time}</span>
        )}
      </div>

      {/* Image */}
      {image ? (
        <div className="w-full aspect-square overflow-hidden bg-muted">
          <img
            src={image.thumbnail_url ?? image.storage_url}
            alt={image.filename}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="w-full aspect-square bg-gradient-to-br from-muted/60 to-muted/20 flex flex-col items-center justify-center gap-1">
          <span className="text-2xl opacity-20">🖼</span>
          <span className="text-xs text-muted-foreground/40">Sin imagen</span>
        </div>
      )}

      {/* Caption */}
      <div className="p-2.5">
        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3 break-words">
          {post.base_caption || post.title}
        </p>
      </div>

      {/* Published overlay badge */}
      {isPublished && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-lg"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "#fff", backdropFilter: "blur(2px)" }}
          >
            Publicada
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WeeklyPreview({ embedded = false }: { embedded?: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [weekStart, setWeekStart] = useState(() => getMonday(today));
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [platformFilter, setPlatformFilter] = useState<Platform | "">("");

  const weekEnd = addDays(weekStart, 6);
  weekEnd.setHours(23, 59, 59, 999);

  const { data, isLoading } = useQuery({
    queryKey: ["posts", { limit: 500 }],
    queryFn: () => postsApi.list({ limit: 500 }).then((r) => r.data),
    staleTime: 60_000,
  });

  const allPosts = data?.data ?? [];

  const weekPosts = allPosts.filter((p) => {
    if (!p.scheduled_at) return false;
    const d = new Date(p.scheduled_at);
    if (d < weekStart || d > weekEnd) return false;
    if (!platformFilter) return true;
    const hasVariant = p.variants.some((v) => v.platform === platformFilter);
    const titleMatch = p.title.toLowerCase().includes(platformFilter);
    return hasVariant || titleMatch;
  });

  // Build 7 day columns
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999);
    const posts = weekPosts
      .filter((p) => {
        const d = new Date(p.scheduled_at!);
        return d >= dayStart && d <= dayEnd;
      })
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
    return { date: day, posts };
  });

  const isCurrentWeek = getMonday(today).getTime() === weekStart.getTime();

  const weekLabel = (() => {
    const s = weekStart;
    const e = weekEnd;
    const sMonth = MONTH_SHORT[s.getMonth()];
    const eMonth = MONTH_SHORT[e.getMonth()];
    if (s.getFullYear() !== e.getFullYear()) {
      return `${s.getDate()} ${sMonth} ${s.getFullYear()} – ${e.getDate()} ${eMonth} ${e.getFullYear()}`;
    }
    if (s.getMonth() !== e.getMonth()) {
      return `${s.getDate()} ${sMonth} – ${e.getDate()} ${eMonth} ${e.getFullYear()}`;
    }
    return `${s.getDate()} – ${e.getDate()} ${eMonth} ${e.getFullYear()}`;
  })();

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {!embedded && <h1 className="text-2xl font-bold">Catálogo semanal</h1>}
          {embedded
            ? <h2 className="text-lg font-semibold">Publicaciones programadas</h2>
            : null}
          <p className="text-muted-foreground text-sm mt-0.5">
            {weekPosts.length > 0
              ? `${weekPosts.length} publicacion${weekPosts.length !== 1 ? "es" : ""} esta semana`
              : "Sin publicaciones esta semana"}
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2 shrink-0">
          {!isCurrentWeek && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(getMonday(today))}
              className="gap-1.5"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Esta semana
            </Button>
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-3 min-w-[180px] text-center tabular-nums">
              {weekLabel}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Platform filter ─────────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          { label: "Todas", value: "" as const },
          { label: "Instagram", value: "instagram" as const },
          { label: "Facebook", value: "facebook" as const },
          { label: "LinkedIn", value: "linkedin" as const },
          { label: "WhatsApp", value: "whatsapp" as const },
        ]).map((f) => (
          <Button
            key={f.value}
            variant={platformFilter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setPlatformFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* ── 7-day grid ─────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-16 rounded-lg animate-pulse bg-muted/50" />
              <div className="h-48 rounded-xl animate-pulse bg-muted/30" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 min-w-0">
          {days.map(({ date, posts }, i) => {
            const isToday = date.toDateString() === today.toDateString();
            const isPast  = date < today;

            return (
              <div key={i} className="flex flex-col min-w-0">
                {/* Day header */}
                <div
                  className={`
                    rounded-xl text-center py-2.5 px-1 mb-2 border transition-colors
                    ${isToday
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : isPast
                        ? "bg-muted/20 border-border/40 text-muted-foreground"
                        : "bg-accent/30 border-border/60 text-foreground"}
                  `}
                >
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {DAY_NAMES[i]}
                  </p>
                  <p className="text-xl font-bold leading-tight mt-0.5">{date.getDate()}</p>
                  <p className={`text-[10px] capitalize ${isToday ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>
                    {MONTH_SHORT[date.getMonth()]}
                  </p>
                  {posts.length > 0 && (
                    <div className={`mt-1.5 mx-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isToday ? "bg-white/20 text-white" : "bg-primary/15 text-primary"}`}>
                      {posts.length}
                    </div>
                  )}
                </div>

                {/* Post cards */}
                <div className="flex flex-col gap-2">
                  {posts.length === 0 ? (
                    <div className={`rounded-lg border border-dashed h-10 ${isPast ? "border-border/20" : "border-border/40"}`} />
                  ) : (
                    posts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onClick={() => setSelectedPost(post)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
        {(["instagram", "facebook", "linkedin", "whatsapp"] as Platform[]).map((p) => (
          <div key={p} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: PLATFORM_COLORS[p] }}
            />
            <span className="capitalize">{p}</span>
          </div>
        ))}
        <span className="ml-auto">Haz clic en cualquier publicación para ver el detalle</span>
      </div>

      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
