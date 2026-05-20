import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Link2Off, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { accountsApi } from "@/api/accounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlatformBadge } from "@/components/PlatformBadge";
import { toast } from "@/hooks/useToast";
import { formatDate } from "@/lib/utils";
import { Platform } from "@/types";
import { getAccessToken } from "@/api/client";

const PLATFORMS: { key: Platform; name: string; description: string }[] = [
  { key: "facebook", name: "Facebook Pages", description: "Publica en páginas de Facebook" },
  { key: "instagram", name: "Instagram", description: "Publica via Instagram Graph API" },
  { key: "linkedin", name: "LinkedIn", description: "Publica en tu perfil de LinkedIn" },
];

export function Accounts() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      toast({ title: `Cuenta de ${connected} conectada correctamente` });
    }
  }, [searchParams]);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list().then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Cuenta desconectada" });
    },
    onError: () => toast({ title: "Error al desconectar", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => accountsApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const accountsByPlatform = (platform: Platform) =>
    (accounts ?? []).filter((a) => a.platform === platform);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cuentas conectadas</h1>
        <p className="text-muted-foreground text-sm mt-1">Administra tus conexiones a redes sociales</p>
      </div>

      <div className="grid gap-4">
        {PLATFORMS.map(({ key, name, description }) => {
          const connected = accountsByPlatform(key);
          return (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                  <PlatformBadge platform={key} />
                  <div>
                    <CardTitle className="text-base">{name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const endpoint = key === "linkedin" ? "linkedin" : "meta";
                    const token = getAccessToken();
                    window.location.href = `${import.meta.env.VITE_API_URL}/api/oauth/${endpoint}/connect?token=${token}`;
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {connected.length ? "Reconectar" : "Conectar"}
                </Button>
              </CardHeader>
              {connected.length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {connected.map((acc) => {
                      const expired =
                        acc.token_expires_at && new Date(acc.token_expires_at) < new Date();
                      return (
                        <div
                          key={acc.id}
                          className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {acc.is_active && !expired ? (
                              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate">{acc.account_name}</span>
                            {expired && (
                              <span className="text-xs text-yellow-400">Token expirado</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {acc.token_expires_at && (
                              <span className="text-xs text-muted-foreground hidden sm:block">
                                Expira {formatDate(acc.token_expires_at)}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMutation.mutate(acc.id)}
                              className="text-xs"
                            >
                              {acc.is_active ? "Pausar" : "Activar"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteMutation.mutate(acc.id)}
                            >
                              <Link2Off className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
              {!isLoading && connected.length === 0 && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">Sin cuentas conectadas</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
