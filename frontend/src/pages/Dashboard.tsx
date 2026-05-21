import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarClock, CheckCircle2, FileText, AlertCircle, TrendingUp,
  PenSquare, Instagram, Facebook, Linkedin,
} from "lucide-react";
import { dashboardApi } from "@/api/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WeeklyPreview } from "@/pages/WeeklyPreview";
import { useAuth } from "@/hooks/useAuth";

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon, label, value, color, to,
}: { icon: React.ElementType; label: string; value: number; color: string; to: string }) {
  return (
    <Link to={to} className="block group">
      <Card className="cursor-pointer transition-colors group-hover:border-primary/50 group-hover:bg-accent/30">
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
    </Link>
  );
}

// ─── Brand logo ───────────────────────────────────────────────────────────────

function BrandLogo({ size = 56 }: { size?: number }) {
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => dashboardApi.metrics().then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-8">

      {/* ── Brand header ────────────────────────────────────── */}
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-16 animate-pulse bg-muted rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard icon={CalendarClock} label="Programadas"    value={data?.scheduled ?? 0}      color="bg-violet-500/10 text-violet-400"   to="/scheduled?tab=posts&status=scheduled" />
          <MetricCard icon={CheckCircle2}  label="Publicadas hoy" value={data?.publishedToday ?? 0}  color="bg-green-500/10 text-green-400"     to="/scheduled?tab=jobs&status=published&today=1" />
          <MetricCard icon={TrendingUp}    label="Publicadas"     value={data?.published ?? 0}       color="bg-emerald-500/10 text-emerald-400" to="/scheduled?tab=jobs&status=published" />
          <MetricCard icon={FileText}      label="Borradores"     value={data?.drafts ?? 0}          color="bg-blue-500/10 text-blue-400"       to="/scheduled?tab=posts&status=draft" />
          <MetricCard icon={AlertCircle}   label="Fallidas"       value={data?.failed ?? 0}          color="bg-red-500/10 text-red-400"         to="/scheduled?tab=jobs&status=failed" />
        </div>
      )}

      {/* ── Weekly catalog ──────────────────────────────────── */}
      <WeeklyPreview embedded />

      {/* ── User footer ─────────────────────────────────────── */}
      {user && (
        <p className="text-xs text-muted-foreground/50 text-right">
          Conectado como {user.email} · {user.role}
        </p>
      )}
    </div>
  );
}
