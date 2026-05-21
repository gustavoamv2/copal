import api from "./client";

export interface WhatsAppStatus {
  status: "disconnected" | "qr_pending" | "connected";
  qr: string | null;
  pairingCode: string | null;
}

export const whatsappApi = {
  status: () => api.get<WhatsAppStatus>("/whatsapp/status"),
  connect: (phone?: string) => api.post("/whatsapp/connect", phone ? { phone } : {}),
  disconnect: () => api.delete("/whatsapp/connect"),
  publishStatus: (caption: string, mediaUrl?: string) =>
    api.post("/whatsapp/status/publish", { caption, mediaUrl }),
};
