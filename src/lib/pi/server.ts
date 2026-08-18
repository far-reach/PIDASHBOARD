/**
 * Server-side Pi Platform API client (official flow only — brief §3.9):
 *   - user identity verification: GET /v2/me with the user's access token
 *   - payment server-approval:   POST /v2/payments/{id}/approve
 *   - payment server-completion: POST /v2/payments/{id}/complete
 * Docs: https://minepi.com/developers/ → Platform API. The server NEVER
 * trusts a client-side "paid" claim (brief §Phase 4.5); subscription state
 * changes only on a successful /complete round-trip.
 */
import { piApiBase, piApiKey } from "@/lib/env";

export interface PiUser {
  uid: string;
  username: string;
}

export class PiPlatformError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

async function piFetch<T>(
  path: string,
  init: { method?: string; headers: Record<string, string>; body?: string }
): Promise<T> {
  const res = await fetch(`${piApiBase()}${path}`, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", ...init.headers },
    body: init.body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PiPlatformError(`Pi API ${res.status} on ${path}: ${text.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as T;
}

/** Verify a Pi access token by asking the Pi platform who it belongs to. */
export async function verifyAccessToken(accessToken: string): Promise<PiUser> {
  const me = await piFetch<{ uid: string; username?: string }>(`/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!me?.uid) throw new PiPlatformError("Pi /me returned no uid", 502);
  return { uid: me.uid, username: me.username ?? "" };
}

export interface PiPaymentDTO {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction?: { txid: string; verified: boolean } | null;
}

function keyHeaders(): Record<string, string> {
  const key = piApiKey();
  if (!key) throw new PiPlatformError("PI_API_KEY is not configured on the server", 501);
  return { authorization: `Key ${key}` };
}

export function getPayment(paymentId: string): Promise<PiPaymentDTO> {
  return piFetch<PiPaymentDTO>(`/payments/${paymentId}`, { headers: keyHeaders() });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * getPayment, tolerant of the moment right after creation.
 *
 * The SDK fires onReadyForServerApproval the instant it has a payment id,
 * which can be before that payment is readable from the Platform API: the
 * first GET comes back 404 for a payment that certainly exists. Treating
 * that as fatal means never approving, and the wallet then counts down and
 * reports that the developer failed to approve. Retries are short on purpose;
 * the whole budget is about two seconds against the wallet's 45.
 */
export async function getPaymentSoonAfterCreation(paymentId: string): Promise<PiPaymentDTO> {
  const delays = [300, 600, 1200];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await getPayment(paymentId);
    } catch (err) {
      lastErr = err;
      const retriable = err instanceof PiPlatformError && (err.status === 404 || err.status >= 500);
      const delay = delays[attempt];
      if (!retriable || delay === undefined) break;
      await sleep(delay);
    }
  }
  throw lastErr;
}

export function approvePayment(paymentId: string): Promise<PiPaymentDTO> {
  return piFetch<PiPaymentDTO>(`/payments/${paymentId}/approve`, {
    method: "POST",
    headers: keyHeaders(),
  });
}

export function completePayment(paymentId: string, txid: string): Promise<PiPaymentDTO> {
  return piFetch<PiPaymentDTO>(`/payments/${paymentId}/complete`, {
    method: "POST",
    headers: keyHeaders(),
    body: JSON.stringify({ txid }),
  });
}
