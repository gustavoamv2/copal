import { decrypt } from "../utils/crypto";
import { SocialAccount, MediaAsset } from "@prisma/client";

interface PublishResult {
  platform_post_id: string;
  api_response: unknown;
}

const GRAPH_API_VERSION = "v22.0";

async function waitForContainer(pageId: string, containerId: string, token: string, maxWaitMs = 90000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${containerId}?fields=status_code,status&access_token=${token}`
    );
    const data = (await res.json()) as {
      status_code?: string;
      status?: string;
      error?: { message: string; type?: string; code?: number };
    };

    // Fail fast on any API-level error
    if (data.error) {
      const code = data.error.code ?? "?";
      const msg  = data.error.message;
      // Token expired / invalid
      if (code === 190 || msg.toLowerCase().includes("authenticate")) {
        throw new Error(`Token de Instagram expirado o inválido (${code}). Reconecta tu cuenta de Instagram en Ajustes.`);
      }
      throw new Error(`Instagram API error (${code}): ${msg}`);
    }

    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error(`Instagram rechazó el contenido: ${data.status ?? "error desconocido"}. Verifica formato y dimensiones de la imagen.`);
    }
    if (data.status_code === "EXPIRED") throw new Error("Instagram container expiró antes de publicar. Intenta de nuevo.");
    if (data.status_code === "PUBLISHED") return; // already published (e.g. retry)

    // IN_PROGRESS or any other state → keep waiting
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Instagram tardó demasiado en procesar el contenido (>90s). Intenta con una imagen más pequeña.");
}

export async function publishToInstagram(
  account: SocialAccount,
  caption: string,
  mediaAssets: MediaAsset[],
  instagramType: "feed" | "story" | "carousel" | "reel" = "feed"
): Promise<PublishResult> {
  const token = decrypt(account.access_token_enc);
  const pageId = account.account_id;

  if (!mediaAssets.length) throw new Error("Instagram requires at least one media asset");

  let containerId: string;

  if (instagramType === "story") {
    // Stories: single media, media_type STORIES, sin caption (API no lo soporta)
    const asset = mediaAssets[0];
    const isVideo = asset.file_type.startsWith("video/");
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [isVideo ? "video_url" : "image_url"]: asset.storage_url,
        media_type: "STORIES",
        access_token: token,
      }),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string } };
    if (!data.id) throw new Error(data.error?.message ?? "Failed to create Instagram story container");
    containerId = data.id;

  } else if (instagramType === "carousel" || mediaAssets.length > 1) {
    // Carrusel: crear item por item, esperar videos, luego crear contenedor padre
    const childIds: string[] = [];
    for (const asset of mediaAssets) {
      const isVideo = asset.file_type.startsWith("video/");
      const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [isVideo ? "video_url" : "image_url"]: asset.storage_url,
          is_carousel_item: true,
          access_token: token,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: { message: string } };
      if (!data.id) throw new Error(data.error?.message ?? "Failed to create carousel item");
      // Los videos dentro de carrusel también necesitan esperar FINISHED
      if (isVideo) await waitForContainer(pageId, data.id, token);
      childIds.push(data.id);
    }

    const carouselRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption,
        access_token: token,
      }),
    });
    const carouselData = (await carouselRes.json()) as { id?: string; error?: { message: string } };
    if (!carouselData.id) throw new Error(carouselData.error?.message ?? "Failed to create carousel");
    containerId = carouselData.id;

  } else if (instagramType === "reel") {
    const asset = mediaAssets[0];
    if (!asset.file_type.startsWith("video/")) throw new Error("Instagram Reels requiere un video");
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_url: asset.storage_url,
        media_type: "REELS",
        caption,
        access_token: token,
      }),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string } };
    if (!data.id) throw new Error(data.error?.message ?? "Failed to create Instagram Reel container");
    containerId = data.id;

  } else {
    // Feed: imagen única
    const asset = mediaAssets[0];
    const isVideo = asset.file_type.startsWith("video/");
    const body: Record<string, string> = {
      [isVideo ? "video_url" : "image_url"]: asset.storage_url,
      caption,
      access_token: token,
    };
    if (isVideo) body.media_type = "REELS";

    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string } };
    if (!data.id) throw new Error(data.error?.message ?? "Failed to create Instagram media container");
    containerId = data.id;
  }

  // Wait for container to be FINISHED before publishing
  await waitForContainer(pageId, containerId, token);

  // Publish container
  const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  const publishData = (await publishRes.json()) as { id?: string; error?: { message: string } };
  if (!publishData.id) throw new Error(publishData.error?.message ?? "Failed to publish Instagram post");

  return { platform_post_id: publishData.id, api_response: publishData };
}
