import { decrypt } from "../utils/crypto";
import { SocialAccount, MediaAsset } from "@prisma/client";

interface PublishResult {
  platform_post_id: string;
  api_response: unknown;
}

async function waitForContainer(pageId: string, containerId: string, token: string, maxWaitMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${token}`
    );
    const data = (await res.json()) as { status_code?: string; status?: string };
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") throw new Error(`Instagram container error: ${data.status}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Instagram container timed out waiting for FINISHED status");
}

export async function publishToInstagram(
  account: SocialAccount,
  caption: string,
  mediaAssets: MediaAsset[]
): Promise<PublishResult> {
  const token = decrypt(account.access_token_enc);
  const pageId = account.account_id;

  // Instagram requires at least one image/video via Graph API
  if (!mediaAssets.length) throw new Error("Instagram requires at least one media asset");

  let containerId: string;

  if (mediaAssets.length === 1) {
    const asset = mediaAssets[0];
    const isVideo = asset.file_type.startsWith("video/");
    const body: Record<string, string> = {
      [isVideo ? "video_url" : "image_url"]: asset.storage_url,
      caption,
      access_token: token,
    };
    if (isVideo) body.media_type = "REELS";

    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { id?: string; error?: { message: string } };
    if (!data.id) throw new Error(data.error?.message ?? "Failed to create Instagram media container");
    containerId = data.id;
  } else {
    // Carousel
    const childIds: string[] = [];
    for (const asset of mediaAssets) {
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: asset.storage_url,
          is_carousel_item: true,
          access_token: token,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: { message: string } };
      if (!data.id) throw new Error(data.error?.message ?? "Failed to create carousel item");
      childIds.push(data.id);
    }

    const carouselRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/media`, {
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
  }

  // Wait for container to be FINISHED before publishing
  await waitForContainer(pageId, containerId, token);

  // Publish container
  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  const publishData = (await publishRes.json()) as { id?: string; error?: { message: string } };
  if (!publishData.id) throw new Error(publishData.error?.message ?? "Failed to publish Instagram post");

  return { platform_post_id: publishData.id, api_response: publishData };
}
