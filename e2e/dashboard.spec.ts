import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * E2E smoke against a real `next dev` server backed by an isolated PGlite
 * database (see e2e:server script). Exchange APIs may be unreachable in CI,
 * so these tests assert on what must hold regardless of upstream network:
 * disclaimers everywhere, the immutable signal lifecycle, honest
 * performance derivation, and mobile-viewport integrity.
 */

const ADMIN_KEY = "test-admin-key-e2e";
const auth = { authorization: `Bearer ${ADMIN_KEY}`, "content-type": "application/json" };

async function publishSignal(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const res = await request.post("/api/signals", {
    headers: auth,
    data: {
      symbol: "PIUSDT",
      direction: "long",
      entry: 0.5,
      stop: 0.45,
      target: 0.6,
      rationale: "E2E: our model shows a bounce scenario at range support.",
      ...overrides,
    },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { signal: { id: string } };
  return body.signal.id;
}

test.describe("disclaimers on every screen (brief §3.3)", () => {
  for (const path of ["/", "/signals", "/performance", "/reports", "/learn"]) {
    test(`footer disclaimer present on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByTestId("disclaimer-footer")).toBeVisible();
      await expect(page.getByTestId("disclaimer-footer")).toContainText("Not financial advice");
    });
  }

  test("risk banner shows and dismisses per session", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("risk-banner")).toBeVisible();
    await page.getByRole("button", { name: /dismiss risk banner/i }).click();
    await expect(page.getByTestId("risk-banner")).toHaveCount(0);
    await page.goto("/signals");
    await expect(page.getByTestId("risk-banner")).toHaveCount(0); // stays dismissed this session
  });
});

test.describe("mobile viewport integrity (375px — brief §Phase 2.6)", () => {
  for (const path of ["/", "/signals", "/performance", "/reports", "/learn"]) {
    test(`no horizontal page scroll on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const scrollWidth = await page.evaluate(
        () => document.scrollingElement?.scrollWidth ?? 0
      );
      expect(scrollWidth).toBeLessThanOrEqual(376);
    });
  }
});

test.describe("signal lifecycle: publish → feed → immutable → close → performance", () => {
  test("full flow", async ({ page, request }) => {
    const id = await publishSignal(request);

    // 1) It appears in the public feed.
    await page.goto("/signals");
    await expect(page.getByTestId("signals-feed")).toContainText("bounce scenario");

    // 2) Mutation attempts are refused: no PATCH surface exists (brief §Phase 3 exit).
    const patch = await request.patch(`/api/signals/${id}`, {
      headers: auth,
      data: { entry: 0.99 },
    });
    expect(patch.status()).toBe(405);
    const del = await request.delete(`/api/signals/${id}`, { headers: auth });
    expect(del.status()).toBe(405);

    // 3) Unauthenticated publication is refused.
    const anon = await request.post("/api/signals", {
      data: { symbol: "PIUSDT", direction: "long", entry: 1, stop: 0.9, target: 1.2, rationale: "x" },
    });
    expect(anon.status()).toBe(401);

    // 4) Manual close requires a reason and books the result permanently.
    const noReason = await request.post(`/api/signals/${id}/events`, {
      headers: auth,
      data: { price: 0.55 },
    });
    expect(noReason.status()).toBe(422);

    const close = await request.post(`/api/signals/${id}/events`, {
      headers: auth,
      data: { note: "e2e early close", price: 0.55 },
    });
    expect(close.status()).toBe(201);

    const closeAgain = await request.post(`/api/signals/${id}/events`, {
      headers: auth,
      data: { note: "double close attempt", price: 0.7 },
    });
    expect(closeAgain.status()).toBe(409);

    // 5) Performance derives from the event log: +1R at 0.55 on a 0.05 risk.
    const perfRes = await request.get("/api/performance");
    const perf = (await perfRes.json()) as {
      performance: { scored: number; sumR: number; wins: number };
    };
    expect(perf.performance.scored).toBeGreaterThanOrEqual(1);
    expect(perf.performance.wins).toBeGreaterThanOrEqual(1);

    // 6) The loss-transparency invariant: closed signal visible with realized R.
    await page.goto("/signals");
    await expect(page.getByTestId("signals-feed")).toContainText("CLOSED EARLY");
  });

  test("losing and winning signals render with identical card structure", async ({
    page,
    request,
  }) => {
    const loserId = await publishSignal(request, {
      rationale: "E2E loser: our model shows a failed-breakout fade.",
    });
    await request.post(`/api/signals/${loserId}/events`, {
      headers: auth,
      data: { note: "e2e stop simulation", price: 0.45 },
    });

    await page.goto("/signals");
    const cards = page.getByTestId("signal-card");
    await expect(cards.first()).toBeVisible();
    const boxes = await cards.evaluateAll((els) =>
      els.map((el) => ({ w: el.getBoundingClientRect().width, cls: el.className }))
    );
    // Same width and same classes for every card, win or lose (brief §8).
    expect(new Set(boxes.map((b) => Math.round(b.w))).size).toBe(1);
    expect(new Set(boxes.map((b) => b.cls)).size).toBe(1);
  });
});

test.describe("health & data endpoints", () => {
  test("/api/health reports subsystem states", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 503]).toContain(res.status());
    const body = (await res.json()) as {
      status: string;
      subsystems: { database: { status: string } };
    };
    expect(body.subsystems.database.status).toBe("ok");
  });

  test("signals list meta never hides that open signals exist", async ({ request }) => {
    const res = await request.get("/api/signals");
    const body = (await res.json()) as {
      meta: { open_signals_visible: boolean; hidden_open_count: number };
    };
    expect(body.meta.open_signals_visible).toBe(true); // free mode default
    expect(body.meta.hidden_open_count).toBe(0);
  });
});
