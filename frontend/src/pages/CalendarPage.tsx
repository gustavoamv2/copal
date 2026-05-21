import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { EventClickArg, EventContentArg } from "@fullcalendar/core";
import { postsApi } from "@/api/posts";
import { PostDetailModal } from "@/components/PostDetailModal";
import type { Post, Platform } from "@/types";

// ─── Brand colors ─────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "#E1306C",
  facebook:  "#1877F2",
  linkedin:  "#0A66C2",
};

// ─── SVG brand icons ──────────────────────────────────────────────────────────

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" className="shrink-0" style={{ color: "white" }}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" className="shrink-0" style={{ color: "white" }}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" className="shrink-0" style={{ color: "white" }}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function NetworkIcon({ network }: { network: string }) {
  if (network === "Instagram") return <InstagramIcon />;
  if (network === "Facebook")  return <FacebookIcon />;
  if (network === "LinkedIn")  return <LinkedInIcon />;
  return null;
}

// ─── Parseo de red + tipo desde el título ─────────────────────────────────────

function parseEventMeta(post: Post): { network: string; tipo: string; bg: string } {
  const t = post.title;

  // Formato importado: "LinkedIn Post · Título descriptivo"
  const dotIdx = t.indexOf(" · ");
  if (dotIdx !== -1) {
    const prefix = t.slice(0, dotIdx);
    const network =
      prefix.includes("LinkedIn")  ? "LinkedIn"  :
      prefix.includes("Facebook")  ? "Facebook"  :
      prefix.includes("Instagram") ? "Instagram" : null;
    if (network) {
      const tipo =
        prefix.toLowerCase().includes("reel")     ? "Reel"     :
        prefix.toLowerCase().includes("story")    ? "Story"    :
        prefix.toLowerCase().includes("historia") ? "Historia" :
        prefix.toLowerCase().includes("carrusel") ? "Carrusel" :
        prefix.toLowerCase().includes("carousel") ? "Carrusel" : "Post";
      const bg =
        network === "Instagram" ? "#E1306C" :
        network === "Facebook"  ? "#1877F2" : "#0A66C2";
      return { network, tipo, bg };
    }
  }

  // Posts con variants (flujo manual)
  if (post.variants.length > 0) {
    const v = post.variants[0];
    const network =
      v.platform === "instagram" ? "Instagram" :
      v.platform === "facebook"  ? "Facebook"  : "LinkedIn";
    const bg = PLATFORM_COLORS[v.platform as Platform] ?? "#6366f1";
    const tipo =
      t.toLowerCase().includes("reel")     ? "Reel"     :
      t.includes("Story")                  ? "Story"    :
      t.toLowerCase().includes("carrusel") ? "Carrusel" : "Post";
    return { network, tipo, bg };
  }

  // Fallback
  const tl = t.toLowerCase();
  const network =
    tl.includes("linkedin")  ? "LinkedIn"  :
    tl.includes("facebook")  ? "Facebook"  :
    tl.includes("instagram") ? "Instagram" : "—";
  const bg =
    tl.includes("instagram") ? "#E1306C" :
    tl.includes("facebook")  ? "#1877F2" :
    tl.includes("linkedin")  ? "#0A66C2" : "#6366f1";
  const tipo =
    tl.includes("reel")     ? "Reel"     :
    tl.includes("story")    ? "Story"    :
    tl.includes("carrusel") ? "Carrusel" : "Post";
  return { network, tipo, bg };
}

// ─── Custom event chip ────────────────────────────────────────────────────────

function EventChip({ arg }: { arg: EventContentArg }) {
  const { network, tipo } = arg.event.extendedProps as {
    network: string; tipo: string; postId: string;
  };

  return (
    <div
      className="flex items-center gap-1 w-full overflow-hidden"
      style={{
        padding: "2px 5px",
        color: "white",
        lineHeight: 1,
      }}
    >
      <NetworkIcon network={network} />
      <span
        className="truncate"
        style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.01em" }}
      >
        {tipo}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const { data } = useQuery({
    queryKey: ["posts", { limit: 500 }],
    queryFn: () => postsApi.list({ limit: 500 }).then((r) => r.data),
  });

  const posts = data?.data ?? [];

  const events = posts
    .filter((p) => p.scheduled_at)
    .flatMap((post) => {
      const { network, tipo, bg } = parseEventMeta(post);

      // Posts con variants → un chip por plataforma distinta
      if (post.variants.length > 0) {
        const seen = new Set<string>();
        return post.variants
          .filter((v) => { const dup = seen.has(v.platform); seen.add(v.platform); return !dup; })
          .map((v) => {
            const vNetwork =
              v.platform === "instagram" ? "Instagram" :
              v.platform === "facebook"  ? "Facebook"  : "LinkedIn";
            return {
              id: `${post.id}_${v.platform}`,
              title: `${vNetwork} · ${tipo}`,
              start: post.scheduled_at!,
              backgroundColor: PLATFORM_COLORS[v.platform as Platform] ?? "#6366f1",
              borderColor: "transparent",
              extendedProps: { postId: post.id, network: vNetwork, tipo },
            };
          });
      }

      return [{
        id: post.id,
        title: `${network} · ${tipo}`,
        start: post.scheduled_at!,
        backgroundColor: bg,
        borderColor: "transparent",
        extendedProps: { postId: post.id, network, tipo },
      }];
    });

  const handleEventClick = (info: EventClickArg) => {
    const postId = info.event.extendedProps.postId as string;
    setSelectedPost(posts.find((p) => p.id === postId) ?? null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendario</h1>
        <p className="text-muted-foreground text-sm mt-1">Vista mensual de publicaciones programadas</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4
        [&_.fc]:text-foreground
        [&_.fc-toolbar-title]:font-semibold [&_.fc-toolbar-title]:text-lg
        [&_.fc-button]:bg-accent [&_.fc-button]:border-border [&_.fc-button]:text-foreground
        [&_.fc-button:hover]:bg-accent/80
        [&_.fc-button-primary]:!bg-primary [&_.fc-button-primary]:!border-primary
        [&_.fc-day-today]:!bg-primary/5
        [&_.fc-daygrid-day]:!border-border
        [&_.fc-scrollgrid]:!border-border
        [&_.fc-col-header-cell]:border-border
        [&_.fc-scrollgrid-section>td]:border-border
        [&_.fc-event]:cursor-pointer
        [&_.fc-event]:!rounded
        [&_.fc-event]:!border-0
        [&_.fc-event]:!shadow-sm
        [&_.fc-event-main]:!p-0
        [&_.fc-daygrid-event]:!min-h-[20px]"
      >
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          events={events}
          locale="es"
          height="auto"
          headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
          buttonText={{ today: "Hoy" }}
          eventDisplay="block"
          eventClick={handleEventClick}
          eventContent={(arg) => <EventChip arg={arg} />}
        />
      </div>

      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
