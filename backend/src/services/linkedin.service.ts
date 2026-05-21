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

export async function publishToLinkedIn(
  account: SocialAccount,
  caption: string,
  mediaAssets: MediaAsset[]
): Promise<PublishResult> {
  const token = decrypt(account.access_token_enc);
  const authorUrn = await getMemberUrn(token, account.account_id);

  const body: Record<string, unknown> = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: caption },
        shareMediaCategory: mediaAssets.length ? "IMAGE" : "NONE",
        ...(mediaAssets.length
          ? {
              media: mediaAssets.map((asset) => ({
                status: "READY",
                originalUrl: asset.storage_url,
                title: { text: asset.filename },
              })),
            }
          : {}),
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
