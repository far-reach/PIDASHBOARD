import { NextResponse } from "next/server";
import { SIGNALS_ENABLED } from "@/lib/env";

/**
 * Server-side enforcement of the directional-calls switch.
 *
 * Hiding the tabs is presentation; this is the actual control. With signals
 * disabled the API serves no entry, stop, target or performance figure to
 * anyone — including a direct caller who never loads the UI — and refuses to
 * publish new ones at all. A compliance decision that only held in the
 * navigation bar would not be a compliance decision.
 *
 * Reads return empty rather than erroring, so the client needs no special
 * case and no error state appears for a feature that is simply not offered.
 */

export function signalsReadDisabled(): boolean {
  return !SIGNALS_ENABLED;
}

/** 403 for any attempt to publish or mutate a directional call while disabled. */
export function signalsWriteBlocked(): NextResponse | null {
  if (SIGNALS_ENABLED) return null;
  return NextResponse.json(
    {
      error:
        "Publishing trading calls is disabled on this deployment. See COMPLIANCE.md — " +
        "this app does not publish directional recommendations.",
    },
    { status: 403 }
  );
}
