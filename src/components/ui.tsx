import { clsx } from "clsx";
import type { HTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

/** Small shadcn-style primitives, hand-rolled to keep the bundle lean. */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-4 pt-3.5 pb-2 flex items-center justify-between gap-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  // Section header, not a label: full-color text with a brand accent bar so
  // headings read as structure at a glance. Used on every dashboard section
  // and every Learn subject, so they all stay consistent.
  return (
    <h2
      className={clsx(
        "flex items-center gap-2 text-base font-bold uppercase tracking-wide text-foreground",
        "before:h-4 before:w-1 before:shrink-0 before:rounded-full before:bg-gradient-to-b before:from-primary before:to-up before:content-['']",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-4 pb-4", className)} {...props} />;
}

type BadgeTone = "neutral" | "up" | "down" | "warn" | "primary";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  up: "border-up/40 bg-up/10 text-up",
  down: "border-down/40 bg-down/10 text-down",
  warn: "border-warn/40 bg-warn/10 text-warn",
  primary: "border-primary/40 bg-primary/10 text-primary",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        badgeTones[tone],
        className
      )}
      {...props}
    />
  );
}

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-transparent hover:bg-muted",
  ghost: "bg-transparent hover:bg-muted",
  danger: "border border-down/50 text-down bg-transparent hover:bg-down/10",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium",
        "transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[40px]",
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-muted", className)} />;
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5 min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
      <div
        className={clsx(
          "text-base font-semibold font-tabular truncate",
          tone === "up" && "text-up",
          tone === "down" && "text-down"
        )}
      >
        {value}
      </div>
      {sub ? <div className="text-[11px] text-muted-foreground truncate">{sub}</div> : null}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-muted p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "px-2.5 py-1 text-xs font-medium rounded-[5px] min-h-[28px] transition-colors",
            o.value === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      {hint ? <p className="text-xs text-muted-foreground/70 mt-1">{hint}</p> : null}
    </div>
  );
}
