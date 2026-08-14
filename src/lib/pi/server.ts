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
