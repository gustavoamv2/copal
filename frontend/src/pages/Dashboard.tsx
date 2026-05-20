import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarClock, CheckCircle2, FileText, AlertCircle,
  PenSquare, Instagram, Facebook, Linkedin,
} from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { EventClickArg } from "@fullcalendar/core";
import { dashboardApi } from "@/api/dashboard";
import { postsApi } from "@/api/posts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PostDetailModal } from "@/components/PostDetailModal";
import { useAuth } from "@/hooks/useAuth";
import type { Post, Platform } from "@/types";

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "#E1306C",
  facebook:  "#1877F2",
  linkedin:  "#0A66C2",
};

function eventLabel(post: Post): string {
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
  const t = post.title;
  const network = t.includes("LinkedIn") ? "LinkedIn"
    : t.includes("Facebook") ? "Facebook"
    : t.includes("Instagram") ? "Instagram"
    : "—";
  const type = t.includes("Story") || t.includes("Reel") ? "Story/Reel"
    : t.toLowerCase().includes("carrusel") || t.toLowerCase().includes("carousel") ? "Carrusel"
    : "Post";
  return `${network} · ${type}`;
}

function MetricCard({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Hexagon logo matching the brand
function BrandLogo({ size = 64 }: { size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <img
        src="/logo.png"
        alt="Actualizate con IA"
        style={{ width: size, height: size }}
        className="rounded-xl object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
          const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement;
          if (fb) fb.style.display = "flex";
        }}
      />
      {/* Fallback */}
      <div
        style={{
          width: size, height: size,
          display: "none",
          clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
          background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 40%, #c9a84c 100%)",
          position: "absolute", top: 0, left: 0,
        }}
        className="items-center justify-center text-white font-extrabold"
      >
        <span style={{ fontSize: size * 0.45 }}>A</span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => dashboardApi.metrics().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: calendarData } = useQuery({
    queryKey: ["posts", { limit: 200 }],
    queryFn: () => postsApi.list({ limit: 200 }).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const posts = calendarData?.data ?? [];

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
      return [{ id: post.id, title: label, start: post.scheduled_at!, backgroundColor: bg, borderColor: "transparent", extendedProps: { postId: post.id } }];
    });

  const handleEventClick = (info: EventClickArg) => {
    const postId = info.event.extendedProps.postId as string;
    setSelectedPost(posts.find((p) => p.id === postId) ?? null);
  };

  return (
    <div className="space-y-8">

      {/* ── Company header ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BrandLogo size={56} />
          <div>
            <h1 className="text-2xl font-bold">Actualizate con IA</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-muted-foreground">@actualizateconia</span>
              <span className="text-muted-foreground/30">·</span>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Instagram className="h-3.5 w-3.5" />
                <Facebook className="h-3.5 w-3.5" />
                <Linkedin className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
        <Button asChild>
          <Link to="/posts/new">
            <PenSquare className="h-4 w-4" />
            Nueva publicación
          </Link>
        </Button>
      </div>

      {/* ── Metrics ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-16 animate-pulse bg-muted rounded-md" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={CalendarClock} label="Programadas"    value={data?.scheduled ?? 0}     color="bg-violet-500/10 text-violet-400" />
          <MetricCard icon={CheckCircle2}  label="Publicadas hoy" value={data?.publishedToday ?? 0} color="bg-green-500/10 text-green-400" />
          <MetricCard icon={FileText}      label="Borradores"     value={data?.drafts ?? 0}         color="bg-blue-500/10 text-blue-400" />
          <MetricCard icon={AlertCircle}   label="Fallidas"       value={data?.failed ?? 0}         color="bg-red-500/10 text-red-400" />
        </div>
      )}

      {/* ── Calendar ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Calendario de publicaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="[&_.fc]:text-foreground [&_.fc-toolbar-title]:font-semibold [&_.fc-toolbar-title]:text-base [&_.fc-button]:bg-accent [&_.fc-button]:border-border [&_.fc-button]:text-foreground [&_.fc-button:hover]:bg-accent/80 [&_.fc-button-primary]:!bg-primary [&_.fc-button-primary]:!border-primary [&_.fc-day-today]:!bg-primary/5 [&_.fc-daygrid-day]:!border-border [&_.fc-scrollgrid]:!border-border [&_.fc-col-header-cell]:border-border [&_.fc-scrollgrid-section>td]:border-border [&_.fc-event]:cursor-pointer">
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
        </CardContent>
      </Card>

      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}

      {/* ── User info footer ────────────────────────────────── */}
      {user && (
        <p className="text-xs text-muted-foreground/50 text-right">
          Conectado como {user.email} · {user.role}
        </p>
      )}
    </div>
  );
}
