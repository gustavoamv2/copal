import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarClock, CheckCircle2, FileText, AlertCircle,
  PenSquare, ArrowRight, Instagram, Facebook, Linkedin,
} from "lucide-react";
import { dashboardApi } from "@/api/dashboard";
import { postsApi } from "@/api/posts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

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

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => dashboardApi.metrics().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: postsData } = useQuery({
    queryKey: ["posts", { status: "scheduled", limit: 20 }],
    queryFn: () => postsApi.list({ status: "scheduled", limit: 20 }).then((r) => r.data),
    refetchInterval: 30_000,
    select: (d) => ({
      ...d,
      // Sort by scheduled_at ascending (soonest first), take top 5
      data: [...d.data]
        .filter((p) => p.scheduled_at)
        .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
        .slice(0, 5),
    }),
  });

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

      {/* ── Upcoming from posts table (includes imported) ───── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Próximas publicaciones</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/scheduled">Ver todas <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!postsData?.data.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay publicaciones programadas</p>
          ) : (
            <div className="space-y-2">
              {postsData.data.map((post) => {
                const t = post.title.toLowerCase();
                const network = t.includes("instagram") ? "Instagram"
                  : t.includes("facebook") ? "Facebook"
                  : t.includes("linkedin") ? "LinkedIn"
                  : post.variants[0]?.platform ?? "—";
                const NetworkIcon = network === "Instagram" ? Instagram
                  : network === "Facebook" ? Facebook
                  : Linkedin;
                const iconColor = network === "Instagram" ? "text-pink-500"
                  : network === "Facebook" ? "text-blue-600"
                  : "text-blue-800";

                return (
                  <div
                    key={post.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <NetworkIcon className={`h-4 w-4 shrink-0 ${iconColor}`} />
                      <span className="text-sm font-medium truncate">{post.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-4">
                      {post.scheduled_at ? formatDateTime(post.scheduled_at) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── User info footer ────────────────────────────────── */}
      {user && (
        <p className="text-xs text-muted-foreground/50 text-right">
          Conectado como {user.email} · {user.role}
        </p>
      )}
    </div>
  );
}
