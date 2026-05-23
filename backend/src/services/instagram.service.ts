import { decrypt } from "../utils/crypto";
import { SocialAccount, MediaAsset } from "@prisma/client";

interface PublishResult {
  platform_post_id: string;
  api_response: unknown;
}

const GRAPH_API_VERSION = "v22.0";

// Insert Cloudinary transformation params after /upload/ so Meta receives
// a correctly-sized image. Only applies to Cloudinary URLs; other URLs are returned as-is.
function cdnTransform(url: string, transform: string): string {
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace(/(\/upload\/)/, `$1${transform}/`);
}


// isVideo: images are ready instantly; videos/reels need polling
async function waitForContainer(pageId: string, containerId: string, token: string, isVideo = false, maxWaitMs = 90000): Promise<void> {
  // Images don't need polling — they're FINISHED immediately after creation
  if (!isVideo) {
    await new Promise((r) => setTimeout(r, 1500));
    return;
  }

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    // Only request status_code — the "status" field causes authorization errors in v22.0
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${containerId}?fields=status_code&access_token=${token}`
    );
    const data = (await res.json()) as {
      status_code?: string;
      error?: { message: string; type?: string; code?: number; error_subcode?: number };
    };

    console.log(`[Instagram] container ${containerId} poll:`, JSON.stringify(data));

    if (data.error) {
      const code = data.error.code ?? "?";
      const msg  = data.error.message;
      if (code === 190 || msg.toLowerCase().includes("authenticate")) {
        throw new Error(`Token de Instagram expirado o inválido (${code}). Reconecta tu cuenta de Instagram en Ajustes.`);
      }
      throw new Error(`Instagram API error (${code}): ${msg}`);
    }
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error("Instagram rechazó el contenido del video. Verifica formato y dimensiones.");
    }
    if (data.status_code === "EXPIRED") throw new Error("Instagram container expiró antes de publicar. Intenta de nuevo.");
    if (data.status_code === "PUBLISHED") return;

    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Instagram tardó demasiado en procesar el video (>90s). Intenta con un archivo más pequeño.");
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
    const asset = mediaAssets[0];
    const isVideo = asset.file_type.startsWith("video/");
    // Stories: 9:16 portrait (1080x1920). Apply transform for images.
    const mediaUrl = isVideo ? asset.storage_url : cdnTransform(asset.storage_url, "w_1080,h_1920,c_fill,f_jpg");
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [isVideo ? "video_url" : "image_url"]: mediaUrl,
        media_type: "STORIES",
        access_token: token,
      }),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string; code?: number; type?: string } };
    console.log(`[Instagram] story container response:`, JSON.stringify(data));
    if (data.error) throw new Error(`Instagram (${data.error.code ?? "?"}): ${data.error.message}`);
    if (!data.id) throw new Error("Failed to create Instagram story container");
    containerId = data.id;

  } else if (instagramType === "carousel" || mediaAssets.length > 1) {
    const childIds: string[] = [];
    for (const asset of mediaAssets) {
      const isVideo = asset.file_type.startsWith("video/");
      // Carousel items: square 1080x1080
      const mediaUrl = isVideo ? asset.storage_url : cdnTransform(asset.storage_url, "w_1080,h_1080,c_fill,f_jpg");
      const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [isVideo ? "video_url" : "image_url"]: mediaUrl,
          is_carousel_item: true,
          access_token: token,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: { message: string; code?: number; type?: string } };
      console.log(`[Instagram] carousel item response:`, JSON.stringify(data));
      if (data.error) throw new Error(`Instagram (${data.error.code ?? "?"}): ${data.error.message}`);
      if (!data.id) throw new Error("Failed to create carousel item");
      if (isVideo) await waitForContainer(pageId, data.id, token, true);
      childIds.push(data.id);
    }

    const carouselRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_type: "CAROUSEL", children: childIds, caption, access_token: token }),
    });
    const carouselData = (await carouselRes.json()) as { id?: string; error?: { message: string; code?: number; type?: string } };
    console.log(`[Instagram] carousel container response:`, JSON.stringify(carouselData));
    if (carouselData.error) throw new Error(`Instagram (${carouselData.error.code ?? "?"}): ${carouselData.error.message}`);
    if (!carouselData.id) throw new Error("Failed to create carousel");
    containerId = carouselData.id;

  } else if (instagramType === "reel") {
    const asset = mediaAssets[0];
    if (!asset.file_type.startsWith("video/")) throw new Error("Instagram Reels requiere un video");
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_url: asset.storage_url, media_type: "REELS", caption, access_token: token }),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string; code?: number; type?: string } };
    console.log(`[Instagram] reel container response:`, JSON.stringify(data));
    if (data.error) throw new Error(`Instagram (${data.error.code ?? "?"}): ${data.error.message}`);
    if (!data.id) throw new Error("Failed to create Instagram Reel container");
    containerId = data.id;

  } else {
    // Feed: imagen única, máx 1440px ancho, aspect ratio entre 4:5 y 1.91:1
    const asset = mediaAssets[0];
    const isVideo = asset.file_type.startsWith("video/");
    const mediaUrl = isVideo ? asset.storage_url : cdnTransform(asset.storage_url, "w_1080,c_limit,f_jpg");
    // Instagram deprecated regular feed videos — videos are published as Reels.
    // For image feed posts, no media_type is needed (defaults to IMAGE).
    const body: Record<string, string> = {
      [isVideo ? "video_url" : "image_url"]: mediaUrl,
      caption,
      access_token: token,
      ...(isVideo ? { media_type: "REELS" } : {}),
    };

    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string; code?: number; type?: string } };
    console.log(`[Instagram] feed container response:`, JSON.stringify(data));
    if (data.error) throw new Error(`Instagram (${data.error.code ?? "?"}): ${data.error.message}`);
    if (!data.id) throw new Error("Failed to create Instagram media container");
    containerId = data.id;
  }

  // Videos need polling; images are ready immediately
  const mainAsset = mediaAssets[0];
  const mainIsVideo = mainAsset.file_type.startsWith("video/");
  await waitForContainer(pageId, containerId, token, mainIsVideo);

  // Publish container
  const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  const publishData = (await publishRes.json()) as { id?: string; error?: { message: string; code?: number; type?: string } };
  console.log(`[Instagram] media_publish response:`, JSON.stringify(publishData));
  if (!publishData.id) throw new Error(publishData.error?.message ?? "Failed to publish Instagram post");

  return { platform_post_id: publishData.id, api_response: publishData };
}
