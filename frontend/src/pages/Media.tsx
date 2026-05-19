import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Upload, Trash2, Film, ImageIcon, Tag } from "lucide-react";
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
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [selected, setSelected] = useState<MediaAsset | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["media", { type: filter === "all" ? undefined : filter }],
    queryFn: () =>
      mediaApi
        .list({ type: filter === "all" ? undefined : filter, limit: 60 })
        .then((r) => r.data),
  });

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
    (files: File[]) => {
      files.forEach((file) => uploadMutation.mutate(file));
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [], "video/*": [] },
    multiple: true,
  });

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
        {uploadMutation.isPending && (
          <div className="mt-3 text-xs text-primary">Subiendo...</div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
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
        <span className="ml-auto text-sm text-muted-foreground self-center">
          {data?.total ?? 0} archivos
        </span>
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
          ) : !data?.data.length ? (
            <div className="text-center py-20 text-muted-foreground text-sm">
              Sin archivos. Sube tu primer media.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {data.data.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelected(asset)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selected?.id === asset.id
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
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
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
      </div>
    </div>
  );
}
