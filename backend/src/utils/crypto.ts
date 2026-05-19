import crypto from "crypto";
import { config } from "../config";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(config.ENCRYPTION_KEY, "hex");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: iv(12):tag(16):ciphertext — all hex
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, tagHex, dataHex] = encryptedData.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted format");

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString("utf8") + decipher.final("utf8");
}
