import { mediaApi } from "@/api/media";
import { postsApi } from "@/api/posts";
import { socialApi, SocialPlatform } from "@/api/social";
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
  ];
  const validFound = allNetworks.some((n) => {
    const lower = n.toLowerCase();
    return lower.includes("instagram") || lower.includes("facebook") || lower.includes("linkedin");
  });
  if (!validFound) {
    errors.push("Debe tener al menos una red social válida (Facebook, Instagram, LinkedIn)");
  }

  if (!raw.imagen?.trim()) {
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
  tipo_publicacion?: string
): { networks: ImportNetwork[]; instagramType: "feed" | "story" | "carousel" } {
  const allSources = [...redes, ...(red_social ? [red_social] : [])];
  const networks = Array.from(
    new Set(
      allSources
        .map((n) => {
          if (n === "LinkedIn") return "LinkedIn";
          if (n === "Facebook") return "Facebook";
          if (n === "Instagram" || n === "Instagram Post") return "Instagram";
          if (n === "Instagram Story/Reel") return "Instagram";
          return null;
        })
        .filter((n): n is ImportNetwork => n !== null)
    )
  );

  let instagramType: "feed" | "story" | "carousel" = "feed";

  const isStory = allSources.some((n) => n === "Instagram Story/Reel");
  if (isStory) instagramType = "story";

  if (tipo_publicacion?.toLowerCase().includes("carrusel")) {
    instagramType = "carousel";
  }

  return { networks, instagramType };
}

// ---------------------------------------------------------------------------
// mapPlatforms
// ---------------------------------------------------------------------------
export function mapPlatforms(
  networks: ImportNetwork[],
  instagramType: string
): { platforms: SocialPlatform[]; instagramType: string } {
  const platforms: SocialPlatform[] = networks.map((n) => {
    switch (n) {
      case "LinkedIn":
        return "linkedin";
      case "Facebook":
        return "facebook";
      case "Instagram":
        return "instagram";
    }
  });
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
    raw.tipo_publicacion
  );

  return {
    raw,
    title: raw.titulo_interno ?? "",
    caption,
    scheduledAt,
    networks,
    instagramType,
    imagePath: raw.imagen ?? "",
    imageFile: undefined,
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
    if (!pub.imagePath) return pub;

    const basename = pub.imagePath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
    const match = files.find((f) => f.name.toLowerCase() === basename);
    if (!match) return pub;

    return { ...pub, imageFile: match };
  });
}

// ---------------------------------------------------------------------------
// importPublication
// ---------------------------------------------------------------------------
export async function importPublication(
  pub: ImportedPublication,
  mode: ImportMode
): Promise<{ success: boolean; error?: string }> {
  try {
    let imageMediaId: string | undefined;
    let imageStorageUrl: string | undefined;

    if (pub.imageFile) {
      const res = await mediaApi.upload(pub.imageFile);
      imageMediaId = res.data.id;
      imageStorageUrl = res.data.storage_url;
    }

    const postRes = await postsApi.create({
      title: pub.title,
      base_caption: pub.caption,
      status: mode === "draft" ? "draft" : "scheduled",
      scheduled_at: mode === "scheduled" ? new Date(pub.scheduledAt).toISOString() : null,
      variants: [],
      media_ids: imageMediaId ? [imageMediaId] : [],
    });

    if (mode === "scheduled") {
      const { platforms, instagramType } = mapPlatforms(pub.networks, pub.instagramType);
      await socialApi.schedule({
        content: pub.caption,
        platforms,
        instagramType: instagramType as "feed" | "story" | "carousel",
        mediaUrls: imageStorageUrl ? [imageStorageUrl] : [],
        scheduledAt: new Date(pub.scheduledAt).toISOString(),
      });
    }

    void postRes; // used above
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al importar";
    return { success: false, error: message };
  }
}
