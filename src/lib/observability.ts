/**
 * Structured logging + error reporting.
 *
 * Everything is emitted as one JSON object per line on stdout/stderr, which
 * every host (Vercel, Railway, Fly, Docker) captures and makes searchable with
 * no extra dependency and no build-time coupling.
 *
 * An external reporter (Sentry or anything else) is attached at runtime via
 * `setErrorReporter`, NOT imported here: a conditional `import("@sentry/...")`
 * is a static dependency as far as the bundler is concerned, so it fails the
 * production build on any deployment that has not installed the package.
 *
 * To enable Sentry:
 *   1. npm install @sentry/nextjs && npx @sentry/wizard@latest -i nextjs
 *   2. in instrumentation.ts:
 *        import * as Sentry from "@sentry/nextjs";
 *        import { setErrorReporter } from "@/lib/observability";
 *        setErrorReporter((err, ctx) => Sentry.captureException(err, { extra: ctx }));
 */

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, extra: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, extra?: Record<string, unknown>) => emit("debug", msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => emit("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => emit("error", msg, extra),
};

export type ErrorReporter = (err: unknown, context: Record<string, unknown>) => void;

const globalForReporter = globalThis as unknown as { __cybrektReporter?: ErrorReporter };

/** Attach an external error reporter (see the Sentry recipe above). */
export function setErrorReporter(reporter: ErrorReporter): void {
  globalForReporter.__cybrektReporter = reporter;
}

/**
 * Record a handled error. Always logs; forwards to the attached reporter when
 * one is configured. Use this instead of an empty catch block wherever
 * swallowing an error could hide an outage (feed failures, payment
 * reconciliation, cache/database errors).
 */
export function reportError(msg: string, err: unknown, extra: Record<string, unknown> = {}): void {
  log.error(msg, {
    ...extra,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  try {
    globalForReporter.__cybrektReporter?.(err, { msg, ...extra });
  } catch {
    // A broken reporter must never escalate into a request failure.
  }
}
