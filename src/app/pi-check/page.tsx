"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { inPiBrowser, loadPiSdk, signInWithPi } from "@/lib/pi/client";
import { sessionHeaders } from "@/lib/session-client";

/**
 * Operator diagnostics for the Pi handshake. Not linked from the nav: it exists
 * so a failing sign-in on a real phone reports which step failed, instead of
 * leaving a spinner and no information.
 */
export default function PiCheckPage() {
  const [env, setEnv] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const say = (line: string) => setLog((l) => [...l, line]);

  useEffect(() => {
    void (async () => {
      const lines = [
        `user agent: ${navigator.userAgent}`,
        `detected as Pi Browser: ${inPiBrowser() ? "yes" : "no"}`,
        `NEXT_PUBLIC_PI_SANDBOX: ${process.env.NEXT_PUBLIC_PI_SANDBOX ?? "(unset)"}`,
        `window.Pi before load: ${typeof window.Pi === "undefined" ? "absent" : "present"}`,
      ];
      const sdk = await loadPiSdk();
      lines.push(`SDK after load: ${sdk ? "ready" : "unavailable"}`);
      setEnv(lines);
    })();
  }, []);

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">Pi connection check</h1>

      <section className="space-y-1">
        {env.map((line) => (
          <p key={line} className="text-xs break-words font-mono">
            {line}
          </p>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            say("sign-in: starting");
            signInWithPi()
              .then((user) => say(user ? `sign-in ok: @${user.username} (${user.uid})` : "sign-in: SDK unavailable"))
              .catch((e: unknown) => say(`sign-in failed: ${e instanceof Error ? e.message : String(e)}`));
          }}
        >
          Test sign-in
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            say("session: checking");
            fetch("/api/me", { headers: sessionHeaders() })
              .then(async (r) => say(`GET /api/me returned ${r.status}: ${(await r.text()).slice(0, 300)}`))
              .catch((e: unknown) => say(`GET /api/me failed: ${e instanceof Error ? e.message : String(e)}`));
          }}
        >
          Check session
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            say("payments: probing the Pi platform with this deployment's API key");
            fetch("/api/pi/diagnose")
              .then(async (r) => say(`GET /api/pi/diagnose returned ${r.status}: ${(await r.text()).slice(0, 400)}`))
              .catch((e: unknown) => say(`GET /api/pi/diagnose failed: ${e instanceof Error ? e.message : String(e)}`));
          }}
        >
          Check payments config
        </Button>
      </div>

      <section className="space-y-1">
        {log.map((line, i) => (
          <p key={`${i}-${line}`} className="text-xs break-words font-mono">
            {line}
          </p>
        ))}
      </section>
    </main>
  );
}
