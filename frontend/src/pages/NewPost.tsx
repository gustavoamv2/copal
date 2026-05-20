import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Image as ImageIcon, Instagram, Facebook, Linkedin } from "lucide-react";
import { postsApi } from "@/api/posts";
import { mediaApi } from "@/api/media";
import { accountsApi } from "@/api/accounts";
import { useSocialPublish } from "@/hooks/useSocialPublish";
import type { SocialPlatform } from "@/api/social";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformBadge } from "@/components/PlatformBadge";
import { toast } from "@/hooks/useToast";
import { SocialAccount, Platform, MediaAsset } from "@/types";

const PLATFORM_ICONS: Record<Platform, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
};

interface VariantState {
  social_account_id: string;
  platform: Platform;
  caption: string;
}

export function NewPost() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [baseCaption, setBaseCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [ayrPlatforms, setAyrPlatforms] = useState<SocialPlatform[]>(["linkedin"]);
  const { publish, loading: publishing } = useSocialPublish();

  const toggleAyrPlatform = (p: SocialPlatform) =>
    setAyrPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list().then((r) => r.data),
  });

  const { data: media } = useQuery({
    queryKey: ["media", { limit: 30 }],
    queryFn: () => mediaApi.list({ limit: 30 }).then((r) => r.data),
    enabled: showMediaPicker,
  });

  const createMutation = useMutation({
    mutationFn: (status: "draft" | "scheduled") => {
      const activeAccounts = (accounts ?? []).filter((a) =>
        selectedAccounts.includes(a.id)
      );
      const variantPayload: VariantState[] = activeAccounts.map((a) => ({
        social_account_id: a.id,
        platform: a.platform,
        caption: variants[a.id] ?? baseCaption,
      }));
      return postsApi.create({
        title,
        base_caption: baseCaption,
        status,
        scheduled_at: status === "scheduled" ? scheduledAt || null : null,
        variants: variantPayload,
        media_ids: selectedMedia.map((m) => m.id),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast({ title: "Publicación guardada" });
      navigate("/scheduled");
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  const toggleAccount = (acc: SocialAccount) => {
    setSelectedAccounts((prev) =>
      prev.includes(acc.id) ? prev.filter((id) => id !== acc.id) : [...prev, acc.id]
    );
    if (!variants[acc.id]) {
      setVariants((prev) => ({ ...prev, [acc.id]: baseCaption }));
    }
  };

  const activeAccounts = (accounts ?? []).filter((a) => selectedAccounts.includes(a.id));

  const handlePublishNow = async () => {
    if (!baseCaption || ayrPlatforms.length === 0) return;
    const mediaUrls = selectedMedia.map((m) => m.storage_url).filter(Boolean);
    const res = await publish({ content: baseCaption, platforms: ayrPlatforms, mediaUrls });
    if (res.success) {
      toast({ title: "Publicado en redes sociales ✓" });
    } else {
      toast({ title: res.error ?? "Error al publicar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nueva publicación</h1>
        <p className="text-muted-foreground text-sm mt-1">Crea y programa contenido para tus redes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contenido base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Título interno</Label>
                <Input
                  placeholder="Ej: Lanzamiento producto Marzo"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Caption base</Label>
                <Textarea
                  placeholder="Escribe tu caption aquí..."
                  rows={5}
                  value={baseCaption}
                  onChange={(e) => {
                    setBaseCaption(e.target.value);
                    // sync to variants that haven't been customized
                    setVariants((prev) => {
                      const next = { ...prev };
                      selectedAccounts.forEach((id) => {
                        if (!prev[id] || prev[id] === baseCaption) {
                          next[id] = e.target.value;
                        }
                      });
                      return next;
                    });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha y hora de publicación</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Medios</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowMediaPicker(!showMediaPicker)}>
                <ImageIcon className="h-4 w-4" />
                Seleccionar
              </Button>
            </CardHeader>
            <CardContent>
              {selectedMedia.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin medios adjuntos</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedMedia.map((m) => (
                    <div key={m.id} className="relative group h-20 w-20 rounded-md overflow-hidden border border-border">
                      <img
                        src={m.thumbnail_url ?? m.storage_url}
                        alt={m.filename}
                        className="h-full w-full object-cover"
                      />
                      <button
                        className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center"
                        onClick={() => setSelectedMedia((prev) => prev.filter((x) => x.id !== m.id))}
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {showMediaPicker && (
                <div className="mt-4 border-t border-border pt-4 grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                  {media?.data.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (!selectedMedia.find((s) => s.id === m.id)) {
                          setSelectedMedia((prev) => [...prev, m]);
                        }
                        setShowMediaPicker(false);
                      }}
                      className="h-16 w-full rounded-md overflow-hidden border border-border hover:border-primary transition-colors"
                    >
                      <img src={m.thumbnail_url ?? m.storage_url} alt={m.filename} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cuentas destino */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cuentas destino</CardTitle>
            </CardHeader>
            <CardContent>
              {!accounts?.length ? (
                <p className="text-sm text-muted-foreground">No hay cuentas conectadas</p>
              ) : (
                <div className="space-y-2">
                  {accounts.filter((a) => a.is_active).map((acc) => {
                    const selected = selectedAccounts.includes(acc.id);
                    return (
                      <button
                        key={acc.id}
                        onClick={() => toggleAccount(acc)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                          selected
                            ? "border-primary/50 bg-primary/5"
                            : "border-border hover:border-border/80 hover:bg-accent/50"
                        }`}
                      >
                        <PlatformBadge platform={acc.platform} />
                        <span className="flex-1 text-left truncate">{acc.account_name}</span>
                        {selected && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Vista previa */}
        <div className="space-y-4">
          {activeAccounts.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground text-sm">
                  Selecciona al menos una cuenta para ver la vista previa
                </p>
              </CardContent>
            </Card>
          ) : (
            activeAccounts.map((acc) => {
              const Icon = PLATFORM_ICONS[acc.platform];
              return (
                <Card key={acc.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <CardTitle className="text-sm">{acc.account_name}</CardTitle>
                      </div>
                      <PlatformBadge platform={acc.platform} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedMedia.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {selectedMedia.slice(0, 3).map((m) => (
                          <img
                            key={m.id}
                            src={m.thumbnail_url ?? m.storage_url}
                            alt={m.filename}
                            className="h-24 w-24 rounded-md object-cover shrink-0 border border-border"
                          />
                        ))}
                      </div>
                    )}
                    <Textarea
                      rows={4}
                      value={variants[acc.id] ?? baseCaption}
                      onChange={(e) =>
                        setVariants((prev) => ({ ...prev, [acc.id]: e.target.value }))
                      }
                      placeholder="Caption personalizado para esta plataforma..."
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {(variants[acc.id] ?? baseCaption).length} caracteres
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={!title || createMutation.isPending}
              onClick={() => createMutation.mutate("draft")}
            >
              Guardar borrador
            </Button>
            <Button
              className="flex-1"
              disabled={!title || !selectedAccounts.length || !scheduledAt || createMutation.isPending}
              onClick={() => createMutation.mutate("scheduled")}
            >
              <Plus className="h-4 w-4" />
              Programar
            </Button>
          </div>
          {/* Publicar via Ayrshare */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Publicar en redes ahora</p>
            <div className="flex gap-2">
              {(["facebook", "instagram", "linkedin"] as SocialPlatform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleAyrPlatform(p)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    ayrPlatforms.includes(p)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={!baseCaption || ayrPlatforms.length === 0 || publishing}
              onClick={handlePublishNow}
            >
              {publishing ? "Publicando..." : "Publicar ahora"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
