import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import {
  registerWhatsAppDevice,
  unregisterWhatsAppDevice,
  getWhatsAppAccount,
  getPendingPublication,
  reportPublicationResult,
} from "../services/whatsapp.service";

const router = Router();

router.get("/status", requireAuth, async (req: AuthRequest, res: Response) => {
  const account = await getWhatsAppAccount(req.user!.sub);
  res.json({
    registered: !!account,
    deviceName: account?.account_name ?? null,
    phoneNumber: account?.account_id ?? null,
    userId: req.user!.sub,
  });
});

router.post("/register", requireAuth, async (req: AuthRequest, res: Response) => {
  const { deviceName, phoneNumber } = req.body ?? {};
  if (!phoneNumber) return res.status(400).json({ error: "phoneNumber es requerido" });

  const account = await registerWhatsAppDevice(req.user!.sub, deviceName || "Android", phoneNumber);
  res.json({ registered: true, phoneNumber: account.account_id, userId: req.user!.sub });
});

router.delete("/register", requireAuth, async (req: AuthRequest, res: Response) => {
  await unregisterWhatsAppDevice(req.user!.sub);
  res.json({ ok: true });
});

// Libera registros atascados en "processing" devolviéndolos a "pending"
router.get("/reset-stuck", async (req, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: "userId es requerido" });

  const { prisma } = await import("../prisma");
  const result = await prisma.scheduledPublication.updateMany({
    where: {
      status: "processing",
      post_variant: { platform: "whatsapp", post: { user_id: userId } },
    },
    data: { status: "pending", attempt_count: 0 },
  });

  res.json({ ok: true, updated: result.count });
});

router.get("/pending", async (req, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: "userId es requerido" });

  const pending = await getPendingPublication(userId);
  if (!pending) return res.json(null);

  res.json(pending);
});

router.post("/callback", async (req, res: Response) => {
  try {
    const { id, userId, success, error } = req.body ?? {};
    if (!id || !userId) return res.status(400).json({ error: "id y userId son requeridos" });

    await reportPublicationResult(id, userId, !!success, error);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.put("/reschedule", async (req, res: Response) => {
  const { scheduledId, userId } = req.body ?? {};
  if (!scheduledId || !userId) return res.status(400).json({ error: "scheduledId y userId son requeridos" });

  const { prisma } = await import("../prisma");
  const record = await prisma.scheduledPublication.findFirst({
    where: { id: scheduledId, post_variant: { post: { user_id: userId } } },
  });
  if (!record) return res.status(404).json({ error: "No encontrado" });

  await prisma.scheduledPublication.update({
    where: { id: scheduledId },
    data: { status: "pending", publish_at: new Date(), attempt_count: 0 },
  });
  res.json({ ok: true });
});

router.post("/status/publish", requireAuth, async (req: AuthRequest, res: Response) => {
  const { caption, mediaUrls, scheduledAt } = req.body ?? {};
  if (!caption && !mediaUrls?.length) {
    return res.status(400).json({ error: "caption o mediaUrls requerido" });
  }

  const account = await getWhatsAppAccount(req.user!.sub);
  if (!account) return res.status(400).json({ error: "WhatsApp no registrado. Registra tu dispositivo primero." });

  const { prisma } = await import("../prisma");

  const post = await prisma.post.create({
    data: {
      user_id: req.user!.sub,
      title: (caption || "Estado WhatsApp").slice(0, 80),
      base_caption: caption || "",
      status: "pending",
    },
  });

  const variant = await prisma.postPlatformVariant.create({
    data: {
      post_id: post.id,
      social_account_id: account.id,
      platform: "whatsapp",
      caption: caption || "",
      status: "pending",
    },
  });

  // Guardar mediaUrls en job_data para que getPendingPublication las devuelva a MacroDroid
  const jobData = Array.isArray(mediaUrls) && mediaUrls.length > 0
    ? { mediaUrls: mediaUrls as string[] }
    : undefined;

  await prisma.scheduledPublication.create({
    data: {
      post_id: post.id,
      post_variant_id: variant.id,
      social_account_id: account.id,
      publish_at: scheduledAt ? new Date(scheduledAt) : new Date(),
      status: "pending",
      ...(jobData ? { job_data: jobData } : {}),
    },
  });

  res.json({ ok: true, scheduledId: variant.id, message: "Enviado al dispositivo para publicacion inmediata" });
});

export default router;
