import { decrypt } from "../utils/crypto";
import { SocialAccount, MediaAsset } from "@prisma/client";

interface PublishResult {
  platform_post_id: string;
  api_response: unknown;
}

async function getMemberUrn(token: string, storedAccountId: string): Promise<string> {
  if (storedAccountId.startsWith("urn:li:organization:")) {
    throw new Error(
      "Publicar en páginas de empresa de LinkedIn requiere el permiso w_organization_social, " +
      "pendiente de aprobación por LinkedIn. Usa tu cuenta personal de LinkedIn."
    );
  }
  if (storedAccountId.startsWith("urn:li:")) return storedAccountId;
  // Try /v2/me to get the native LinkedIn member ID (OIDC sub may differ)
  try {
    const res = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" },
    });
    if (res.ok) {
      const data = (await res.json()) as { id?: string };
      if (data.id) return `urn:li:person:${data.id}`;
    }
  } catch {}
  return `urn:li:person:${storedAccountId}`;
}

// LinkedIn requires images to be uploaded via its Assets API before posting.
// Returns the digitalmediaAsset URN to include in the post.
async function uploadImageAsset(token: string, authorUrn: string, imageUrl: string, mimeType: string): Promise<string> {
  // Step 1: Register upload
  const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: authorUrn,
        serviceRelationships: [
          { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
        ],
      },
    }),
  });

  if (!registerRes.ok) {
    const err = (await registerRes.json()) as { message?: string };
    throw new Error(`LinkedIn registerUpload failed: ${err.message ?? registerRes.status}`);
  }

  type RegisterResponse = {
    value: {
      asset: string;
      uploadMechanism: {
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: { uploadUrl: string };
      };
    };
  };
  const reg = (await registerRes.json()) as RegisterResponse;
  const assetUrn = reg.value.asset;
  const uploadUrl =
    reg.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;

  if (!uploadUrl) throw new Error("LinkedIn upload URL not returned by registerUpload");

  // Step 2: Fetch image binary from Cloudinary
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Could not fetch image from storage: ${imageUrl}`);
  const imgBuffer = await imgRes.arrayBuffer();

  // Step 3: Upload binary to LinkedIn
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType.startsWith("image/") ? mimeType : "image/jpeg",
    },
    body: imgBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`LinkedIn image binary upload failed: ${uploadRes.status}`);
  }

  return assetUrn;
}

export async function publishToLinkedIn(
  account: SocialAccount,
  caption: string,
  mediaAssets: MediaAsset[]
): Promise<PublishResult> {
  const token = decrypt(account.access_token_enc);
  const authorUrn = await getMemberUrn(token, account.account_id);

  // Upload images to LinkedIn's CDN first (direct URLs are not accepted)
  let mediaItems: { status: string; media: string; title: { text: string } }[] = [];
  for (const asset of mediaAssets) {
    const assetUrn = await uploadImageAsset(token, authorUrn, asset.storage_url, asset.file_type);
    mediaItems.push({ status: "READY", media: assetUrn, title: { text: asset.filename } });
  }

  const body: Record<string, unknown> = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: caption },
        shareMediaCategory: mediaItems.length ? "IMAGE" : "NONE",
        ...(mediaItems.length ? { media: mediaItems } : {}),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message ?? `LinkedIn API error ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  const postId = res.headers.get("x-restli-id") ?? data.id ?? "unknown";

  return { platform_post_id: postId, api_response: data };
}
