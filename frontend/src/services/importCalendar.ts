import { mediaApi } from "@/api/media";
import { postsApi } from "@/api/posts";
import { SocialAccount, Platform } from "@/types";
import {
  RawPublication,
  ValidationResult,
  ImportedPublication,
  ImportMode,
  ImportNetwork,
} from "@/types/import";

// ---------------------------------------------------------------------------
// parsePublicationsJson
// ---------------------------------------------------------------------------
export async function parsePublicationsJson(file: File): Promise<RawPublication[]> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) {
    return parsed as RawPublication[];
  }
  // Support single-object JSON
  return [parsed as RawPublication];
}

// ---------------------------------------------------------------------------
// validatePublication
// ---------------------------------------------------------------------------
export function validatePublication(raw: RawPublication): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw.titulo_interno?.trim()) {
    errors.push("titulo_interno es requerido");
  }

  const hasCaption = raw.caption_con_hashtags?.trim() || raw.caption?.trim();
  if (!hasCaption) {
    errors.push("caption o caption_con_hashtags es requerido");
  }

  if (!raw.fecha_hora_publicacion || isNaN(new Date(raw.fecha_hora_publicacion).getTime())) {
    errors.push("fecha_hora_publicacion no es una fecha válida");
  } else if (new Date(raw.fecha_hora_publicacion) < new Date()) {
    warnings.push("La fecha de publicación está en el pasado");
  }

  const allNetworks = [
    ...(raw.redes ?? []),
    ...(raw.red_social ? [raw.red_social] : []),
    ...(raw.canal_a_publicar ? [raw.canal_a_publicar] : []),
    // canal implícito en tipo_publicacion (ej. "LinkedIn Post", "Instagram Reel")
    ...(raw.tipo_publicacion ? [raw.tipo_publicacion] : []),
  ];
  const validFound = allNetworks.some((n) => {
    const lower = n.toLowerCase();
    return lower.includes("instagram") || lower.includes("facebook") || lower.includes("linkedin") || lower.includes("whatsapp");
  });
  if (!validFound) {
    errors.push("Debe tener al menos una red social válida (Facebook, Instagram, LinkedIn, WhatsApp)");
  }

  const hasImages = (raw.imagenes && raw.imagenes.length > 0) || raw.imagen?.trim();
  if (!hasImages) {
    warnings.push("No se especificó imagen");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// mapNetworks
// ---------------------------------------------------------------------------
export function mapNetworks(
  redes: string[],
  red_social?: string,
  tipo_publicacion?: string,
  canal_a_publicar?: string,
): { networks: ImportNetwork[]; instagramType: "feed" | "story" | "carousel" | "reel" } {
  // Unificar todas las fuentes posibles de red social
  const allSources = [
    ...redes,
    ...(red_social       ? [red_social]       : []),
    ...(canal_a_publicar ? [canal_a_publicar] : []),
    ...(tipo_publicacion ? [tipo_publicacion] : []),
  ];

  const networks = Array.from(
    new Set(
      allSources
        .map((n) => {
          const lower = n.toLowerCase();
          if (lower.includes("linkedin"))  return "LinkedIn";
          if (lower.includes("facebook"))  return "Facebook";
          if (lower.includes("instagram")) return "Instagram";
          if (lower.includes("whatsapp"))  return "WhatsApp";
          return null;
        })
        .filter((n): n is ImportNetwork => n !== null)
    )
  );

  // Determinar tipo de publicación de Instagram según tipo_publicacion
  let instagramType: "feed" | "story" | "carousel" | "reel" = "feed";
  const tp = tipo_publicacion?.toLowerCase() ?? "";

  if (tp.includes("carrusel") || tp.includes("carousel")) {
    instagramType = "carousel";
  } else if (tp.includes("story") || tp.includes("historia")) {
    instagramType = "story";
  } else if (tp.includes("reel")) {
    instagramType = "reel";
  }

  // Fallback para formato legado "Instagram Story/Reel"
  const hasLegacyStoryReel = allSources.some((n) => n === "Instagram Story/Reel");
  if (hasLegacyStoryReel && instagramType === "feed") instagramType = "story";

  return { networks, instagramType };
}

// ---------------------------------------------------------------------------
// mapPlatforms
// ---------------------------------------------------------------------------
export function mapPlatforms(
  networks: ImportNetwork[],
  instagramType: string
): { platforms: Platform[]; instagramType: string } {
  const platforms: Platform[] = networks.map((n) => {
    switch (n) {
      case "LinkedIn":
        return "linkedin";
      case "Facebook":
        return "facebook";
      case "Instagram":
        return "instagram";
      case "WhatsApp":
        return undefined;
    }
  }).filter((p): p is Platform => p !== undefined);
  return { platforms, instagramType };
}

// ---------------------------------------------------------------------------
// normalizePublication
// ---------------------------------------------------------------------------
export function normalizePublication(raw: RawPublication): ImportedPublication {
  const validation = validatePublication(raw);

  // datetime-local expects "YYYY-MM-DDTHH:mm"
  const scheduledAt = raw.fecha_hora_publicacion?.slice(0, 16) ?? "";

  const caption =
    raw.caption_con_hashtags?.trim() ||
    [raw.caption, raw.hashtags].filter(Boolean).join("\n\n");

  const { networks, instagramType } = mapNetworks(
    raw.redes ?? [],
    raw.red_social,
    raw.tipo_publicacion,
    raw.canal_a_publicar,
  );

  // Collect all image paths: prefer the explicit array, fall back to the single field
  const imagePaths: string[] = raw.imagenes?.filter(Boolean) ?? (raw.imagen?.trim() ? [raw.imagen.trim()] : []);

  return {
    raw,
    title: raw.titulo_interno ?? "",
    caption,
    scheduledAt,
    networks,
    instagramType,
    imagePath: imagePaths[0] ?? "",
    imagePaths,
    imageFile: undefined,
    imageFiles: [],
    imageUrl: undefined,
    validation,
    importStatus: "pending",
    importError: undefined,
    isDuplicate: false,
    selected: validation.valid,
  };
}

// ---------------------------------------------------------------------------
// resolveImageFiles
// ---------------------------------------------------------------------------
export function resolveImageFiles(
  publications: ImportedPublication[],
  files: File[]
): ImportedPublication[] {
  return publications.map((pub) => {
    if (pub.imagePaths.length === 0) return pub;

    const resolvedFiles: File[] = pub.imagePaths
      .map((p) => {
        const basename = p.split(/[\\/]/).pop()?.toLowerCase() ?? "";
        return files.find((f) => f.name.toLowerCase() === basename) ?? null;
      })
      .filter((f): f is File => f !== null);

    if (resolvedFiles.length === 0) return pub;

    return { ...pub, imageFiles: resolvedFiles, imageFile: resolvedFiles[0] };
  });
}

// ---------------------------------------------------------------------------
// fetchImageAsFile
// Fetch a remote image URL and return a File object, or null on failure.
// ---------------------------------------------------------------------------
async function fetchImageAsFile(url: string): Promise<File | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    // Extract a clean filename from the URL (strip query params and decode)
    const raw = url.split("?")[0].split("/").pop() ?? "image.jpg";
    const filename = decodeURIComponent(raw) || "image.jpg";
    const mimeType = blob.type || "image/jpeg";
    return new File([blob], filename, { type: mimeType });
  } catch {
    return null; // CORS or network issue
  }
}

