import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ImageIcon, Info } from "lucide-react";
import { postsApi } from "@/api/posts";
import { mediaApi } from "@/api/media";
import { accountsApi } from "@/api/accounts";
import { useSocialPublish } from "@/hooks/useSocialPublish";
import type { SocialPlatform, InstagramPostType, FacebookPostType } from "@/api/social";
import { whatsappApi } from "@/api/whatsapp";
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
  facebookType: FacebookPostType;
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
  const [showLinkedInPages, setShowLinkedInPages] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [postType, setPostType] = useState<"publicacion" | "historia" | "carrusel" | "reel">(() => {
    if (prefill?.instagramType === "carousel") return "carrusel";
    if (prefill?.instagramType === "story" || prefill?.facebookType === "story") return "historia";
    if (prefill?.instagramType === "reel" || prefill?.facebookType === "reel") return "reel";
    return "publicacion";
  });

  const getInstagramType = (): InstagramPostType => {
    switch (postType) {
      case "carrusel": return "carousel";
      case "historia": return "story";
      case "reel": return "reel";
      default: return "feed";
    }
  };
  const getFacebookType = (): FacebookPostType => {
    switch (postType) {
      case "historia": return "story";
      case "reel": return "reel";
      default: return "post";
    }
  };
  const [selectedAccounts, setSelectedAccounts] = useState<Partial<Record<SocialPlatform, string>>>({});
  const { publish, loading: publishing } = useSocialPublish();

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountsApi.list().then((r) => r.data),
  });
  const allAccounts = accountsData ?? [];

  const accountsForPlatform = (p: SocialPlatform) => {
    const accs = allAccounts.filter((a) => a.platform === p && a.is_active);
    if (p === "linkedin") return accs.filter((a) => !a.account_id.startsWith("urn:li:organization:"));
    return accs;
  };

  const linkedinOrgAccounts = allAccounts.filter(
    (a) => a.platform === "linkedin" && a.account_id.startsWith("urn:li:organization:") && a.is_active
  );
  const linkedInOrgId = linkedinOrgAccounts[0]?.account_id.replace("urn:li:organization:", "") ?? null;

  const downloadImages = async (assets: Array<{ storage_url: string; filename: string }>) => {
    for (const asset of assets) {
      try {
        const res = await fetch(asset.storage_url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = asset.filename || "imagen-linkedin.jpg";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch {
        // CORS fallback: abre en nueva pestaña para guardar manualmente
        window.open(asset.storage_url, "_blank");
      }
    }
  };

  const copyAndOpenLinkedIn = async () => {
    try {
      await navigator.clipboard.writeText(baseCaption);
    } catch {
      // fallback si clipboard no está disponible
    }

    if (selectedMedia.length > 0) {
      await downloadImages(selectedMedia.map((m) => ({ storage_url: m.storage_url, filename: m.filename })));
    }

    const url = linkedInOrgId
      ? `https://www.linkedin.com/company/${linkedInOrgId}/admin/page-posts/new/`
      : "https://www.linkedin.com/feed/";
    window.open(url, "_blank");

    const imgMsg = selectedMedia.length > 0
      ? ` · ${selectedMedia.length} imagen${selectedMedia.length > 1 ? "es descargadas" : " descargada"}`
      : "";
    toast({ title: `Caption copiado${imgMsg} ✓ — pega el texto y sube la imagen en LinkedIn` });
  };

  const copyAndOpenWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(baseCaption);
    } catch {}

    if (selectedMedia.length > 0) {
      await downloadImages(selectedMedia.map((m) => ({ storage_url: m.storage_url, filename: m.filename })));
    }

    window.open("https://web.whatsapp.com/", "_blank");

    const imgMsg = selectedMedia.length > 0
      ? ` · ${selectedMedia.length} imagen${selectedMedia.length > 1 ? "es descargadas" : " descargada"}`
      : "";
    toast({ title: `Caption copiado${imgMsg} ✓ — en WhatsApp Web ve a Estados (ícono de cámara) y pega el texto + sube la imagen` });
  };

  const toggleAyrPlatform = (p: SocialPlatform) => {
    setAyrPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
    if (ayrPlatforms.includes(p)) {
      setSelectedAccounts((prev) => { const next = { ...prev }; delete next[p]; return next; });
    }
  };

  // Platforms compatible with current type selection
  const platformCompatible = (p: SocialPlatform) => {
    if (p === "instagram") return true;
    if (p === "linkedin") return postType === "publicacion";
    if (p === "facebook") return postType === "publicacion" || postType === "reel";
    return false;
  };
  const whatsAppCompatible = postType === "historia";
  const linkedinPagesCompatible = postType === "publicacion";

  // When postType changes, prune incompatible platforms
  const setPostTypeSafe = (t: typeof postType) => {
    setPostType(t);
    if (t === "carrusel") {
      setAyrPlatforms((prev) => prev.filter((p) => p === "instagram"));
      setShowLinkedInPages(false);
      setShowWhatsApp(false);
    } else if (t === "historia") {
      setAyrPlatforms((prev) => prev.filter((p) => p === "instagram"));
      setShowLinkedInPages(false);
    } else if (t === "reel") {
      setAyrPlatforms((prev) => prev.filter((p) => p === "instagram" || p === "facebook"));
      setShowLinkedInPages(false);
      setShowWhatsApp(false);
    } else {
      setAyrPlatforms((prev) => prev.filter((p) => p !== "whatsapp" as SocialPlatform));
      setShowLinkedInPages(false);
      setShowWhatsApp(false);
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
    if (!baseCaption || (ayrPlatforms.length === 0 && !showWhatsApp)) return;
    const mediaUrls = selectedMedia.map((m) => m.storage_url).filter(Boolean);
    const scheduledIso = immediate ? undefined : (scheduledAt ? new Date(scheduledAt).toISOString() : undefined);

    let overallSuccess = true;
    let errorMsg: string | undefined;

    // Publicar en WhatsApp Status via MacroDroid
    if (showWhatsApp) {
      try {
        await whatsappApi.publishStatus(baseCaption, mediaUrls.length > 0 ? mediaUrls : undefined, scheduledIso);
      } catch {
        overallSuccess = false;
        errorMsg = "Error al enviar a WhatsApp";
      }
    }

    // Publicar en otras plataformas via Ayrshare
    if (ayrPlatforms.length > 0) {
      if (!immediate && mediaUrls.length === 0) {
        toast({ title: "Debes adjuntar al menos una imagen para programar una publicación", variant: "destructive" });
        return;
      }
      if (ayrPlatforms.includes("instagram") && mediaUrls.length === 0) {
        toast({ title: "Instagram requiere al menos una imagen", variant: "destructive" });
        return;
      }
      const accounts = Object.fromEntries(
        Object.entries(selectedAccounts).filter(([p]) => (ayrPlatforms as string[]).includes(p))
      ) as Partial<Record<SocialPlatform, string>>;
      const mediaIds = selectedMedia.map((m) => m.id);
      const res = await publish({ content: baseCaption, platforms: ayrPlatforms, mediaUrls, mediaIds, scheduledAt: scheduledIso, instagramType: getInstagramType(), facebookType: getFacebookType(), accounts: Object.keys(accounts).length > 0 ? accounts : undefined });
      if (!res.success) {
        overallSuccess = false;
        errorMsg = res.error;
      }
    }

    if (overallSuccess) {
      toast({ title: scheduledIso ? "Post programado ✓" : "Publicado en redes sociales ✓" });
    } else {
      toast({ title: errorMsg ?? "Error al publicar", variant: "destructive" });
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

          {/* Tipo de publicación */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Tipo de publicación</p>
            <div className="flex gap-2 flex-wrap">
              {([
                { id: "publicacion" as const, label: "Publicación" },
                { id: "historia"    as const, label: "Historia" },
                { id: "carrusel"    as const, label: "Carrusel" },
                { id: "reel"        as const, label: "Reel" },
              ]).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPostTypeSafe(id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    postType === id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Canal */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Canal</p>
          <div className="space-y-2">
            {([
              { id: "facebook",  label: "Facebook" },
              { id: "instagram", label: "Instagram" },
              { id: "linkedin",  label: "LinkedIn (Perfil)" },
            ] as { id: SocialPlatform; label: string }[]).map(({ id, label }) => {
              const accs = accountsForPlatform(id);
              const isOn = ayrPlatforms.includes(id);
              const compatible = platformCompatible(id);
              const canToggle = compatible || isOn;
              return (
                <div key={id} className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => canToggle && toggleAyrPlatform(id)}
                    disabled={!canToggle}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      !compatible && !isOn
                        ? "opacity-30 cursor-not-allowed border-border text-muted-foreground"
                        : isOn
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
                        <SelectValue placeholder="Cuenta principal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">Principal</SelectItem>
                        {accs.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.account_name}
                          </SelectItem>
                        ))}
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
            {/* LinkedIn Empresa (manual / pendiente aprobación) */}
            <div key="linkedin-pages" className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => linkedinPagesCompatible && setShowLinkedInPages(!showLinkedInPages)}
                disabled={!linkedinPagesCompatible && !showLinkedInPages}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  !linkedinPagesCompatible && !showLinkedInPages
                    ? "opacity-30 cursor-not-allowed border-border text-muted-foreground"
                    : showLinkedInPages
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                LinkedIn (Empresa)
              </button>
              {linkedinOrgAccounts.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {linkedinOrgAccounts.length} página{linkedinOrgAccounts.length !== 1 ? "s" : ""} conectada{linkedinOrgAccounts.length !== 1 ? "s" : ""}
                </span>
              )}
              {linkedinOrgAccounts.length === 0 && (
                <span className="text-xs text-muted-foreground/60">Conecta en Cuentas cuando se apruebe el acceso</span>
              )}
            </div>

            <div key="whatsapp" className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => whatsAppCompatible && setShowWhatsApp(!showWhatsApp)}
                disabled={!whatsAppCompatible && !showWhatsApp}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  !whatsAppCompatible && !showWhatsApp
                    ? "opacity-30 cursor-not-allowed border-border text-muted-foreground"
                    : showWhatsApp
                      ? "bg-[#25D366]/20 text-[#25D366] border-[#25D366]/40"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                WhatsApp
              </button>
            </div>
          </div>
          </div>

          {/* Flujo manual para LinkedIn empresa */}
          {showLinkedInPages && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 space-y-2">
              <p className="text-xs text-amber-400 font-medium">
                ⚠️ LinkedIn no permite publicar en páginas de empresa vía API sin aprobación especial.
              </p>
              <p className="text-xs text-muted-foreground">
                Usa el botón de abajo: copia el caption, descarga la imagen automáticamente y abre LinkedIn Empresa para que solo tengas que pegar el texto y subir la imagen.
              </p>
              <Button
                variant="outline"
                className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                disabled={!baseCaption}
                onClick={copyAndOpenLinkedIn}
              >
                📋 Copiar caption{selectedMedia.length > 0 ? ` + descargar imagen${selectedMedia.length > 1 ? "es" : ""}` : ""} y abrir LinkedIn
              </Button>
            </div>
          )}

          {/* Flujo automático para WhatsApp Status */}
          {showWhatsApp && (
            <div className="rounded-lg border border-[#25D366]/30 bg-[#25D366]/8 p-3 space-y-2">
              <p className="text-xs text-[#25D366] font-medium">
                Estados de WhatsApp
              </p>
              <p className="text-xs text-muted-foreground">
                El estado se publicará automáticamente cuando se ejecute la Macro en tu teléfono.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={!baseCaption || (ayrPlatforms.length === 0 && !showWhatsApp) || publishing}
              onClick={() => handlePublish(true)}
            >
              {publishing ? "Procesando..." : "Publicar ahora"}
            </Button>
            <Button
              className="flex-1"
              disabled={!baseCaption || (ayrPlatforms.length === 0 && !showWhatsApp) || publishing}
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
