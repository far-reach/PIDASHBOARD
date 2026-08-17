import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Pi Developer Portal domain verification.
 *
 * The portal shows a validation key and requires it to be served as
 * `validation-key.txt` at the root of the app's domain before it will verify
 * ownership. The env var `PI_VALIDATION_KEY` takes precedence so the key can
 * be rotated from the hosting platform without a redeploy; the committed
 * fallback below keeps verification working when no env var is set. The key
 * is not a secret; the whole point is that it is publicly served.
 */
const COMMITTED_VALIDATION_KEY =
  "543ca58a6b5ede6870c9140ef12767f3d9c9f6ccd33dd0e1bc0315b5b558d3a820f0764dcc2d3e261d1c199caa11379128c966c50fe015c4f06ec90cb0e43c2b";

export function GET(): NextResponse {
  const key = process.env.PI_VALIDATION_KEY || COMMITTED_VALIDATION_KEY;
  if (!key) {
    return new NextResponse(
      "PI_VALIDATION_KEY is not set on this deployment. Set it to the key shown in the Pi Developer Portal, then retry domain verification.",
      { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
  // Byte-exact: no trailing newline, no wrapper. The portal compares the body
  // against the key it issued, and a verifier that does not trim would fail on
  // a stray "\n"; an opaque debugging session at the worst possible moment.
  return new NextResponse(key.trim(), {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
