/**
 * Minimal stateless session: an HMAC-signed `uid.username.exp` token in an
 * httpOnly cookie. No third-party auth libraries, no data beyond what the
 * Pi SDK provides (brief §3.10).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "@/lib/env";

export const SESSION_COOKIE = "cybrekt_session";
const SESSION_TTL_S = 30 * 24 * 3600;

interface SessionPayload {
  uid: string;
  username: string;
  exp: number; // unix seconds
}

const b64u = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64u = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function sign(data: string): string {
  return createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}

export function createSessionToken(uid: string, username: string, now = Date.now()): string {
  const payload: SessionPayload = {
    uid,
    username,
    exp: Math.floor(now / 1000) + SESSION_TTL_S,
  };
  const data = b64u(JSON.stringify(payload));
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined | null, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(unb64u(data)) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  };
}
