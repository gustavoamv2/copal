import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";
import {
  initWhatsApp,
  getWhatsAppStatus,
  publishWhatsAppStatus,
  getQrDataUrl,
  disconnectWhatsApp,
} from "../services/whatsapp.service";

const router = Router();
router.use(requireAuth);

// GET /api/whatsapp/status
router.get("/status", async (_req: AuthRequest, res: Response) => {
  const { status, pairingCode } = getWhatsAppStatus();
  const qr = await getQrDataUrl();
  res.json({ status, qr, pairingCode });
});

// POST /api/whatsapp/connect
// Body opcional: { phone: "56912345678" } → usa código de emparejamiento
// Sin body → usa QR
router.post("/connect", async (req: AuthRequest, res: Response, next) => {
  try {
    const { phone } = req.body ?? {};
    initWhatsApp(phone); // no await — corre en background
    const method = phone ? "pairing_code" : "qr";
    res.json({ message: `Iniciando WhatsApp (método: ${method}) — polling GET /status`, method });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/whatsapp/connect — cierra sesión
router.delete("/connect", async (_req: AuthRequest, res: Response, next) => {
  try {
    await disconnectWhatsApp();
    res.json({ message: "Sesión de WhatsApp cerrada" });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/status/publish
router.post("/status/publish", async (req: AuthRequest, res: Response, next) => {
  try {
    const { caption, mediaUrl } = req.body;
    if (!caption && !mediaUrl) {
      return res.status(400).json({ error: "Se requiere caption o mediaUrl" });
    }
    const result = await publishWhatsAppStatus(caption ?? "", mediaUrl);
    return res.json({ success: true, id: result.id });
  } catch (err) {
    next(err);
  }
});

export default router;
