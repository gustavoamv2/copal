import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ImageIcon, Info } from "lucide-react";
import { postsApi } from "@/api/posts";
import { mediaApi } from "@/api/media";
import { accountsApi } from "@/api/accounts";
import { useSocialPublish } from "@/hooks/useSocialPublish";
import type { SocialPlatform, InstagramPostType } from "@/api/social";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/useToast";
import { MediaAsset } from "@/types";

interface PrefillData {
  title: string;
  caption: string;
  scheduledAt: string | null;
  media: MediaAsset[];
  platforms: SocialPlatform[];
  instagramType: InstagramPostType;
}

export function NewPost() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const prefill = (location.state as { prefill?: PrefillData } | null)?.prefill ?? null;

  const [title, setTitle] = useState(prefill?.title ?? "");
  const [baseCaption, setBaseCaption] = useState(prefill?.caption ?? "");
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (prefill?.scheduledAt) {
      const d = new Date(prefill.scheduledAt);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>(prefill?.media ?? []);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [ayrPlatforms, setAyrPlatforms] = useState<SocialPlatform[]>(prefill?.platforms ?? ["linkedin"]);
  const [instagramType, setInstagramType] = useState<InstagramPostType>(prefill?.instagramType ?? "feed");
  const [selectedAccounts, setSelectedAccounts] = useState<Partial<Record<SocialPlatform, string>>>({});
  const { publish, loading: publishing } = useSocialPublish();

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list().then((r) => r.data),
  });
  const allAccounts = accountsData ?? [];

  const accountsForPlatform = (p: SocialPlatform) =>
    allAccounts.filter((a) => a.platform === p && a.is_active);

  const toggleAyrPlatform = (p: SocialPlatform) => {
    setAyrPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
    if (ayrPlatforms.includes(p)) {
      setSelectedAccounts((prev) => { const next = { ...prev }; delete next[p]; return next; });
    }
  };

  const { data: media } = useQuery({
    queryKey: ["media", { limit: 30 }],
    queryFn: () => mediaApi.list({ limit: 30 }).then((r) => r.data),
    enabled: showMediaPicker,
  });

  const saveMutation = useMutation({
    mutationFn: (status: "draft" | "scheduled") =>
      postsApi.create({
        title,
        base_caption: baseCaption,
        status,
        scheduled_at: status === "scheduled" ? scheduledAt || null : null,
        variants: [],
        media_ids: selectedMedia.map((m) => m.id),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast({ title: "Publicación guardada" });
      navigate("/scheduled");
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  const handlePublish = async (immediate: boolean) => {
    if (!baseCaption || ayrPlatforms.length === 0) return;
    const mediaUrls = selectedMedia.map((m) => m.storage_url).filter(Boolean);
    const scheduledIso = immediate ? undefined : (scheduledAt ? new Date(scheduledAt).toISOString() : undefined);

    if (!immediate && mediaUrls.length === 0) {
      toast({ title: "Debes adjuntar al menos una imagen para programar una publicación", variant: "destructive" });
      return;
    }

    if (ayrPlatforms.includes("instagram") && mediaUrls.length === 0) {
      toast({ title: "Instagram requiere al menos una imagen", variant: "destructive" });
      return;
    }

    const accounts = Object.fromEntries(
      Object.entries(selectedAccounts).filter(([p]) => ayrPlatforms.includes(p as SocialPlatform))
    ) as Partial<Record<SocialPlatform, string>>;

    const mediaIds = selectedMedia.map((m) => m.id);

    const res = await publish({ content: baseCaption, platforms: ayrPlatforms, mediaUrls, mediaIds, scheduledAt: scheduledIso, instagramType, accounts: Object.keys(accounts).length > 0 ? accounts : undefined });
    if (res.success) {
      toast({ title: scheduledIso ? "Post programado ✓" : "Publicado en redes sociales ✓" });
    } else {
      toast({ title: res.error ?? "Error al publicar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Nueva publicación</h1>
        <p className="text-muted-foreground text-sm mt-1">Crea y publica contenido en tus redes</p>
      </div>

      {prefill && (
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/25 bg-blue-500/8 px-3.5 py-2.5 text-sm text-blue-400">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Datos cargados de <strong>"{prefill.title}"</strong> — modifica las plataformas, el tipo de publicación o la fecha y luego publica.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contenido</CardTitle>
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
            <Label>Caption</Label>
            <Textarea
              placeholder="Escribe tu caption aquí..."
              rows={5}
              value={baseCaption}
              onChange={(e) => setBaseCaption(e.target.value)}
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
          <CardTitle className="text-base">Imágenes</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowMediaPicker(!showMediaPicker)}>
            <ImageIcon className="h-4 w-4" />
            Seleccionar
          </Button>
        </CardHeader>
        <CardContent>
          {selectedMedia.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin imágenes adjuntas</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {selectedMedia.map((m) => (
                <div key={m.id} className="relative group h-40 w-40 rounded-lg overflow-hidden border border-border">
                  <img src={m.storage_url} alt={m.filename} className="h-full w-full object-cover" />
                  <button
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setSelectedMedia((prev) => prev.filter((x) => x.id !== m.id))}
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {showMediaPicker && (
            <div className="mt-4 border-t border-border pt-4">
              {!media?.data.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin imágenes.{" "}
                  <a href="/media" className="underline hover:text-foreground">
                    Sube imágenes en la biblioteca
                  </a>
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                  {media.data.map((m) => (
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="space-y-3">
        {/* Guardar en BD */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={!title || saveMutation.isPending}
            onClick={() => saveMutation.mutate("draft")}
          >
            Guardar borrador
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={!title || !scheduledAt || saveMutation.isPending}
            onClick={() => saveMutation.mutate("scheduled")}
          >
            Guardar programado
          </Button>
        </div>

        {/* Publicar via Ayrshare */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Publicar en redes sociales</p>

          {/* Selector de plataformas + cuenta */}
          <div className="space-y-2">
            {([
              { id: "facebook",  label: "Facebook" },
              { id: "instagram", label: "Instagram" },
              { id: "linkedin",  label: "LinkedIn" },
            ] as { id: SocialPlatform; label: string }[]).map(({ id, label }) => {
              const accs = accountsForPlatform(id);
              const isOn = ayrPlatforms.includes(id);
              return (
                <div key={id} className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggleAyrPlatform(id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isOn
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {label}
                  </button>
                  {isOn && accs.length > 1 && (
                    <Select
                      value={selectedAccounts[id] ?? "__auto__"}
                      onValueChange={(v) =>
                        setSelectedAccounts((prev) => ({
                          ...prev,
                          [id]: v === "__auto__" ? undefined : v,
                        }))
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-44">
                        <SelectValue placeholder="Cuenta automática" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">Automática (personal)</SelectItem>
                        {accs.map((a) => {
                          const isOrg = a.account_id.startsWith("urn:li:organization:");
                          return (
                            <SelectItem key={a.id} value={a.id} disabled={isOrg}>
                              {a.account_name}{isOrg ? " (página — no disponible)" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {isOn && accs.length === 1 && (
                    <span className="text-xs text-muted-foreground">{accs[0].account_name}</span>
                  )}
                  {isOn && accs.length === 0 && (
                    <span className="text-xs text-amber-500">Sin cuentas — conecta en Cuentas</span>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              disabled
              title="Próximamente"
              className="px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground opacity-40 cursor-not-allowed"
            >
              WhatsApp · Próximamente
            </button>
          </div>

          {/* Tipo de contenido Instagram */}
          {ayrPlatforms.includes("instagram") && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Tipo de contenido en Instagram</p>
              <div className="flex gap-2">
                {([
                  { id: "feed", label: "Publicación" },
                  { id: "carousel", label: "Carrusel" },
                  { id: "story", label: "Historia" },
                ] as { id: InstagramPostType; label: string }[]).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInstagramType(id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      instagramType === id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={!baseCaption || ayrPlatforms.length === 0 || publishing}
              onClick={() => handlePublish(true)}
            >
              {publishing ? "Procesando..." : "Publicar ahora"}
            </Button>
            <Button
              className="flex-1"
              disabled={!baseCaption || ayrPlatforms.length === 0 || publishing}
              onClick={() => handlePublish(false)}
            >
              {publishing ? "Procesando..." : "Programar publicación"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
