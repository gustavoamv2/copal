import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ImageIcon } from "lucide-react";
import { postsApi } from "@/api/posts";
import { mediaApi } from "@/api/media";
import { useSocialPublish } from "@/hooks/useSocialPublish";
import type { SocialPlatform } from "@/api/social";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/useToast";
import { MediaAsset } from "@/types";

export function NewPost() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [baseCaption, setBaseCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [ayrPlatforms, setAyrPlatforms] = useState<SocialPlatform[]>(["linkedin"]);
  const { publish, loading: publishing } = useSocialPublish();

  const toggleAyrPlatform = (p: SocialPlatform) =>
    setAyrPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

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

  const handlePublishNow = async () => {
    if (!baseCaption || ayrPlatforms.length === 0) return;
    const mediaUrls = selectedMedia.map((m) => m.storage_url).filter(Boolean);
    const scheduledIso = scheduledAt ? new Date(scheduledAt).toISOString() : undefined;

    if (scheduledIso && mediaUrls.length === 0) {
      toast({ title: "Debes adjuntar al menos una imagen para programar una publicación", variant: "destructive" });
      return;
    }

    if (ayrPlatforms.includes("instagram") && mediaUrls.length === 0) {
      toast({ title: "Instagram requiere al menos una imagen", variant: "destructive" });
      return;
    }

    const res = await publish({ content: baseCaption, platforms: ayrPlatforms, mediaUrls, scheduledAt: scheduledIso });
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
            <div className="flex flex-wrap gap-2">
              {selectedMedia.map((m) => (
                <div key={m.id} className="relative group h-20 w-20 rounded-md overflow-hidden border border-border">
                  <img src={m.thumbnail_url ?? m.storage_url} alt={m.filename} className="h-full w-full object-cover" />
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
            {publishing
              ? "Procesando..."
              : scheduledAt
              ? "Programar publicación"
              : "Publicar ahora"}
          </Button>
        </div>
      </div>
    </div>
  );
}
