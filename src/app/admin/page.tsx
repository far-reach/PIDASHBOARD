"use client";

/**
 * Operator console (brief §Phase 3.6). Auth: ADMIN_API_KEY pasted here, kept
 * in sessionStorage, sent as a Bearer token — every action is authorized
 * server-side. By design there is no edit or delete anywhere: publish and
 * manual-close (append events) are the only verbs.
 */
import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fmtPrice, fmtUtcDateTime } from "@/lib/format";
import type { SignalDTO, SignalsResponse } from "@/lib/api-types";

const KEY_STORAGE = "pipulse:admin-key";

interface FormState {
  direction: "long" | "short";
  entry: string;
  stop: string;
  target: string;
  rationale: string;
  expiresInHours: string;
  delayVisibilityMin: string;
  isTest: boolean;
}

const emptyForm: FormState = {
  direction: "long",
  entry: "",
  stop: "",
  target: "",
  rationale: "",
  expiresInHours: "168",
  delayVisibilityMin: "0",
  isTest: true,
};

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [openSignals, setOpenSignals] = useState<SignalDTO[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY_STORAGE);
    if (saved) {
      setKey(saved);
      setKeySaved(true);
    }
  }, []);

  const authHeaders = (): Record<string, string> => ({
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  });

  const loadOpen = async (k: string) => {
    const res = await fetch("/api/signals?include_test=1", {
      headers: { authorization: `Bearer ${k}` },
    });
    if (res.ok) {
      const data = (await res.json()) as SignalsResponse;
      setOpenSignals(data.signals.filter((s) => s.status === "open"));
    }
  };

  useEffect(() => {
    if (keySaved && key) void loadOpen(key);
  }, [keySaved, key]);

  const publish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const now = Date.now();
      const expiresH = Number(form.expiresInHours);
      const delayMin = Number(form.delayVisibilityMin);
      const payload = {
        symbol: "PIUSDT",
        direction: form.direction,
        entry: Number(form.entry),
        stop: Number(form.stop),
        target: Number(form.target),
        rationale: form.rationale.trim(),
        expires_at:
          Number.isFinite(expiresH) && expiresH > 0
            ? new Date(now + expiresH * 3600_000).toISOString()
            : null,
        visible_from:
          Number.isFinite(delayMin) && delayMin > 0
            ? new Date(now + delayMin * 60_000).toISOString()
            : null,
        is_test: form.isTest,
      };
      const res = await fetch("/api/signals", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { error?: string; issues?: { message: string }[] };
      if (res.ok) {
        setMessage({ tone: "ok", text: "Signal published — it is now permanent." });
        setForm({ ...emptyForm, isTest: form.isTest });
        void loadOpen(key);
      } else {
        setMessage({
          tone: "err",
          text: body.issues?.map((i) => i.message).join("; ") ?? body.error ?? `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "publish failed" });
    } finally {
      setBusy(false);
    }
  };

  const manualClose = async (signal: SignalDTO) => {
    const note = window.prompt(
      "Manual close requires a stated reason (it becomes part of the permanent record):"
    );
    if (!note) return;
    const res = await fetch(`/api/signals/${signal.id}/events`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      setMessage({ tone: "ok", text: "Signal closed manually; result booked at market price." });
      void loadOpen(key);
    } else {
      const body = (await res.json()) as { error?: string };
      setMessage({ tone: "err", text: body.error ?? `HTTP ${res.status}` });
    }
  };

  if (!keySaved) {
    return (
      <div className="max-w-sm mx-auto py-10 space-y-3">
        <h1 className="text-lg font-semibold">Operator console</h1>
        <p className="text-sm text-muted-foreground">Paste the operator API key for this deployment.</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          placeholder="ADMIN_API_KEY"
        />
        <Button
          disabled={key.length < 8}
          onClick={() => {
            sessionStorage.setItem(KEY_STORAGE, key);
            setKeySaved(true);
          }}
        >
          Unlock
        </Button>
      </div>
    );
  }

  const inputCls = "w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-tabular";

  return (
    <div className="space-y-3 pb-4 max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Operator console</h1>
        <Badge tone="warn">Signals are permanent once published</Badge>
      </div>

      {message ? (
        <p
          className={`text-sm rounded-md border px-3 py-2 ${
            message.tone === "ok" ? "border-up/40 text-up bg-up/10" : "border-down/40 text-down bg-down/10"
          }`}
          data-testid="admin-message"
        >
          {message.text}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Publish signal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">
              Direction
              <select
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value as "long" | "short" })}
                className={`${inputCls} mt-1`}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Entry (USDT)
              <input
                inputMode="decimal"
                value={form.entry}
                onChange={(e) => setForm({ ...form, entry: e.target.value })}
                className={`${inputCls} mt-1`}
                placeholder="0.4200"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Stop-loss
              <input
                inputMode="decimal"
                value={form.stop}
                onChange={(e) => setForm({ ...form, stop: e.target.value })}
                className={`${inputCls} mt-1`}
                placeholder={form.direction === "long" ? "below entry" : "above entry"}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Take-profit
              <input
                inputMode="decimal"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className={`${inputCls} mt-1`}
                placeholder={form.direction === "long" ? "above entry" : "below entry"}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Expires in (hours)
              <input
                inputMode="numeric"
                value={form.expiresInHours}
                onChange={(e) => setForm({ ...form, expiresInHours: e.target.value })}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Delay public visibility (minutes)
              <input
                inputMode="numeric"
                value={form.delayVisibilityMin}
                onChange={(e) => setForm({ ...form, delayVisibilityMin: e.target.value })}
                className={`${inputCls} mt-1`}
                title="Delayed publish protects live entries; 0 = visible immediately"
              />
            </label>
          </div>
          <label className="text-xs text-muted-foreground block">
            Rationale (shown to users verbatim — model-based language only)
            <textarea
              value={form.rationale}
              onChange={(e) => setForm({ ...form, rationale: e.target.value })}
              className={`${inputCls} mt-1 min-h-[80px] font-sans`}
              placeholder="Our model shows…"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isTest}
              onChange={(e) => setForm({ ...form, isTest: e.target.checked })}
            />
            Test signal (hidden from public users; keep checked until launch)
          </label>
          <Button onClick={() => void publish()} disabled={busy}>
            {busy ? "Publishing…" : "Publish — permanent"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open signals ({openSignals.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {openSignals.length === 0 ? (
            <p className="text-sm text-muted-foreground">None open.</p>
          ) : (
            openSignals.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="text-sm font-tabular min-w-0">
                  <span className={s.direction === "long" ? "text-up" : "text-down"}>
                    {s.direction.toUpperCase()}
                  </span>{" "}
                  E {fmtPrice(s.entry)} / S {fmtPrice(s.stop)} / T {fmtPrice(s.target)}
                  {s.is_test ? <Badge tone="warn" className="ml-1.5">TEST</Badge> : null}
                  <div className="text-[11px] text-muted-foreground">
                    issued {fmtUtcDateTime(s.issued_at)}
                  </div>
                </div>
                <Button variant="danger" className="min-h-[32px] py-1 text-xs" onClick={() => void manualClose(s)}>
                  Close early
                </Button>
              </div>
            ))
          )}
          <p className="text-[11px] text-muted-foreground">
            Closing early appends a manual_close event with your reason and the live market price.
            Nothing is ever edited or removed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
