import { NextResponse, type NextRequest } from "next/server";
import { getPayment, PiPlatformError } from "@/lib/pi/server";
import { isPiSandbox, piApiKey } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { readTrail } from "@/lib/pi/diagnostics";

export const dynamic = "force-dynamic";

/**
 * GET /api/pi/diagnose
 *
 * Operator diagnostics for the payment configuration, surfaced on /pi-check.
 * Probes the Pi platform with the configured API key by asking for a payment
 * id that cannot exist. The platform's answer distinguishes the two states
 * that look identical from the outside:
 *   - 404: the key was ACCEPTED (the payment merely does not exist): the
 *     server can approve payments; a stuck wallet means something else.
 *   - 401: the key was REJECTED: wrong network (Testnet key on a Mainnet
 *     app) or invalid; every approval will fail and the wallet will count
 *     down and expire.
 * Reports coarse status only; the key itself is never echoed.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`diagnose:${clientKey(req)}`, { capacity: 5, refillPerSec: 0.1 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const configured = piApiKey().length > 0;
  const base: Record<string, unknown> = {
    apiKeyConfigured: configured,
    sandbox: isPiSandbox(),
    // The last few payment legs, newest first: which step ran and what it
    // said. This is the only place the phone can see why an approval that
    // the wallet reported as "developer failed to approve" actually failed.
    recentPayments: await readTrail(),
  };
  if (!configured) {
    return NextResponse.json({
      ...base,
      verdict: "PI_API_KEY is not set on this deployment; no payment can be approved",
    });
  }

  try {
    await getPayment("cyberekt-diagnostic-probe");
    // A real payment by this id cannot exist; reaching here would be strange
    // but still proves the key is accepted.
    return NextResponse.json({ ...base, verdict: "API key accepted by the Pi platform" });
  } catch (err) {
    if (err instanceof PiPlatformError && err.status === 404) {
      return NextResponse.json({ ...base, verdict: "API key accepted by the Pi platform" });
    }
    if (err instanceof PiPlatformError && err.status === 401) {
      return NextResponse.json({
        ...base,
        verdict:
          "API key REJECTED by the Pi platform: PI_API_KEY is invalid or belongs to the wrong network (a Testnet key on a Mainnet app cannot approve payments)",
      });
    }
    return NextResponse.json({
      ...base,
      verdict: `Pi platform unreachable or unexpected reply: ${
        err instanceof PiPlatformError ? `HTTP ${err.status}` : "network error"
      }`,
    });
  }
}
