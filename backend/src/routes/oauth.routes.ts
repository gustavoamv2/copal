import { Router, Request } from "express";
import { prisma } from "../prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { verifyAccessToken } from "../utils/jwt";
import { encrypt } from "../utils/crypto";
import { config } from "../config";
import { createError } from "../middleware/error.middleware";

const router = Router();

// Middleware para OAuth connect: acepta Bearer header O query param ?token=
function oauthAuth(req: Request, res: any, next: any) {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    (req.query.token as string);
  if (!token) { res.status(401).json({ error: "No token provided" }); return; }
  try {
    (req as AuthRequest).user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// --- Meta (Facebook + Instagram) ---

router.get("/meta/connect", oauthAuth, (req: AuthRequest, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user!.sub })).toString("base64url");
  const params = new URLSearchParams({
    client_id: config.META_APP_ID,
    redirect_uri: config.META_REDIRECT_URI,
    scope: "public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,business_management,instagram_basic,instagram_content_publish",
    response_type: "code",
    state,
  });
  const redirectUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  console.log("[OAUTH] Full redirect URL:", redirectUrl);
  res.redirect(redirectUrl);
});

router.get("/meta/callback", async (req, res, next) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    if (!code || !state) throw createError("Missing code or state", 400);

    const { userId } = JSON.parse(Buffer.from(state, "base64url").toString());

    // Exchange code for user access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          client_id: config.META_APP_ID,
          client_secret: config.META_APP_SECRET,
          redirect_uri: config.META_REDIRECT_URI,
          code,
        })
    );
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: unknown };
    if (!tokenData.access_token) throw createError("Failed to get Meta token", 502);

    // Exchange short-lived user token for long-lived (~60 days) so page tokens are also long-lived
    const longLivedRes = await fetch(
      "https://graph.facebook.com/v19.0/oauth/access_token?" +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: config.META_APP_ID,
          client_secret: config.META_APP_SECRET,
          fb_exchange_token: tokenData.access_token,
        })
    );
    const longLivedData = (await longLivedRes.json()) as { access_token?: string };
    const userToken = longLivedData.access_token ?? tokenData.access_token;

    // Fetch pages — try direct access first, then Business Manager
    type PageEntry = { id: string; name: string; access_token: string };
    let pages: PageEntry[] = [];

    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${userToken}`
    );
    const pagesData = (await pagesRes.json()) as { data?: PageEntry[] };
    pages = pagesData.data ?? [];

    // Fallback: Business Manager owned pages
    if (pages.length === 0) {
      const bizRes = await fetch(
        `https://graph.facebook.com/v19.0/me/businesses?access_token=${userToken}`
      );
      const bizData = (await bizRes.json()) as { data?: Array<{ id: string }> };
      for (const biz of bizData.data ?? []) {
        const bizPagesRes = await fetch(
          `https://graph.facebook.com/v19.0/${biz.id}/owned_pages?fields=id,name,access_token&access_token=${userToken}`
        );
        const bizPages = (await bizPagesRes.json()) as { data?: PageEntry[] };
        pages = pages.concat(bizPages.data ?? []);
      }
    }

    if (!pages.length) throw createError("No pages found for this Meta account", 400);

    // Save each page and its linked Instagram account
    for (const page of pages) {
      // Save Facebook page
      await prisma.socialAccount.upsert({
        where: { user_id_platform_account_id: { user_id: userId, platform: "facebook", account_id: page.id } },
        update: { account_name: page.name, access_token_enc: encrypt(page.access_token), is_active: true },
        create: { user_id: userId, platform: "facebook", account_name: page.name, account_id: page.id, access_token_enc: encrypt(page.access_token) },
      });

      // Detect linked Instagram Business account
      const igRes = await fetch(
        `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = (await igRes.json()) as { instagram_business_account?: { id: string } };

      if (igData.instagram_business_account?.id) {
        const igId = igData.instagram_business_account.id;
        const igInfoRes = await fetch(
          `https://graph.facebook.com/v19.0/${igId}?fields=id,username&access_token=${page.access_token}`
        );
        const igInfo = (await igInfoRes.json()) as { id?: string; username?: string };

        await prisma.socialAccount.upsert({
          where: { user_id_platform_account_id: { user_id: userId, platform: "instagram", account_id: igId } },
          update: { account_name: igInfo.username ?? igId, access_token_enc: encrypt(page.access_token), is_active: true },
          create: { user_id: userId, platform: "instagram", account_name: igInfo.username ?? igId, account_id: igId, access_token_enc: encrypt(page.access_token) },
        });
      }
    }

    res.redirect(`${config.FRONTEND_URL}/accounts?connected=meta`);
  } catch (err) {
    next(err);
  }
});

// --- LinkedIn ---

router.get("/linkedin/connect", oauthAuth, (req: AuthRequest, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user!.sub })).toString("base64url");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.LINKEDIN_CLIENT_ID,
    redirect_uri: config.LINKEDIN_REDIRECT_URI,
    scope: "openid profile w_member_social",
    state,
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

router.get("/linkedin/callback", async (req, res, next) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    if (!code || !state) throw createError("Missing code or state", 400);

    const { userId } = JSON.parse(Buffer.from(state, "base64url").toString());

    // Exchange code for token
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.LINKEDIN_REDIRECT_URI,
        client_id: config.LINKEDIN_CLIENT_ID,
        client_secret: config.LINKEDIN_CLIENT_SECRET,
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!tokenData.access_token) throw createError("Failed to get LinkedIn token", 502);

    // Fetch profile — prefer /v2/me (native member ID) over OIDC sub
    // because the UGC Posts API requires the native ID, not the OIDC sub
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as { sub?: string; name?: string };
    if (!profile.sub) throw createError("Failed to get LinkedIn profile", 502);

    // Try to get native member ID from /v2/me (compatible with UGC Posts API)
    let nativeMemberId = profile.sub;
    try {
      const meRes = await fetch("https://api.linkedin.com/v2/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, "X-Restli-Protocol-Version": "2.0.0" },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as { id?: string; localizedFirstName?: string; localizedLastName?: string };
        if (me.id) nativeMemberId = me.id;
      }
    } catch {}

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    await prisma.socialAccount.upsert({
      where: {
        user_id_platform_account_id: {
          user_id: userId,
          platform: "linkedin",
          account_id: nativeMemberId,
        },
      },
      update: {
        account_name: profile.name ?? "LinkedIn Account",
        access_token_enc: encrypt(tokenData.access_token),
        token_expires_at: expiresAt,
        is_active: true,
      },
      create: {
        user_id: userId,
        platform: "linkedin",
        account_name: profile.name ?? "LinkedIn Account",
        account_id: nativeMemberId,
        access_token_enc: encrypt(tokenData.access_token),
        token_expires_at: expiresAt,
      },
    });

    res.redirect(`${config.FRONTEND_URL}/accounts?connected=linkedin`);
  } catch (err) {
    next(err);
  }
});

export default router;
