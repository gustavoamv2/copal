import { decrypt } from "../utils/crypto";
import { SocialAccount, MediaAsset } from "@prisma/client";

export type FacebookPostType = "post" | "reel" | "story";

const GRAPH_API_VERSION = "v22.0";

interface PublishResult {
  platform_post_id: string;
  api_response: unknown;
}

// ── Facebook Stories ──────────────────────────────────────────────────────────

async function publishPhotoStory(token: string, pageId: string, imageUrl: string): Promise<string> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/photo_stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: imageUrl, access_token: token }),
  });
  const data = (await res.json()) as { post_id?: string; id?: string; success?: boolean; error?: { message: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Facebook Story (foto) falló: ${res.status}`);
  }
  return data.post_id ?? data.id ?? "story-ok";
}

async function publishVideoStory(token: string, pageId: string, videoUrl: string): Promise<string> {
  // Step 1: Initialize upload session
  const initRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/video_stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_phase: "start", access_token: token }),
  });
  if (!initRes.ok) {
    const err = (await initRes.json()) as { error?: { message: string } };
    throw new Error(`Facebook Story video init: ${err.error?.message ?? initRes.status}`);
  }
  const initData = (await initRes.json()) as { upload_url?: string; video_id?: string };
  if (!initData.upload_url || !initData.video_id) {
    throw new Error("Facebook Story: upload_url o video_id no devueltos");
  }

  // Step 2: Download video binary from Cloudinary
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`No se pudo descargar el video: ${videoUrl}`);
  const videoBuffer = await videoRes.arrayBuffer();

  // Step 3: Upload binary
  const uploadRes = await fetch(initData.upload_url, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      offset: "0",
      file_size: String(videoBuffer.byteLength),
    },
    body: videoBuffer,
  });
  if (!uploadRes.ok) throw new Error(`Facebook Story video upload: ${uploadRes.status}`);

  // Step 4: Publish story
  const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/video_stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "finish",
      video_id: initData.video_id,
      video_state: "PUBLISHED",
      access_token: token,
    }),
  });
  if (!publishRes.ok) {
    const err = (await publishRes.json()) as { error?: { message: string } };
    throw new Error(`Facebook Story video publish: ${err.error?.message ?? publishRes.status}`);
  }
  return initData.video_id;
}

// ── Facebook Reels ────────────────────────────────────────────────────────────

async function uploadReel(token: string, pageId: string, caption: string, videoUrl: string): Promise<string> {
  // Step 1: Initialize upload session
  const initRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_phase: "start", access_token: token }),
  });
  if (!initRes.ok) {
    const err = (await initRes.json()) as { error?: { message: string } };
    throw new Error(`Facebook Reels init failed: ${err.error?.message ?? initRes.status}`);
  }
  const initData = (await initRes.json()) as { upload_url?: string; video_id?: string };
  if (!initData.upload_url || !initData.video_id) {
    throw new Error("Facebook Reels: upload_url o video_id no devueltos");
  }

  // Step 2: Download video binary from Cloudinary
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`No se pudo descargar el video: ${videoUrl}`);
  const videoBuffer = await videoRes.arrayBuffer();

  // Step 3: Upload binary to Facebook's resumable upload URL
  const uploadRes = await fetch(initData.upload_url, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      offset: "0",
      file_size: String(videoBuffer.byteLength),
    },
    body: videoBuffer,
  });
  if (!uploadRes.ok) {
    throw new Error(`Facebook Reels binary upload failed: ${uploadRes.status}`);
  }

  // Step 4: Publish
  const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "finish",
      video_id: initData.video_id,
      video_state: "PUBLISHED",
      description: caption,
      title: "",
      access_token: token,
    }),
  });
  if (!publishRes.ok) {
    const err = (await publishRes.json()) as { error?: { message: string } };
    throw new Error(`Facebook Reels publish failed: ${err.error?.message ?? publishRes.status}`);
  }

  return initData.video_id;
}

export async function publishToFacebook(
  account: SocialAccount,
  caption: string,
  mediaAssets: MediaAsset[],
  facebookType: FacebookPostType = "post"
): Promise<PublishResult> {
  const token = decrypt(account.access_token_enc);
  const pageId = account.account_id;

  // ── Story path ───────────────────────────────────────────────────────────────
  if (facebookType === "story") {
    const asset = mediaAssets[0];
    if (!asset) throw new Error("Se requiere una imagen o video para publicar una Historia en Facebook");
    const isVideo = asset.file_type.startsWith("video/");
    if (isVideo) {
      const videoId = await publishVideoStory(token, pageId, asset.storage_url);
      return { platform_post_id: videoId, api_response: { video_id: videoId } };
    } else {
      const storyId = await publishPhotoStory(token, pageId, asset.storage_url);
      return { platform_post_id: storyId, api_response: { story_id: storyId } };
    }
  }

  // ── Reel path ─────────────────────────────────────────────────────────────
  if (facebookType === "reel") {
    const videoAsset = mediaAssets[0];
    if (!videoAsset) throw new Error("Se requiere un video para publicar un Reel en Facebook");
    const videoId = await uploadReel(token, pageId, caption, videoAsset.storage_url);
    return { platform_post_id: videoId, api_response: { video_id: videoId } };
  }

  let data: { id?: string; error?: { message: string } };

  if (mediaAssets.length === 0) {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: caption, access_token: token }),
    });
    data = (await res.json()) as typeof data;
  } else if (mediaAssets.length === 1) {
    const asset = mediaAssets[0];
    const isVideo = asset.file_type.startsWith("video/");

    if (isVideo) {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: asset.storage_url, description: caption, access_token: token }),
      });
      data = (await res.json()) as typeof data;
    } else {
      const photoRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: asset.storage_url, caption, no_story: false, access_token: token }),
      });
      const photoData = (await photoRes.json()) as { id?: string; post_id?: string; error?: { message: string } };
      console.log("[Facebook] /photos response:", JSON.stringify(photoData));
      if (!photoData.id) throw new Error(photoData.error?.message ?? "Failed to upload photo to Facebook");
      data = { id: photoData.post_id ?? photoData.id };
    }
  } else {
    const photoIds: string[] = [];
    for (const asset of mediaAssets) {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: asset.storage_url, published: false, access_token: token }),
      });
      const photoData = (await res.json()) as { id?: string; error?: { message: string } };
      if (!photoData.id) throw new Error(photoData.error?.message ?? "Failed to upload photo");
      photoIds.push(photoData.id);
    }

    const attachedMedia = photoIds.map((id) => ({ media_fbid: id }));
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: caption, attached_media: attachedMedia, access_token: token }),
    });
    data = (await res.json()) as typeof data;
  }

  if (!data.id) throw new Error(data.error?.message ?? "Failed to publish Facebook post");
  return { platform_post_id: data.id, api_response: data };
}
