import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { publicationsApi } from "@/api/publications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformBadge } from "@/components/PlatformBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "@/hooks/useToast";
import { formatDateTime } from "@/lib/utils";
import { Platform, PublicationStatus } from "@/types";

const FILTERS: { label: string; value: string }[] = [
  { label: "Todas", value: "" },
  { label: "Pendientes", value: "pending" },
  { label: "Publicadas", value: "published" },
  { label: "Fallidas", value: "failed" },
];

export function Scheduled() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["publications", { status }],
    queryFn: () =>
      publicationsApi.list({ status: status || undefined, limit: 50 }).then((r) => r.data),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Publicaciones programadas</h1>
        <p className="text-muted-foreground text-sm mt-1">Estado en tiempo real de tu cola</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
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
          <CardTitle className="text-base">
            {data?.total ?? 0} publicaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-px">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-muted/50 mx-4 mb-2 rounded-md" />
              ))}
            </div>
          ) : !data?.data.length ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              No hay publicaciones con este filtro
            </p>
          ) : (
            <div className="divide-y divide-border">
              {data.data.map((pub) => (
                <div key={pub.id} className="flex items-center gap-4 px-6 py-3 hover:bg-accent/30 transition-colors">
                  <PlatformBadge platform={pub.post_variant?.platform as Platform} />
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
                  <span className="text-xs text-muted-foreground shrink-0">
                    {pub.attempt_count > 0 && `${pub.attempt_count} intento(s)`}
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
