import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyAccessToken, PiPlatformError } from "@/lib/pi/server";
import { upsertUser } from "@/lib/users";
import { getSubscription } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ accessToken: z.string().min(10).max(5000) });

/**
 * POST /api/pi/verify { accessToken }
 * The client's Pi.authenticate() result is NEVER trusted directly: the token
 * is verified against the Pi platform's /v2/me before a session is issued
 * (brief §Phase 4.2, §3.9).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`verify:${clientKey(req)}`, { capacity: 10, refillPerSec: 0.2 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "accessToken required" }, { status: 422 });
  }

  try {
    const piUser = await verifyAccessToken(parsed.data.accessToken);
    await upsertUser(piUser.uid, piUser.username);
    const subscription = await getSubscription(piUser.uid);
    const res = NextResponse.json({
      user: { uid: piUser.uid, username: piUser.username },
      subscription,
    });
    res.cookies.set(SESSION_COOKIE, createSessionToken(piUser.uid, piUser.username), sessionCookieOptions());
    return res;
  } catch (err) {
    if (err instanceof PiPlatformError && err.status === 401) {
      return NextResponse.json({ error: "Pi access token rejected" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Pi platform unreachable", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 }
    );
  }
}