// ---------------------------------------------------------------------------
// importPublication
// ---------------------------------------------------------------------------
export async function importPublication(
  pub: ImportedPublication,
  mode: ImportMode,
  activeAccounts: SocialAccount[] = []
): Promise<{ success: boolean; error?: string }> {
  try {
    const mediaIds: string[] = [];

    // Determine which files to upload.
    // Priority: user-selected files → URL paths in JSON → nothing
    let filesToUpload: File[] = pub.imageFiles;

    if (filesToUpload.length === 0 && pub.imagePaths.length > 0) {
      // Try to fetch any HTTP/HTTPS image paths directly
      const fetched: File[] = [];
      for (const path of pub.imagePaths) {
        if (/^https?:\/\//i.test(path)) {
          const file = await fetchImageAsFile(path);
          if (file) fetched.push(file);
        }
      }
      if (fetched.length > 0) filesToUpload = fetched;
    }

    // Upload all image files (carousel support)
    for (const file of filesToUpload) {
      console.log(`[import] uploading media: ${file.name}`);
      try {
        const res = await mediaApi.upload(file);
        mediaIds.push(res.data.id);
      } catch (uploadErr) {
        const axErr = uploadErr as { response?: { data?: { error?: string; detail?: string } }; message?: string };
        const detail = axErr?.response?.data?.detail ?? axErr?.response?.data?.error ?? (uploadErr instanceof Error ? uploadErr.message : String(uploadErr));
        throw new Error(`Media upload failed (${file.name}): ${detail}`);
      }
    }

    // If the scheduled date is in the past, fall back to draft
    // regardless of the chosen mode to avoid a 400 from the backend.
    const scheduledDate = pub.scheduledAt ? new Date(pub.scheduledAt) : null;
    const isFuture = scheduledDate && scheduledDate > new Date();
    const effectiveMode: ImportMode = mode === "scheduled" && !isFuture ? "draft" : mode;

    // Prefixar el título con el tipo de publicación para que el calendario
    // pueda mostrar "Red Social · Tipo" aunque el post no tenga variants.
    const tipoLabel =
      pub.raw.tipo_publicacion ??
      (pub.networks.length > 0 ? pub.networks.join(" / ") : null);
    const titleForCalendar = tipoLabel ? `${tipoLabel} · ${pub.title}` : pub.title;

    // Build variants for auto-platforms (facebook, instagram).
    // LinkedIn is intentionally excluded — those posts remain as manual pending.
    const variants: { social_account_id: string; platform: "instagram" | "facebook" | "linkedin"; caption: string }[] = [];
    if (effectiveMode === "scheduled") {
      const { platforms } = mapPlatforms(pub.networks, pub.instagramType);
      for (const platform of platforms) {
        if (platform === "linkedin") continue;
        const account = activeAccounts.find((a) => a.platform === platform && a.is_active);
        if (account) {
          variants.push({ social_account_id: account.id, platform, caption: pub.caption });
        }
      }
    }

    console.log(`[import] creating post: ${pub.raw.id} | mode=${effectiveMode} | variants=${variants.length} | media=${mediaIds.length}`);
    try {
      await postsApi.create({
        title: titleForCalendar,
        base_caption: pub.caption,
        status: effectiveMode === "draft" ? "draft" : "scheduled",
        scheduled_at: scheduledDate ? scheduledDate.toISOString() : null,
        variants,
        media_ids: mediaIds,
      });
    } catch (createErr) {
      const axErr = createErr as { response?: { data?: { error?: string; detail?: string } }; message?: string };
      const detail = axErr?.response?.data?.detail ?? axErr?.response?.data?.error ?? (createErr instanceof Error ? createErr.message : String(createErr));
      throw new Error(`Post creation failed: ${detail}`);
    }

    return { success: true };
  } catch (err: unknown) {
    const axiosError = err as { response?: { data?: { error?: string; detail?: string } }; message?: string };
    const message =
      axiosError?.response?.data?.detail ??
      axiosError?.response?.data?.error ??
      (err instanceof Error ? err.message : "Error desconocido al importar");
    return { success: false, error: message };
  }
}
