import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { EventClickArg } from "@fullcalendar/core";
import { postsApi } from "@/api/posts";
import { PostDetailModal } from "@/components/PostDetailModal";
import type { Post, Platform } from "@/types";

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "#E1306C",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
};

// Extract "Red Social · Tipo" from a post for the calendar chip
function eventLabel(post: Post): string {
  // Posts with variants (manual flow)
  if (post.variants.length > 0) {
    const networks = Array.from(
      new Set(post.variants.map((v) => {
        switch (v.platform) {
          case "instagram": return "Instagram";
          case "facebook":  return "Facebook";
          case "linkedin":  return "LinkedIn";
        }
      }))
    );
    return networks.join(" / ");
  }

  // Imported posts: title is "YYYY-MM-DD - Network - Description"
  // Extract network and type from the title
  const t = post.title;

  const network = t.includes("LinkedIn")  ? "LinkedIn"
    : t.includes("Facebook")  ? "Facebook"
    : t.includes("Instagram") ? "Instagram"
    : "—";

  const type = t.includes("Story") || t.includes("Reel") ? "Story/Reel"
    : t.toLowerCase().includes("carrusel") || t.toLowerCase().includes("carousel") ? "Carrusel"
    : "Post";

  return `${network} · ${type}`;
}

export function CalendarPage() {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const { data } = useQuery({
    queryKey: ["posts", { limit: 100 }],
    queryFn: () => postsApi.list({ limit: 100 }).then((r) => r.data),
  });

  const posts = data?.data ?? [];

  const events = posts
    .filter((p) => p.scheduled_at)
    .flatMap((post) => {
      const label = eventLabel(post);

      if (post.variants.length > 0) {
        const seen = new Set<string>();
        return post.variants
          .filter((v) => { const dup = seen.has(v.platform); seen.add(v.platform); return !dup; })
          .map((v) => ({
            id: `${post.id}_${v.platform}`,
            title: label,
            start: post.scheduled_at!,
            backgroundColor: PLATFORM_COLORS[v.platform as Platform] ?? "#6366f1",
            borderColor: "transparent",
            extendedProps: { postId: post.id },
          }));
      }

      const t = post.title.toLowerCase();
      const bg = t.includes("instagram") ? "#E1306C"
        : t.includes("facebook") ? "#1877F2"
        : t.includes("linkedin") ? "#0A66C2"
        : "#6366f1";

      return [{
        id: post.id,
        title: label,
        start: post.scheduled_at!,
        backgroundColor: bg,
        borderColor: "transparent",
        extendedProps: { postId: post.id },
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

      <div className="rounded-lg border border-border bg-card p-4 [&_.fc]:text-foreground [&_.fc-toolbar-title]:font-semibold [&_.fc-toolbar-title]:text-lg [&_.fc-button]:bg-accent [&_.fc-button]:border-border [&_.fc-button]:text-foreground [&_.fc-button:hover]:bg-accent/80 [&_.fc-button-primary]:!bg-primary [&_.fc-button-primary]:!border-primary [&_.fc-day-today]:!bg-primary/5 [&_.fc-daygrid-day]:!border-border [&_.fc-scrollgrid]:!border-border [&_.fc-col-header-cell]:border-border [&_.fc-scrollgrid-section>td]:border-border [&_.fc-event]:cursor-pointer">
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
        />
      </div>

      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
