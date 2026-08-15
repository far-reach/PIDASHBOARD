/** User + subscription persistence (Pi identity only — no emails, no tracking). */
import { getDb, toIso, type Db } from "@/lib/db";
import type { PiPaymentDTO } from "@/lib/pi/server";

export async function upsertUser(uid: string, username: string, db?: Db): Promise<void> {
  const d = db ?? (await getDb());
  await d.query(
    `INSERT INTO users (pi_user_id, username) VALUES ($1, $2)
     ON CONFLICT (pi_user_id) DO UPDATE SET username = EXCLUDED.username, last_seen_at = now()`,
    [uid, username]
  );
}

export async function recordPayment(
  payment: PiPaymentDTO,
  status: "created" | "approved" | "completed" | "cancelled" | "failed",
  txid: string | null,
  db?: Db
): Promise<void> {
  const d = db ?? (await getDb());
  await d.query(
    `INSERT INTO payments (payment_id, pi_user_id, amount, memo, status, txid, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (payment_id) DO UPDATE
       SET status = EXCLUDED.status,
           txid = COALESCE(EXCLUDED.txid, payments.txid),
           raw = EXCLUDED.raw,
           updated_at = now()`,
    [
      payment.identifier,
      payment.user_uid,
      payment.amount,
      payment.memo ?? "",
      status,
      txid,
      JSON.stringify(payment),
    ]
  );
}

const SUBSCRIPTION_DAYS = 30;

/**
 * Activate (or extend) a subscription after a verified, completed payment.
 * Extension stacks on the current expiry so users never lose paid days.
 *
 * Idempotent per payment id: replaying the same completed payment returns the
 * period it already bought instead of granting another one. The unique index
 * on subscriptions(payment_id) makes that guarantee hold even under
 * concurrent duplicate requests, not just sequential ones.
 */
export async function activateSubscription(
  uid: string,
  paymentId: string,
  db?: Db
): Promise<{ expiresAt: string; alreadyCredited: boolean }> {
  const d = db ?? (await getDb());

  const existing = await d.query<{ expires_at: unknown }>(
    `SELECT expires_at FROM subscriptions WHERE payment_id = $1 LIMIT 1`,
    [paymentId]
  );
  if (existing.rows[0]) {
    return { expiresAt: toIso(existing.rows[0].expires_at), alreadyCredited: true };
  }

  const { rows } = await d.query<{ expires_at: unknown }>(
    `SELECT expires_at FROM subscriptions
     WHERE pi_user_id = $1 AND status = 'active' AND expires_at > now()
     ORDER BY expires_at DESC LIMIT 1`,
    [uid]
  );
  const base = rows[0] ? new Date(toIso(rows[0].expires_at)).getTime() : Date.now();
  const expiresAt = new Date(base + SUBSCRIPTION_DAYS * 24 * 3600 * 1000).toISOString();

  try {
    await d.query(
      `INSERT INTO subscriptions (pi_user_id, plan, status, expires_at, payment_id)
       VALUES ($1, 'pro', 'active', $2, $3)`,
      [uid, expiresAt, paymentId]
    );
  } catch {
    // Lost a race against a concurrent completion of the same payment; the
    // winner's row is authoritative.
    const won = await d.query<{ expires_at: unknown }>(
      `SELECT expires_at FROM subscriptions WHERE payment_id = $1 LIMIT 1`,
      [paymentId]
    );
    if (won.rows[0]) {
      return { expiresAt: toIso(won.rows[0].expires_at), alreadyCredited: true };
    }
    throw new Error("could not activate subscription");
  }
  return { expiresAt, alreadyCredited: false };
}
