import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, getSubscription } from "@/lib/auth";
import { monetizationMode } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET /api/me; current session user + server-verified subscription state. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = getSessionUser(req);
  if (!user) {
    return NextResponse.json({
      user: null,
      subscription: { active: false, plan: null, expiresAt: null },
      monetization: monetizationMode(),
    });
  }
  const subscription = await getSubscription(user.uid);
  return NextResponse.json({ user, subscription, monetization: monetizationMode() });
}

/** DELETE /api/me; sign out (clears the session cookie). */
export async function DELETE(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
