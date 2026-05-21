import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode";
import path from "path";
import fs from "fs";

type WAStatus = "disconnected" | "qr_pending" | "connected";

const AUTH_FOLDER = path.resolve(".baileys_auth");
const logger = pino({ level: "silent" });

let sock: ReturnType<typeof makeWASocket> | null = null;
let currentQr: string | null = null;
let currentPairingCode: string | null = null;
let connectionStatus: WAStatus = "disconnected";
let isInitializing = false;

export function getWhatsAppStatus(): { status: WAStatus; pairingCode?: string } {
  return { status: connectionStatus, pairingCode: currentPairingCode ?? undefined };
}

export async function getQrDataUrl(): Promise<string | null> {
  if (!currentQr) return null;
  return qrcode.toDataURL(currentQr);
}

export async function initWhatsApp(phoneNumber?: string): Promise<void> {
  if (isInitializing || (sock && connectionStatus === "connected")) return;
  isInitializing = true;

  if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  const usePairingCode = !!phoneNumber && !state.creds.registered;

  sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    generateHighQualityLinkPreview: false,
    printQRInTerminal: false,
    // Con código de emparejamiento no se emite QR
    ...(usePairingCode ? { browser: ["copal", "Chrome", "1.0.0"] } : {}),
  });

  // Solicitar código de emparejamiento si se pasó número
  if (usePairingCode && sock) {
    setTimeout(async () => {
      try {
        const code = await sock!.requestPairingCode(phoneNumber!.replace(/\D/g, ""));
        currentPairingCode = code;
        console.log("[WhatsApp] Código de emparejamiento:", code);
      } catch (e) {
        console.error("[WhatsApp] Error solicitando código:", e);
      }
    }, 3000);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQr = qr;
      connectionStatus = "qr_pending";
      console.log("[WhatsApp] QR generado — escanea con WhatsApp Business");
    }

    if (connection === "open") {
      connectionStatus = "connected";
      currentQr = null;
      currentPairingCode = null;
      isInitializing = false;
      console.log("[WhatsApp] Conectado");
    }

    if (connection === "close") {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      connectionStatus = "disconnected";
      sock = null;
      isInitializing = false;
      console.log("[WhatsApp] Desconectado, razón:", reason);

      if (shouldReconnect) {
        console.log("[WhatsApp] Reconectando...");
        setTimeout(() => initWhatsApp(), 3000);
      } else {
        // Logged out — clear saved credentials
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      }
    }
  });
}

export async function publishWhatsAppStatus(
  caption: string,
  mediaUrl?: string
): Promise<{ id: string }> {
  if (!sock || connectionStatus !== "connected") {
    throw new Error("WhatsApp no está conectado");
  }

  if (mediaUrl) {
    const res = await fetch(mediaUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const isVideo = contentType.startsWith("video/");

    const msg = await sock.sendMessage(
      "status@broadcast",
      isVideo
        ? { video: buffer, caption, mimetype: contentType }
        : { image: buffer, caption, mimetype: contentType }
    );
    return { id: msg?.key.id ?? "unknown" };
  }

  const msg = await sock.sendMessage("status@broadcast", { text: caption });
  return { id: msg?.key.id ?? "unknown" };
}

export async function disconnectWhatsApp(): Promise<void> {
  if (sock) {
    await sock.logout();
    sock = null;
    connectionStatus = "disconnected";
    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
  }
}
