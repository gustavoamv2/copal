import { decrypt } from "../utils/crypto";
import { SocialAccount, MediaAsset } from "@prisma/client";

interface PublishResult {
  platform_post_id: string;
  api_response: unknown;
}

export async function publishToFacebook(
  account: SocialAccount,
  caption: string,
  mediaAssets: MediaAsset[]
): Promise<PublishResult> {
  const token = decrypt(account.access_token_enc);
  const pageId = account.account_id;

  let data: { id?: string; error?: { message: string } };

  if (mediaAssets.length === 0) {
    // Text-only post
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: caption, access_token: token }),
    });
    data = (await res.json()) as typeof data;
  } else if (mediaAssets.length === 1) {
    const asset = mediaAssets[0];
    const isVideo = asset.file_type.startsWith("video/");

    if (isVideo) {
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: asset.storage_url, description: caption, access_token: token }),
      });
      data = (await res.json()) as typeof data;
    } else {
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: asset.storage_url, caption, access_token: token }),
      });
      data = (await res.json()) as typeof data;
    }
  } else {
    // Multi-photo post — upload each then attach
    const photoIds: string[] = [];
    for (const asset of mediaAssets) {
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: asset.storage_url, published: false, access_token: token }),
      });
      const photoData = (await res.json()) as { id?: string; error?: { message: string } };
      if (!photoData.id) throw new Error(photoData.error?.message ?? "Failed to upload photo");
      photoIds.push(photoData.id);
    }

    const attachedMedia = photoIds.map((id) => ({ media_fbid: id }));
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: caption, attached_media: attachedMedia, access_token: token }),
    });
    data = (await res.json()) as typeof data;
  }

  if (!data.id) throw new Error(data.error?.message ?? "Failed to publish Facebook post");
  return { platform_post_id: data.id, api_response: data };
}
