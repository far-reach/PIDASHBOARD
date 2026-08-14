/**
 * OKX public websocket ticker stream (used by the ingest worker for
 * sub-second primary freshness; REST polling remains the safety net).
 * Protocol: wss://ws.okx.com:8443/ws/v5/public — JSON subscribe, "ping"
 * keepalive every ~25s, server replies "pong".
 */
import WebSocket from "ws";
import type { Tick } from "@/lib/market/types";

const WS_URL = process.env.OKX_WS_URL ?? "wss://ws.okx.com:8443/ws/v5/public";

export interface OkxStreamHandle {
  close(): void;
}

export function streamOkxTicker(
  symbol: string,
  onTick: (tick: Tick) => void,
  onLog: (msg: string) => void = () => {}
): OkxStreamHandle {
  const instId = symbol.replace(/USDT$/, "-USDT");
  let ws: WebSocket | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let backoffMs = 1000;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(WS_URL);

    ws.on("open", () => {
      backoffMs = 1000;
      onLog(`okx-ws: connected, subscribing tickers ${instId}`);
      ws?.send(JSON.stringify({ op: "subscribe", args: [{ channel: "tickers", instId }] }));
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
    });

    ws.on("message", (buf: WebSocket.RawData) => {
      const text = buf.toString();
      if (text === "pong") return;
      try {
        const msg = JSON.parse(text) as {
          data?: {
            last: string;
            bidPx: string;
            askPx: string;
            open24h: string;
            high24h: string;
            low24h: string;
            volCcy24h: string;
            ts: string;
          }[];
        };
        const t = msg.data?.[0];
        if (!t) return;
        const last = Number(t.last);
        const open = Number(t.open24h);
        if (!Number.isFinite(last) || last <= 0) return;
        onTick({
          symbol,
          price: last,
          bid: Number(t.bidPx) || null,
          ask: Number(t.askPx) || null,
          volume24h: Number(t.volCcy24h) || null,
          changePct24h: open > 0 ? ((last - open) / open) * 100 : null,
          high24h: Number(t.high24h) || null,
          low24h: Number(t.low24h) || null,
          source: "okx",
          ts: Number(t.ts) || Date.now(),
        });
      } catch {
        // non-JSON frame; ignore
      }
    });

    const scheduleReconnect = () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      if (closed) return;
      onLog(`okx-ws: disconnected, reconnecting in ${backoffMs}ms`);
      setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 2, 60_000);
    };

    ws.on("close", scheduleReconnect);
    ws.on("error", (err: Error) => {
      onLog(`okx-ws: error ${err.message}`);
      ws?.close();
    });
  };

  connect();

  return {
    close() {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      ws?.close();
    },
  };
}
