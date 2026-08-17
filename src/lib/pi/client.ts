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
let initialised = false;

export function inPiBrowser(): boolean {
  return typeof navigator !== "undefined" && /PiBrowser/i.test(navigator.userAgent);
}

/**
 * init() must run before authenticate(), or the SDK waits for a handshake that
 * never comes and the promise never settles. It is called from every entry
 * point, including the one where window.Pi already exists, because the host
 * browser may inject the object before this module ever loads a script.
 */
function initSdk(sdk: PiSdk): void {
  if (initialised) return;
  // Sandbox mode pairs with the desktop sandbox (sandbox.minepi.com) and hangs
  // inside the real Pi Browser, so it is never enabled there.
  sdk.init({
    version: "2.0",
    sandbox: !inPiBrowser() && process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
  });
  initialised = true;
}

export function loadPiSdk(): Promise<PiSdk | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Pi) {
    try {
      initSdk(window.Pi);
    } catch {
      // An init failure is reported by authenticate(), which has a timeout.
    }
    return Promise.resolve(window.Pi);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<PiSdk | null>((resolve) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    const timeout = setTimeout(() => resolve(null), 8000);
    script.onload = () => {
      clearTimeout(timeout);
      try {
        if (window.Pi) initSdk(window.Pi);
        resolve(window.Pi ?? null);
      } catch {
        resolve(null);
      }
    };
    script.onerror = () => {
      clearTimeout(timeout);
      resolve(null); // not in Pi Browser / offline; free tier continues
      loadPromise = null; // let a retry re-attempt the download
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

/**
 * Pi's authenticate() rejects on a real failure but simply never settles when
 * the handshake is misconfigured. Racing it against a deadline turns a dead
 * button into a message the operator can act on.
 */
function withDeadline<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} did not respond within ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);
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
  const auth = await withDeadline(
    sdk.authenticate(["username", "payments"], (p) => void reportIncompletePayment(p)),
    90_000,
    "Pi sign-in"
  );
  const res = await fetch("/api/pi/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken: auth.accessToken }),
  });
  if (!res.ok) throw await paymentError(res, "server rejected Pi sign-in");
  const data = (await res.json()) as { user: { uid: string; username: string } };
  return data.user;
}

/**
 * Run a Pi payment end-to-end. Resolves once the SERVER has confirmed
 * completion — client-side success alone never unlocks anything, and the
 * server re-reads the payment from the Pi platform to decide what it was for.
 */
/**
 * Surface the server's own explanation for a failed payment leg. The API
 * returns actionable messages ("tip of 0.05 π is below the 0.1 π minimum");
 * collapsing them to an HTTP status turns every rejection into a support
 * question.
 */
async function paymentError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.length > 0) {
      return new Error(body.error);
    }
  } catch {
    // Non-JSON body — fall through to the generic message.
  }
  return new Error(`${fallback} (${res.status})`);
}

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
            }).then(async (res) => {
              if (!res.ok) reject(await paymentError(res, "server approval failed"));
            });
          },
          onReadyForServerCompletion: (paymentId, txid) => {
            void fetch("/api/pi/payments/complete", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ paymentId, txid }),
            }).then(async (res) => {
              if (res.ok) resolve();
              else reject(await paymentError(res, "server completion failed"));
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
    memo: "Cyberekt Pro — 30 days",
    product: "cyberekt-pro-30d",
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
    memo: "Cyberekt — support the developer",
    product: "cyberekt-tip",
    unavailable: "Pi SDK unavailable — open this app in Pi Browser to send Pi",
  });
}
