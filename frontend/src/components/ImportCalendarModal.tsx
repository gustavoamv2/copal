import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  X,
  Check,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Search,
  Download,
  Calendar,
  Pencil,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  ThumbsUp,
  Share2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/useToast";
import {
  parsePublicationsJson,
  normalizePublication,
  resolveImageFiles,
  importPublication,
} from "@/services/importCalendar";
import {
  ImportedPublication,
  ImportNetwork,
  ImportReport,
  ImportResult,
} from "@/types/import";
import { accountsApi } from "@/api/accounts";
import { SocialAccount } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Step = "upload" | "preview" | "confirm" | "result";
type NetworkFilter = "all" | ImportNetwork;
type ValidationFilter = "all" | "valid" | "warnings" | "errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function networkBadgeClass(n: ImportNetwork): string {
  switch (n) {
    case "LinkedIn":
      return "bg-blue-600 text-white";
    case "Facebook":
      return "bg-blue-900 text-white";
    case "Instagram":
      return "bg-pink-600 text-white";
  }
}

/** Returns true if the publication has at least one resolvable image source */
function hasImageSource(pub: ImportedPublication): boolean {
  if (pub.imageFiles.length > 0) return true;
  return pub.imagePaths.some((p) => /^https?:\/\//i.test(p));
}

function ImageDot({ pub }: { pub: ImportedPublication }) {
  const count = pub.imagePaths.length;
  if (pub.imageFiles.length > 0) {
    return (
      <span className="inline-flex items-center gap-0.5" title={`${pub.imageFiles.length} imagen(es) encontrada(s)`}>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
        {count > 1 && <span className="text-[10px] text-green-500 font-medium">{count}</span>}
      </span>
    );
  }
  // URL-based image: will be fetched automatically on import
  const hasUrlImage = pub.imagePaths.some((p) => /^https?:\/\//i.test(p));
  if (hasUrlImage) {
    return (
      <span
        className="inline-flex items-center gap-0.5"
        title={`URL de imagen detectada — se descargará al importar (${count})`}
      >
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" />
        {count > 1 && <span className="text-[10px] text-blue-400 font-medium">{count}</span>}
      </span>
    );
  }
  if (count > 0) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" title="Ruta(s) sin archivo" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/30" title="Sin imagen" />;
}

function ValidationBadge({ pub }: { pub: ImportedPublication }) {
  const { valid, errors, warnings } = pub.validation;
  if (!valid) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-red-400 cursor-help"
        title={errors.join("\n")}
      >
        <X className="h-3 w-3" /> {errors.length} error{errors.length !== 1 ? "es" : ""}
      </span>
    );
  }
  if (warnings.length > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-yellow-400 cursor-help"
        title={warnings.join("\n")}
      >
        <AlertTriangle className="h-3 w-3" /> {warnings.length} aviso{warnings.length !== 1 ? "s" : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-500">
      <Check className="h-3 w-3" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Post Preview Modal
// ---------------------------------------------------------------------------
interface PostPreviewModalProps {
  pub: ImportedPublication;
  onEdit: () => void;
  onClose: () => void;
}

function PostPreviewModal({ pub, onEdit, onClose }: PostPreviewModalProps) {
  const [activeNetwork, setActiveNetwork] = useState<ImportNetwork>(pub.networks[0] ?? "Instagram");

  const imageUrl = pub.imageFile
    ? URL.createObjectURL(pub.imageFile)
    : pub.imageUrl ?? null;

  const dateLabel = pub.scheduledAt
    ? new Date(pub.scheduledAt).toLocaleString("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Sin fecha";

  // Truncate caption for preview
  const MAX_CHARS = 280;
  const [expanded, setExpanded] = useState(false);
  const captionTrunc =
    pub.caption.length > MAX_CHARS && !expanded
      ? pub.caption.slice(0, MAX_CHARS) + "…"
      : pub.caption;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground truncate max-w-[220px]">
              {pub.title}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent/30 text-muted-foreground hover:text-foreground transition-colors"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent/30 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Network switcher */}
        {pub.networks.length > 1 && (
          <div className="flex gap-1 px-4 pt-3">
            {pub.networks.map((n) => (
              <button
                key={n}
                onClick={() => setActiveNetwork(n)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeNetwork === n
                    ? networkBadgeClass(n) + " border-transparent"
                    : "border-border text-muted-foreground hover:border-border/60"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Card preview */}
        <div className="p-4">
          {activeNetwork === "Instagram" && (
            <InstagramPreview
              pub={pub}
              imageUrl={imageUrl}
              captionTrunc={captionTrunc}
              expanded={expanded}
              setExpanded={setExpanded}
              dateLabel={dateLabel}
            />
          )}
          {activeNetwork === "Facebook" && (
            <FacebookPreview
              pub={pub}
              imageUrl={imageUrl}
              captionTrunc={captionTrunc}
              expanded={expanded}
              setExpanded={setExpanded}
              dateLabel={dateLabel}
            />
          )}
          {activeNetwork === "LinkedIn" && (
            <LinkedInPreview
              pub={pub}
              imageUrl={imageUrl}
              captionTrunc={captionTrunc}
              expanded={expanded}
              setExpanded={setExpanded}
              dateLabel={dateLabel}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex items-center justify-between gap-3 border-t border-border mt-1 pt-3">
          <p className="text-[10px] text-muted-foreground/50">
            Vista previa ilustrativa · El contenido real puede variar
          </p>
          <Button size="sm" variant="outline" onClick={onEdit} className="shrink-0 gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Avatar placeholder ──────────────────────────────────────────────────────
function AvatarPlaceholder({ size = 9, letter = "M" }: { size?: number; letter?: string }) {
  const s = `h-${size} w-${size}`;
  return (
    <div className={`${s} rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0`}>
      {letter}
    </div>
  );
}

// ── Instagram card ──────────────────────────────────────────────────────────
interface CardProps {
  pub: ImportedPublication;
  imageUrl: string | null;
  captionTrunc: string;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  dateLabel: string;
}

function InstagramPreview({ pub, imageUrl, captionTrunc, expanded, setExpanded, dateLabel }: CardProps) {
  const isStory = pub.instagramType === "story";
  const isCarousel = pub.instagramType === "carousel";

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-[#111] text-white text-sm shadow-md">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px] shrink-0">
          <div className="h-full w-full rounded-full bg-[#111] flex items-center justify-center text-xs font-bold text-white">M</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-tight">tu_marca</p>
          {isStory && <p className="text-[10px] text-gray-400">Historia</p>}
          {isCarousel && <p className="text-[10px] text-gray-400">Carrusel</p>}
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400 shrink-0" />
      </div>

      {/* Image */}
      {imageUrl ? (
        <div className={`w-full bg-black ${isStory ? "aspect-[9/16]" : "aspect-square"} overflow-hidden relative`}>
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          {isCarousel && (
            <div className="absolute top-2 right-2 bg-black/60 rounded-full px-2 py-0.5 text-[10px]">1 / 3</div>
          )}
        </div>
      ) : (
        <div className={`w-full bg-[#222] ${isStory ? "aspect-[9/16]" : "aspect-square"} flex items-center justify-center text-gray-600 text-xs`}>
          Sin imagen
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 px-3 py-2">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5" />
        <Send className="h-5 w-5" />
        <Bookmark className="h-5 w-5 ml-auto" />
      </div>

      {/* Caption */}
      <div className="px-3 pb-3 space-y-1">
        <p className="text-xs font-semibold">tu_marca{" "}
          <span className="font-normal text-gray-300 whitespace-pre-wrap break-words">{captionTrunc}</span>
          {pub.caption.length > 280 && !expanded && (
            <button className="text-gray-500 ml-1" onClick={() => setExpanded(true)}>más</button>
          )}
        </p>
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{dateLabel}</p>
      </div>
    </div>
  );
}

// ── Facebook card ───────────────────────────────────────────────────────────
function FacebookPreview({ pub, imageUrl, captionTrunc, expanded, setExpanded, dateLabel }: CardProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-[#18191a] text-white text-sm shadow-md">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <AvatarPlaceholder size={9} letter="M" />
        <div className="flex-1">
          <p className="text-xs font-semibold leading-tight">Tu Marca</p>
          <p className="text-[10px] text-gray-400">{dateLabel} · 🌐</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400 shrink-0" />
      </div>

      {/* Caption */}
      <div className="px-3 pb-2">
        <p className="text-xs text-gray-200 whitespace-pre-wrap break-words leading-relaxed">{captionTrunc}
          {pub.caption.length > 280 && !expanded && (
            <button className="text-blue-400 ml-1" onClick={() => setExpanded(true)}>Ver más</button>
          )}
        </p>
      </div>

      {/* Image */}
      {imageUrl ? (
        <div className="w-full aspect-video bg-black overflow-hidden">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-video bg-[#3a3b3c] flex items-center justify-center text-gray-500 text-xs">
          Sin imagen
        </div>
      )}

      {/* Reaction bar */}
      <div className="flex items-center justify-between px-3 py-2 text-gray-400 text-[11px] border-t border-[#3a3b3c]">
        <span className="flex items-center gap-1">👍 ❤️ <span className="text-gray-500">Me gusta</span></span>
        <span className="flex items-center gap-3">
          <span>Comentar</span>
          <span>Compartir</span>
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center px-3 pb-2 gap-1 border-t border-[#3a3b3c]">
        {[
          { icon: <ThumbsUp className="h-4 w-4" />, label: "Me gusta" },
          { icon: <MessageCircle className="h-4 w-4" />, label: "Comentar" },
          { icon: <Share2 className="h-4 w-4" />, label: "Compartir" },
        ].map(({ icon, label }) => (
          <button key={label} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-gray-400 hover:bg-[#3a3b3c] rounded-md transition-colors">
            {icon} {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── LinkedIn card ───────────────────────────────────────────────────────────
function LinkedInPreview({ pub, imageUrl, captionTrunc, expanded, setExpanded, dateLabel }: CardProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-[#1b1f23] text-white text-sm shadow-md">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
        <AvatarPlaceholder size={10} letter="M" />
        <div className="flex-1">
          <p className="text-xs font-semibold leading-tight">Tu Marca</p>
          <p className="text-[10px] text-gray-400">Empresa · {dateLabel}</p>
          <p className="text-[10px] text-gray-500">🌐</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400 shrink-0" />
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-200 whitespace-pre-wrap break-words leading-relaxed">{captionTrunc}
          {pub.caption.length > 280 && !expanded && (
            <button className="text-[#70b5f9] ml-1" onClick={() => setExpanded(true)}>...más</button>
          )}
        </p>
      </div>

      {/* Image */}
      {imageUrl ? (
        <div className="w-full aspect-video bg-black overflow-hidden">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-video bg-[#2c3036] flex items-center justify-center text-gray-500 text-xs">
          Sin imagen
        </div>
      )}

      {/* Reactions */}
      <div className="px-4 py-2 flex items-center justify-between text-[10px] text-gray-500 border-t border-[#2c3036]">
        <span>👍 💡 ❤️</span>
        <span>0 comentarios</span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center px-2 pb-3 gap-0.5 border-t border-[#2c3036]">
        {[
          { icon: <ThumbsUp className="h-4 w-4" />, label: "Recomendar" },
          { icon: <MessageCircle className="h-4 w-4" />, label: "Comentar" },
          { icon: <Share2 className="h-4 w-4" />, label: "Compartir" },
          { icon: <Send className="h-4 w-4" />, label: "Enviar" },
        ].map(({ icon, label }) => (
          <button key={label} className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] text-gray-400 hover:bg-[#2c3036] rounded-md transition-colors">
            {icon} {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------
interface EditModalProps {
  pub: ImportedPublication;
  onSave: (caption: string, scheduledAt: string) => void;
  onClose: () => void;
}

function EditModal({ pub, onSave, onClose }: EditModalProps) {
  const [caption, setCaption] = useState(pub.caption);
  const [scheduledAt, setScheduledAt] = useState(pub.scheduledAt);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-lg p-6 w-full max-w-lg space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm truncate">{pub.title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Caption</label>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={6}
            className="text-sm resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Fecha y hora</label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => { onSave(caption, scheduledAt); onClose(); }}>Guardar</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Upload
// ---------------------------------------------------------------------------
interface UploadStepProps {
  onParsed: (pubs: ImportedPublication[]) => void;
  onNext: () => void;
  count: number;
}

function UploadStep({ onParsed, onNext, count }: UploadStepProps) {
  const jsonRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [jsonLoaded, setJsonLoaded] = useState(false);
  const [parsedPubs, setParsedPubs] = useState<ImportedPublication[]>([]);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJsonError(null);
    try {
      const raws = await parsePublicationsJson(file);
      const normalized = raws.map(normalizePublication);
      setParsedPubs(normalized);
      setJsonLoaded(true);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Error al parsear el JSON");
      setJsonLoaded(false);
    }
  };

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setImageFiles(files);
  };

  const handleNext = () => {
    const resolved = imageFiles.length > 0
      ? resolveImageFiles(parsedPubs, imageFiles)
      : parsedPubs;
    onParsed(resolved);
    onNext();
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Importar calendario</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sube el archivo JSON de publicaciones y las imágenes correspondientes.
        </p>
      </div>

      {/* JSON */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">publicaciones.json</span>
            <span className="text-xs text-red-400">requerido</span>
          </div>
          <input
            ref={jsonRef}
            type="file"
            accept=".json"
            onChange={handleJson}
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={() => jsonRef.current?.click()}>
            Seleccionar archivo JSON
          </Button>
          {jsonLoaded && (
            <p className="text-xs text-green-500 flex items-center gap-1">
              <Check className="h-3 w-3" /> {parsedPubs.length} publicaciones detectadas
            </p>
          )}
          {jsonError && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <X className="h-3 w-3" /> {jsonError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Imágenes</span>
            <span className="text-xs text-muted-foreground">opcional</span>
          </div>
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImages}
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={() => imgRef.current?.click()}>
            Seleccionar imágenes
          </Button>
          {imageFiles.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {imageFiles.length} archivo{imageFiles.length !== 1 ? "s" : ""} seleccionado{imageFiles.length !== 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!jsonLoaded}>
          Siguiente <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {count > 0 && <p className="text-xs text-muted-foreground">{count} publicaciones cargadas</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Preview
// ---------------------------------------------------------------------------
interface PreviewStepProps {
  publications: ImportedPublication[];
  onChange: (pubs: ImportedPublication[]) => void;
  onBack: () => void;
  onNext: () => void;
}

function PreviewStep({ publications, onChange, onBack, onNext }: PreviewStepProps) {
  const [search, setSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>("all");
  const [validationFilter, setValidationFilter] = useState<ValidationFilter>("all");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  const filtered = publications.filter((pub) => {
    if (search && !pub.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (networkFilter !== "all" && !pub.networks.includes(networkFilter)) return false;
    if (validationFilter === "valid" && (!pub.validation.valid || pub.validation.warnings.length > 0)) return false;
    if (validationFilter === "warnings" && pub.validation.warnings.length === 0) return false;
    if (validationFilter === "errors" && pub.validation.valid) return false;
    return true;
  });

  const selectedCount = publications.filter((p) => p.selected).length;

  const toggleAll = (select: boolean) => {
    onChange(publications.map((p) => ({ ...p, selected: select })));
  };

  const toggleOne = (idx: number) => {
    const real = publications.indexOf(filtered[idx]);
    if (real < 0) return;
    const next = [...publications];
    next[real] = { ...next[real], selected: !next[real].selected };
    onChange(next);
  };

  const updatePub = (idx: number, caption: string, scheduledAt: string) => {
    const real = publications.indexOf(filtered[idx]);
    if (real < 0) return;
    const next = [...publications];
    next[real] = { ...next[real], caption, scheduledAt };
    onChange(next);
  };

  const updateScheduledAt = (idx: number, scheduledAt: string) => {
    const real = publications.indexOf(filtered[idx]);
    if (real < 0) return;
    const next = [...publications];
    next[real] = { ...next[real], scheduledAt };
    onChange(next);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "Facebook", "Instagram", "LinkedIn"] as NetworkFilter[]).map((n) => (
              <Button
                key={n}
                variant={networkFilter === n ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setNetworkFilter(n)}
              >
                {n === "all" ? "Todas" : n}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["all", "valid", "warnings", "errors"] as ValidationFilter[]).map((v) => (
              <Button
                key={v}
                variant={validationFilter === v ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setValidationFilter(v)}
              >
                {v === "all" ? "Todos" : v === "valid" ? "Válidos" : v === "warnings" ? "Avisos" : "Errores"}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAll(true)}>
            Seleccionar todo
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAll(false)}>
            Deseleccionar todo
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {selectedCount} de {publications.length} seleccionadas
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 text-left">Fecha/Hora</th>
              <th className="px-3 py-2 text-left">Red</th>
              <th className="px-3 py-2 text-left">Título</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-center">Imagen</th>
              <th className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map((pub, idx) => (
              <tr
                key={pub.raw.id}
                className="hover:bg-accent/20 transition-colors cursor-pointer"
                onClick={() => setPreviewIdx(idx)}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={pub.selected}
                    onChange={() => toggleOne(idx)}
                    className="h-3.5 w-3.5 accent-primary cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="datetime-local"
                    value={pub.scheduledAt}
                    onChange={(e) => updateScheduledAt(idx, e.target.value)}
                    className="bg-transparent text-xs border border-transparent hover:border-border focus:border-border rounded px-1 py-0.5 outline-none w-36"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {pub.networks.map((n) => (
                      <span
                        key={n}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${networkBadgeClass(n)}`}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 max-w-[180px]">
                  <span
                    className="text-left truncate text-xs block"
                    title={pub.title}
                  >
                    {pub.title || <span className="italic text-muted-foreground">Sin título</span>}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-[10px] text-muted-foreground">{pub.raw.tipo_publicacion ?? "—"}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <ImageDot pub={pub} />
                </td>
                <td className="px-3 py-2">
                  <ValidationBadge pub={pub} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground text-xs">
                  No hay publicaciones que coincidan con los filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <Button onClick={onNext} disabled={selectedCount === 0}>
          Continuar <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Preview modal */}
      {previewIdx !== null && (
        <PostPreviewModal
          pub={filtered[previewIdx]}
          onEdit={() => {
            setEditingIdx(previewIdx);
            setPreviewIdx(null);
          }}
          onClose={() => setPreviewIdx(null)}
        />
      )}

      {/* Edit modal */}
      {editingIdx !== null && (
        <EditModal
          pub={filtered[editingIdx]}
          onSave={(caption, scheduledAt) => updatePub(editingIdx, caption, scheduledAt)}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Confirm + import
// ---------------------------------------------------------------------------
interface ConfirmStepProps {
  publications: ImportedPublication[];
  onBack: () => void;
  onDone: (report: ImportReport) => void;
}

function ConfirmStep({ publications, onBack, onDone }: ConfirmStepProps) {
  const selected = publications.filter((p) => p.selected);
  // Count posts that have at least one resolvable image (local file OR URL)
  const withImage = selected.filter(hasImageSource).length;
  const withoutImage = selected.length - withImage;
  const withWarnings = selected.filter((p) => p.validation.warnings.length > 0).length;
  const withErrors = selected.filter((p) => !p.validation.valid).length;
  const withPastDate = selected.filter((p) => p.scheduledAt && new Date(p.scheduledAt) <= new Date()).length;

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

  const handleImport = async () => {
    setImporting(true);
    cancelRef.current = false;
    setProgress(0);

    const results: ImportResult[] = [];

    let activeAccounts: SocialAccount[] = [];
    try {
      const res = await accountsApi.list();
      activeAccounts = res.data.filter((a) => a.is_active);
    } catch {
      // continue without accounts — variants won't be created for auto-platforms
    }

    for (let i = 0; i < selected.length; i++) {
      if (cancelRef.current) break;
      setProgress(i + 1);

      const pub = selected[i];
      // Siempre importar como "scheduled":
      // - Facebook e Instagram se programan automáticamente via variants
      // - LinkedIn queda en "Pendiente manual"
      const { success, error } = await importPublication(pub, "scheduled", activeAccounts);
      results.push({
        id: pub.raw.id,
        title: pub.title,
        success,
        error,
      });
    }

    const report: ImportReport = {
      total: selected.length,
      imported: results.filter((r) => r.success).length,
      skipped: results.filter((r) => r.skipped).length,
      errors: results.filter((r) => !r.success && !r.skipped).length,
      duplicates: results.filter((r) => r.duplicate).length,
      missingImages: selected.filter((p) => p.imagePath && !hasImageSource(p)).length,
      results,
    };

    setImporting(false);
    onDone(report);
  };

  const pct = selected.length > 0 ? Math.round((progress / selected.length) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Confirmar importación</h2>
        <p className="text-sm text-muted-foreground mt-1">Revisa el resumen antes de importar.</p>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Seleccionadas</span><strong>{selected.length}</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Con imagen</span><strong className="text-green-500">{withImage}</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Sin imagen</span><strong className="text-yellow-400">{withoutImage}</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Con advertencias</span><strong className="text-yellow-400">{withWarnings}</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Con errores</span><strong className="text-red-400">{withErrors}</strong></div>
        </CardContent>
      </Card>

      {withErrors > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{withErrors} publicación{withErrors !== 1 ? "es" : ""} con errores serán importadas igualmente. Pueden fallar.</span>
        </div>
      )}

      {withPastDate > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>{withPastDate}</strong> publicación{withPastDate !== 1 ? "es tienen" : " tiene"} fecha en el pasado.
            {" "}Se guardarán como <strong>borrador</strong> en lugar de programarse en redes.
          </span>
        </div>
      )}

      {/* Comportamiento automático por plataforma */}
      <div className="rounded-lg border border-border bg-accent/20 divide-y divide-border overflow-hidden text-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-base">📸</span>
          <div>
            <p className="font-medium text-foreground">Instagram · Facebook</p>
            <p className="text-xs text-muted-foreground">Se programan automáticamente según la fecha del calendario</p>
          </div>
          <span className="ml-auto text-xs font-medium text-green-500 shrink-0">Auto</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-base">💼</span>
          <div>
            <p className="font-medium text-foreground">LinkedIn</p>
            <p className="text-xs text-muted-foreground">Se guarda con fecha pero requiere publicación manual desde la pestaña "Pendiente manual"</p>
          </div>
          <span className="ml-auto text-xs font-medium text-amber-400 shrink-0">Manual</span>
        </div>
      </div>

      {/* Progress */}
      {importing && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Importando...</span>
            <span>{progress} / {selected.length}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={importing}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <Button onClick={handleImport} disabled={importing || selected.length === 0}>
          {importing ? "Importando..." : "Importar"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Result
// ---------------------------------------------------------------------------
interface ResultStepProps {
  report: ImportReport;
  onClose: () => void;
}

function ResultStep({ report, onClose }: ResultStepProps) {
  const downloadCsv = () => {
    const header = "id,titulo,exito,error,omitido,duplicado";
    const rows = report.results.map((r) =>
      [r.id, `"${r.title.replace(/"/g, '""')}"`, r.success, r.error ?? "", r.skipped ?? false, r.duplicate ?? false].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Resultado de la importación</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total leídas", value: report.total, color: "" },
          { label: "Importadas", value: report.imported, color: "text-green-500", icon: "✅" },
          { label: "Omitidas", value: report.skipped, color: "text-muted-foreground", icon: "⏭" },
          { label: "Errores", value: report.errors, color: "text-red-400", icon: "❌" },
          { label: "Duplicados", value: report.duplicates, color: "text-yellow-400", icon: "⚠" },
          { label: "Sin imagen", value: report.missingImages, color: "text-yellow-400" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{stat.icon} {stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Results list */}
      <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border/50">
        {report.results.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
            {r.success
              ? <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
              : r.skipped
              ? <span className="text-muted-foreground text-xs shrink-0">⏭</span>
              : <X className="h-3.5 w-3.5 text-red-400 shrink-0" />}
            <span className="truncate flex-1">{r.title}</span>
            {r.error && <span className="text-xs text-red-400 truncate max-w-[200px]">{r.error}</span>}
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={downloadCsv}>
          <Download className="h-4 w-4 mr-2" /> Descargar reporte CSV
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Subir archivos" },
  { key: "preview", label: "Previsualizar" },
  { key: "confirm", label: "Confirmar" },
  { key: "result", label: "Resultado" },
];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-border">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-colors ${
            i < idx ? "bg-primary text-primary-foreground" :
            i === idx ? "bg-primary text-primary-foreground" :
            "bg-secondary text-muted-foreground"
          }`}>
            {i < idx ? <Check className="h-3 w-3" /> : i + 1}
          </div>
          <span className={`text-xs hidden sm:inline ${i === idx ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImportCalendarModal
// ---------------------------------------------------------------------------
interface ImportCalendarModalProps {
  onClose: () => void;
}

export function ImportCalendarModal({ onClose }: ImportCalendarModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [publications, setPublications] = useState<ImportedPublication[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDone = useCallback((r: ImportReport) => {
    setReport(r);
    setStep("result");
    if (r.imported > 0) {
      toast({ title: `${r.imported} publicación${r.imported !== 1 ? "es" : ""} importada${r.imported !== 1 ? "s" : ""} correctamente` });
    }
    if (r.errors > 0) {
      toast({ title: `${r.errors} publicación${r.errors !== 1 ? "es" : ""} fallaron`, variant: "destructive" });
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="font-semibold">Importar calendario</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <StepIndicator current={step} />

        <div className="flex-1 overflow-y-auto">
          {step === "upload" && (
            <UploadStep
              onParsed={setPublications}
              onNext={() => setStep("preview")}
              count={publications.length}
            />
          )}
          {step === "preview" && (
            <PreviewStep
              publications={publications}
              onChange={setPublications}
              onBack={() => setStep("upload")}
              onNext={() => setStep("confirm")}
            />
          )}
          {step === "confirm" && (
            <ConfirmStep
              publications={publications}
              onBack={() => setStep("preview")}
              onDone={handleDone}
            />
          )}
          {step === "result" && report && (
            <ResultStep report={report} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImportCalendarButton
// ---------------------------------------------------------------------------
export function ImportCalendarButton() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const handleClose = () => {
    setOpen(false);
    // Refresh calendar and scheduled views after import
    qc.invalidateQueries({ queryKey: ["posts"] });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Importar calendario
      </Button>
      {open && <ImportCalendarModal onClose={handleClose} />}
    </>
  );
}
