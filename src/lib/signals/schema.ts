import { z } from "zod";

/**
 * How far in the past `issued_at` may be set when publishing. Backdating is
 * how a published record gets quietly improved after the fact ("we called
 * this yesterday"); a small tolerance covers clock skew and queued
 * publication. The row's true `created_at` is exposed by the API regardless,
 * so any gap between the two is visible to anyone reading the feed.
 */
export const BACKDATE_TOLERANCE_MS = 10 * 60 * 1000;
const FUTURE_ISSUE_LIMIT_MS = 7 * 24 * 3600 * 1000;

/** Maximum deviation an operator-supplied manual-close price may have from the live market. */
export const MANUAL_CLOSE_TOLERANCE_PCT = 2;

/** Validation for the operator signal-publishing endpoint (POST /api/signals). */
export const newSignalSchema = z
  .object({
    symbol: z.string().trim().min(3).max(20).toUpperCase(),
    direction: z.enum(["long", "short"]),
    entry: z.number().positive().finite(),
    stop: z.number().positive().finite(),
    target: z.number().positive().finite(),
    rationale: z.string().trim().min(1, "a rationale is required — users deserve the why").max(2000),
    issued_at: z.string().datetime({ offset: true }).optional(),
    expires_at: z.string().datetime({ offset: true }).nullish(),
    visible_from: z.string().datetime({ offset: true }).nullish(),
    source: z.enum(["manual", "engine"]).default("manual"),
    is_test: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.direction === "long") {
      if (!(v.stop < v.entry)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["stop"], message: "long: stop must be below entry" });
      }
      if (!(v.target > v.entry)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "long: target must be above entry" });
      }
    } else {
      if (!(v.stop > v.entry)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["stop"], message: "short: stop must be above entry" });
      }
      if (!(v.target < v.entry)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "short: target must be below entry" });
      }
    }
    if (v.expires_at && new Date(v.expires_at).getTime() <= Date.now()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expires_at"], message: "expiry must be in the future" });
    }
    if (v.issued_at) {
      const skewMs = new Date(v.issued_at).getTime() - Date.now();
      if (skewMs < -BACKDATE_TOLERANCE_MS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["issued_at"],
          message: `issued_at may not be backdated more than ${BACKDATE_TOLERANCE_MS / 60000} minutes`,
        });
      }
      if (skewMs > FUTURE_ISSUE_LIMIT_MS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["issued_at"],
          message: "issued_at is more than 7 days in the future",
        });
      }
    }
  });

export type NewSignalInput = z.infer<typeof newSignalSchema>;

export const manualCloseSchema = z.object({
  note: z.string().trim().min(1, "a manual close requires a stated reason").max(1000),
  price: z.number().positive().finite().optional(),
});

export type ManualCloseInput = z.infer<typeof manualCloseSchema>;
