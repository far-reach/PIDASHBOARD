import { z } from "zod";

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
  });

export type NewSignalInput = z.infer<typeof newSignalSchema>;

export const manualCloseSchema = z.object({
  note: z.string().trim().min(1, "a manual close requires a stated reason").max(1000),
  price: z.number().positive().finite().optional(),
});

export type ManualCloseInput = z.infer<typeof manualCloseSchema>;
