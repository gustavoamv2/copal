import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Upload, Trash2, Film, ImageIcon, Tag, CheckSquare } from "lucide-react";
import { mediaApi } from "@/api/media";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/useToast";
import { formatDate } from "@/lib/utils";
import { MediaAsset } from "@/types";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Media() {
  const qc = useQueryClient();
  const [filter,      setFilter]      = useState<"all" | "image" | "video">("all");
  const [selected,    setSelected]    = useState<MediaAsset | null>(null);
  const [checked,     setChecked]     = useState<Set<string>>(new Set());
  const [bulkMode,    setBulkMode]    = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["media", { type: filter === "all" ? undefined : filter }],
    queryFn: () =>
      mediaApi.list({ type: filter === "all" ? undefined : filter, limit: 60 }).then((r) => r.data),
  });

  const assets = data?.data ?? [];

  const uploadMutation = useMutation({
    mutationFn: (file: File) => mediaApi.upload(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      toast({ title: "Archivo subido correctamente" });
    },
    onError: () => toast({ title: "Error al subir archivo", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mediaApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      setSelected(null);
      toast({ title: "Archivo eliminado" });
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const onDrop = useCallback(
    (files: File[]) => { files.forEach((file) => uploadMutation.mutate(file)); },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [], "video/*": [] },
    multiple: true,
  });

  // ── Checkbox helpers ──────────────────────────────────────────────────────
  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checked.size === assets.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(assets.map((a) => a.id)));
    }
  };

  const enterBulkMode = () => {
    setBulkMode(true);
    setSelected(null);
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setChecked(new Set());
  };

  const bulkDelete = async () => {
    if (checked.size === 0) return;
    setBulkDeleting(true);
    let ok = 0;
    for (const id of checked) {
      try { await mediaApi.delete(id); ok++; } catch { /* continue */ }
    }
    setChecked(new Set());
    qc.invalidateQueries({ queryKey: ["media"] });
    toast({ title: `${ok} archivo${ok !== 1 ? "s" : ""} eliminado${ok !== 1 ? "s" : ""}` });
    setBulkDeleting(false);
    if (ok === checked.size) exitBulkMode();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Biblioteca de medios</h1>
        <p className="text-muted-foreground text-sm mt-1">Administra tus imágenes y videos</p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-border/70 hover:bg-accent/30"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">
          {isDragActive ? "Suelta los archivos aquí" : "Arrastra archivos o haz clic para subir"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF, WebP, MP4, MOV · máx 100 MB</p>
        {uploadMutation.isPending && <div className="mt-3 text-xs text-primary">Subiendo...</div>}
      </div>

      {/* Filters + actions */}
      <div className="flex gap-2 flex-wrap items-center">
        {(["all", "image", "video"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Todos" : f === "image" ? "Imágenes" : "Videos"}
          </Button>
        ))}

        <span className="text-sm text-muted-foreground">{data?.total ?? 0} archivos</span>

        <div className="ml-auto flex gap-2">
          {!bulkMode ? (
            <Button variant="outline" size="sm" onClick={enterBulkMode} className="gap-1.5" disabled={assets.length === 0}>
              <CheckSquare className="h-4 w-4" />
              Seleccionar
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {checked.size === assets.length ? "Deseleccionar todo" : "Seleccionar todo"}
              </Button>
              <Button variant="ghost" size="sm" onClick={exitBulkMode}>
                Cancelar
              </Button>
              {checked.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={bulkDelete}
                  disabled={bulkDeleting}
                  className="gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  {bulkDeleting ? "Eliminando..." : `Eliminar ${checked.size}`}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : !assets.length ? (
            <div className="text-center py-20 text-muted-foreground text-sm">
              Sin archivos. Sube tu primer media.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {assets.map((asset) => {
                const isChecked = checked.has(asset.id);
                const isSelected = selected?.id === asset.id;

                return (
                  <button
                    key={asset.id}
                    onClick={() => {
                      if (bulkMode) {
                        toggleCheck(asset.id);
                      } else {
                        setSelected(isSelected ? null : asset);
                      }
                    }}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      isChecked
                        ? "border-primary ring-2 ring-primary/30"
                        : isSelected
                        ? "border-primary"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    {asset.file_type.startsWith("video/") ? (
                      <div className="h-full w-full flex items-center justify-center bg-muted">
                        <Film className="h-8 w-8 text-muted-foreground" />
                      </div>
                    ) : (
                      <img
                        src={asset.thumbnail_url ?? asset.storage_url}
                        alt={asset.filename}
                        className="h-full w-full object-cover"
                      />
                    )}

                    {/* Checkbox overlay in bulk mode */}
                    {bulkMode && (
                      <div className={`absolute top-1.5 left-1.5 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isChecked
                          ? "bg-primary border-primary"
                          : "bg-black/40 border-white/60"
                      }`}>
                        {isChecked && (
                          <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel — single select, hidden in bulk mode */}
        {selected && !bulkMode && (
          <Card className="w-60 shrink-0 h-fit">
            <CardContent className="p-4 space-y-3">
              <div className="aspect-square rounded-md overflow-hidden bg-muted">
                {selected.file_type.startsWith("video/") ? (
                  <div className="h-full flex items-center justify-center">
                    <Film className="h-10 w-10 text-muted-foreground" />
                  </div>
                ) : (
                  <img
                    src={selected.thumbnail_url ?? selected.storage_url}
                    alt={selected.filename}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="space-y-1.5 text-xs">
                <p className="font-medium text-sm truncate">{selected.filename}</p>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {selected.file_type.startsWith("video/") ? (
                    <Film className="h-3 w-3" />
                  ) : (
                    <ImageIcon className="h-3 w-3" />
                  )}
                  <span>{selected.file_type}</span>
                </div>
                <p className="text-muted-foreground">{formatBytes(selected.file_size_bytes)}</p>
                <p className="text-muted-foreground">{formatDate(selected.uploaded_at)}</p>
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selected.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                        <Tag className="h-2.5 w-2.5 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => deleteMutation.mutate(selected.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Bulk mode summary panel */}
        {bulkMode && checked.size > 0 && (
          <Card className="w-60 shrink-0 h-fit">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">{checked.size} archivo{checked.size !== 1 ? "s" : ""} seleccionado{checked.size !== 1 ? "s" : ""}</p>
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-1.5"
                onClick={bulkDelete}
                disabled={bulkDeleting}
              >
                <Trash2 className="h-4 w-4" />
                {bulkDeleting ? "Eliminando..." : "Eliminar seleccionados"}
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setChecked(new Set())}>
                Limpiar selección
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
