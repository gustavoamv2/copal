import { decrypt } from "../utils/crypto";
import { SocialAccount, MediaAsset } from "@prisma/client";

interface PublishResult {
  platform_post_id: string;
  api_response: unknown;
}

export async function publishToLinkedIn(
  account: SocialAccount,
  caption: string,
  mediaAssets: MediaAsset[]
): Promise<PublishResult> {
  const token = decrypt(account.access_token_enc);
  const authorUrn = account.account_id.startsWith("urn:li:")
    ? account.account_id
    : `urn:li:person:${account.account_id}`;

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
