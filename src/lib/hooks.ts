"use client";

/**
 * Data hooks. Every hook keeps its last good payload in localStorage so the
 * PWA can show last-known data offline, clearly badged as such (brief §Phase
 * 2.7): `fromCache` is true when the network is unavailable and the value
 * shown came from storage.
 */
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type {
  CandlesResponse,
  LatestPriceDTO,
  MeResponse,
  PerformanceResponse,
  ReportsResponse,
  SignalsResponse,
} from "@/lib/api-types";

const LS_PREFIX = "pipulse:last:";

function readCache<T>(key: string): { value: T; storedAt: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as { value: T; storedAt: string }) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(
      LS_PREFIX + key,
      JSON.stringify({ value, storedAt: new Date().toISOString() })
    );
  } catch {
    /* storage full/blocked — offline mode simply won't have this key */
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

function useCachedQuery<T>(key: string, url: string, refetchMs: number | false) {
  const query = useQuery<T>({
    queryKey: [key],
    queryFn: async () => {
      const data = await getJson<T>(url);
      writeCache(key, data);
      return data;
    },
    refetchInterval: refetchMs,
    retry: 1,
    staleTime: 2000,
  });
  const cached = query.isError ? readCache<T>(key) : null;
  return {
    data: query.data ?? cached?.value ?? null,
    fromCache: !query.data && !!cached,
    cachedAt: cached?.storedAt ?? null,
    isLoading: query.isLoading,
    isError: query.isError && !cached,
    refetch: query.refetch,
  };
}

export const useLatestPrice = () =>
  useCachedQuery<LatestPriceDTO>("price", "/api/price/latest", 5000);

export const useCandles = (tf: string) =>
  useCachedQuery<CandlesResponse>(`candles:${tf}`, `/api/candles?tf=${tf}`, 30_000);

export const useSignals = () => useCachedQuery<SignalsResponse>("signals", "/api/signals", 30_000);

export const usePerformance = () =>
  useCachedQuery<PerformanceResponse>("performance", "/api/performance", 60_000);

export const useReports = () =>
  useCachedQuery<ReportsResponse>("reports", "/api/reports?limit=30", 300_000);

export const useMe = () => useCachedQuery<MeResponse>("me", "/api/me", false);

/** True when the browser reports no network. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true
  );
}
