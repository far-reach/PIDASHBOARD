import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Pi Developer Portal domain verification.
 *
 * The portal shows a validation key and requires it to be served as
 * `validation-key.txt` at the root of the app's domain before it will verify
 * ownership. Serving it from an env var (rather than a committed file) means
 * the operator sets `PI_VALIDATION_KEY` in the hosting platform and clicks
 * "Verify domain" — no code change, no redeploy of a secret-ish value, and
 * the key never lands in git.
 */
export function GET(): NextResponse {
  const key = process.env.PI_VALIDATION_KEY;
  if (!key) {
    return new NextResponse(
      "PI_VALIDATION_KEY is not set on this deployment. Set it to the key shown in the Pi Developer Portal, then retry domain verification.",
      { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
  return new NextResponse(key.trim() + "\n", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
