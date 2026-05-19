import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  AlertCircle,
  PenSquare,
  ArrowRight,
} from "lucide-react";
import { dashboardApi } from "@/api/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/PlatformBadge";
import { formatDateTime } from "@/lib/utils";
import { Platform } from "@/types";

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
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

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => dashboardApi.metrics().then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Resumen de tus publicaciones</p>
        </div>
        <Button asChild>
          <Link to="/posts/new">
            <PenSquare className="h-4 w-4" />
            Nueva publicación
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-16 animate-pulse bg-muted rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={CalendarClock}
            label="Programadas"
            value={data?.scheduled ?? 0}
            color="bg-violet-500/10 text-violet-400"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Publicadas hoy"
            value={data?.publishedToday ?? 0}
            color="bg-green-500/10 text-green-400"
          />
          <MetricCard
            icon={FileText}
            label="Borradores"
            value={data?.drafts ?? 0}
            color="bg-blue-500/10 text-blue-400"
          />
          <MetricCard
            icon={AlertCircle}
            label="Fallidas"
            value={data?.failed ?? 0}
            color="bg-red-500/10 text-red-400"
          />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Próximas publicaciones</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/scheduled">
              Ver todas <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!data?.upcoming?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay publicaciones programadas
            </p>
          ) : (
            <div className="space-y-2">
              {data.upcoming.map((pub) => (
                <div
                  key={pub.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlatformBadge platform={pub.post_variant?.platform as Platform} />
                    <span className="text-sm font-medium truncate">{pub.post?.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-4">
                    {formatDateTime(pub.publish_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
