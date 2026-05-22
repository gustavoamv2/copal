import api from "./client";

export interface WhatsAppStatus {
  registered: boolean;
  deviceName: string | null;
  phoneNumber: string | null;
}

export const whatsappApi = {
  status: () => api.get<WhatsAppStatus>("/whatsapp/status"),
  register: (deviceName: string, phoneNumber: string) =>
    api.post("/whatsapp/register", { deviceName, phoneNumber }),
  unregister: () => api.delete("/whatsapp/register"),
  publishStatus: (caption: string, mediaUrls?: string[]) =>
    api.post("/whatsapp/status/publish", { caption, mediaUrls }),
};
