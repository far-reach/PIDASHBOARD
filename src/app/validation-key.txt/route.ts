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
 *
 * The committed key is the MAINNET app's. Testnet and Mainnet are separate
 * portal registrations with separate keys, and only one can be the committed
 * fallback: re-verifying the Testnet app means setting PI_VALIDATION_KEY to
 * its key, which then wins over this constant.
 */
const COMMITTED_VALIDATION_KEY =
  "b3517d091dd3f9233ca949ae3b04c916ca0ea16a69ab75f00e69efea11955bd8ee68c1c415c54cbc38049be001bd9b08e94d0d92017372620213921f8deb0024";

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
