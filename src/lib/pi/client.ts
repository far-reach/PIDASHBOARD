"use client";

/**
 * Client-side Pi SDK wrapper. The official SDK is loaded from
 * https://sdk.minepi.com/pi-sdk.js (per Pi developer docs); inside Pi
 * Browser `window.Pi` becomes available. In a normal browser the loader
 * resolves to null and every feature degrades gracefully — the free tier
 * works without Pi (brief §Phase 4.1).
 */

export interface PiAuthResult {
  accessToken: string;
  user: { uid: string; username: string };
}

interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: unknown) => void;
}

interface PiSdk {
  init(config: { version: "2.0"; sandbox?: boolean }): void;
  authenticate(
    scopes: string[],
    onIncompletePaymentFound: (payment: {
      identifier: string;
      transaction?: { txid: string } | null;
    }) => void
  ): Promise<PiAuthResult>;
  createPayment(
    payment: { amount: number; memo: string; metadata: Record<string, unknown> },
    callbacks: PiPaymentCallbacks
  ): void;
}

declare global {
  interface Window {
    Pi?: PiSdk;
  }
}

const SDK_URL = "https://sdk.minepi.com/pi-sdk.js";
let loadPromise: Promise<PiSdk | null> | null = null;

export function loadPiSdk(): Promise<PiSdk | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Pi) return Promise.resolve(window.Pi);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<PiSdk | null>((resolve) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    const timeout = setTimeout(() => resolve(null), 8000);
    script.onload = () => {
      clearTimeout(timeout);
      try {
        window.Pi?.init({
          version: "2.0",
          sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX !== "false",
        });
        resolve(window.Pi ?? null);
      } catch {
        resolve(null);
      }
    };
    script.onerror = () => {
      clearTimeout(timeout);
      resolve(null); // not in Pi Browser / offline — free tier continues
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

async function reportIncompletePayment(payment: {
  identifier: string;
  transaction?: { txid: string } | null;
}): Promise<void> {
  try {
    await fetch("/api/pi/payments/incomplete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentId: payment.identifier, txid: payment.transaction?.txid }),
    });
  } catch {
    // Reconciliation is retried on next sign-in.
  }
}

/** Sign in with Pi; returns the server-verified session user, or null outside Pi Browser. */
export async function signInWithPi(): Promise<{ uid: string; username: string } | null> {
  const sdk = await loadPiSdk();
  if (!sdk) return null;
  const auth = await sdk.authenticate(["username", "payments"], (p) => void reportIncompletePayment(p));
  const res = await fetch("/api/pi/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken: auth.accessToken }),
  });
  if (!res.ok) throw new Error(`server rejected Pi sign-in (${res.status})`);
  const data = (await res.json()) as { user: { uid: string; username: string } };
  return data.user;
}

/**
 * Run a Pi payment end-to-end. Resolves once the SERVER has confirmed
 * completion — client-side success alone never unlocks anything, and the
 * server re-reads the payment from the Pi platform to decide what it was for.
 */
function payWithPi(args: {
  amountPi: number;
  memo: string;
  product: string;
  unavailable: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    void loadPiSdk().then((sdk) => {
      if (!sdk) {
        reject(new Error(args.unavailable));
        return;
      }
      sdk.createPayment(
        {
          amount: args.amountPi,
          memo: args.memo,
          metadata: { product: args.product },
        },
        {
          onReadyForServerApproval: (paymentId) => {
            void fetch("/api/pi/payments/approve", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ paymentId }),
            }).then((res) => {
              if (!res.ok) reject(new Error(`server approval failed (${res.status})`));
            });
          },
          onReadyForServerCompletion: (paymentId, txid) => {
            void fetch("/api/pi/payments/complete", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ paymentId, txid }),
            }).then((res) => {
              if (res.ok) resolve();
              else reject(new Error(`server completion failed (${res.status})`));
            });
          },
          onCancel: () => reject(new Error("payment cancelled")),
          onError: (error) => reject(error),
        }
      );
    });
  });
}

/** Buy (or extend) the 30-day Pro subscription. */
export function subscribeWithPi(amountPi: number): Promise<void> {
  return payWithPi({
    amountPi,
    memo: "PiPulse Pro — 30 days",
    product: "pipulse-pro-30d",
    unavailable: "Pi SDK unavailable — open this app in Pi Browser to subscribe",
  });
}

/**
 * Send the developer a voluntary tip. Unlocks nothing by design — the server
 * banks it and grants no entitlement, so the free app stays fully free.
 */
export function tipWithPi(amountPi: number): Promise<void> {
  return payWithPi({
    amountPi,
    memo: "PiPulse — support the developer",
    product: "pipulse-tip",
    unavailable: "Pi SDK unavailable — open this app in Pi Browser to send Pi",
  });
}
