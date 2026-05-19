import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: "15m" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyRefreshToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as AccessTokenPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const REFRESH_COOKIE = "copal_refresh";
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};
