/**
 * A short, readable trail of what happened on the last few payment attempts.
 *
 * The Pi wallet polls the platform for approval and, when it does not arrive,
 * reports only that "the developer failed to approve". Which of our legs
 * failed, and why, is invisible from the phone; and on serverless the request
 * that failed is gone before anyone can read its logs. The trail is therefore
 * written to the shared kv table, so the operator can read it back from
 * another request on another instance.
 *
 * Nothing secret is stored: a step name, an outcome, and the message the
 * platform or our own code produced. Never the API key, never a token.
 */
import { kvGet, kvSet } from "@/lib/kv";
import { reportError } from "@/lib/observability";

const KEY = "pi:payment-trail";
const KEEP = 12;

export interface PaymentTrailEntry {
  at: string;
  step: "approve" | "complete" | "incomplete";
  outcome: "ok" | "failed";
  paymentId: string;
  detail: string;
}

/** Never throws and never blocks the payment path on its own failure. */
export async function recordTrail(entry: Omit<PaymentTrailEntry, "at">): Promise<void> {
  try {
    const existing = await kvGet<PaymentTrailEntry[]>(KEY);
    const trail = Array.isArray(existing?.value) ? existing.value : [];
    trail.unshift({ at: new Date().toISOString(), ...entry });
    await kvSet(KEY, trail.slice(0, KEEP));
  } catch (err) {
    reportError("could not write the payment trail", err, { step: entry.step });
  }
}

export async function readTrail(): Promise<PaymentTrailEntry[]> {
  try {
    const existing = await kvGet<PaymentTrailEntry[]>(KEY);
    return Array.isArray(existing?.value) ? existing.value : [];
  } catch {
    return [];
  }
}
