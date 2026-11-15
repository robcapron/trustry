import { describe, expect, it, vi } from "vitest";
import { runAlertEngine } from "@/server/sync/run-alerts";
import { runConnectionSync } from "@/server/sync/run-sync";
import { updateEcbRates } from "@/server/sync/fx-rates";
import { createFakeSupabase } from "./fake-supabase";

vi.mock("@/lib/dates", async (orig) => ({ ...(await orig<object>()), parisToday: () => "2026-11-15" }));

const WS = "ws-1";

function setup() {
  return createFakeSupabase({
    connections: [
      { id: "c1", workspace_id: WS, marketplace_code: "alltricks", adapter: "mock", status: "connected", last_sync_at: null, credentials_secret_id: null, sync_frequency_minutes: 60, token_expires_at: null, last_error: null },
      { id: "c2", workspace_id: WS, marketplace_code: "kaufland", adapter: "native", status: "connected", last_sync_at: null, credentials_secret_id: null, sync_frequency_minutes: 60, token_expires_at: null, last_error: null },
    ],
    products: [],
    product_costs: [],
    fx_rates: [],
    alert_rules: [{ workspace_id: WS, sales_drop_percent: 20, sales_drop_window_days: 7, stock_cover_days: 7, tacos_target_percent: 10 }],
    alerts: [{ id: "old", workspace_id: WS, dedupe_key: "stock:DISPARU", status: "todo", category: "stockout" }],
  });
}

describe("chaîne synchro -> métriques -> alertes (connecteur de test)", () => {
  it("synchronise 30 jours, crée catalogue, fiches, stock, commandes et métriques", async () => {
    const { client, tables } = setup();
    const res = await runConnectionSync(client, "c1");
    expect(res.status).toBe("success");
    expect(tables.get("stores")).toHaveLength(1);
    expect(tables.get("products")!.length).toBe(12);
    expect(tables.get("listings")!.length).toBe(12);
    expect(tables.get("inventory_snapshots")!.every((s) => s.snapshot_date === "2026-11-15")).toBe(true);
    const metrics = tables.get("daily_sku_metrics")!;
    const days = new Set(metrics.map((m) => m.metric_date));
    expect([...days].sort()[0]).toBe("2026-10-17");
    const revenue = metrics.reduce((t, m) => t + Number(m.revenue_ht_eur_cents), 0);
    const commissions = metrics.reduce((t, m) => t + Number(m.commissions_eur_cents), 0);
    expect(commissions / revenue).toBeCloseTo(0.15, 2);
    expect(tables.get("connections")!.find((c) => c.id === "c1")).toMatchObject({ status: "connected", sync_progress: 100, last_error: null });
    expect(tables.get("sync_runs")![0]).toMatchObject({ status: "success", error: "12 SKU sans coût d'achat" });

    // Seconde synchro : recouvrement de 3 jours, pas de doublon
    const before = metrics.length;
    tables.get("connections")!.find((c) => c.id === "c1")!.last_sync_at = "2026-11-15T08:00:00Z";
    await runConnectionSync(client, "c1");
    expect(tables.get("daily_sku_metrics")!.length).toBe(before);
  });

  it("une connexion sans connecteur natif est ignorée (synchro via Claude)", async () => {
    const { client } = setup();
    expect((await runConnectionSync(client, "c2")).status).toBe("skipped");
  });

  it("le moteur crée les alertes (blocage, rupture), les met à jour sans doublon et résout les disparues", async () => {
    const { client, tables } = setup();
    await runConnectionSync(client, "c1");
    const first = await runAlertEngine(client, WS, new Date("2026-11-15T12:00:00Z"));
    const alerts = tables.get("alerts")!;
    expect(alerts.find((a) => a.id === "old")!.status).toBe("resolved");
    const open = alerts.filter((a) => a.status !== "resolved");
    expect(open.some((a) => a.category === "blocked_listing" && a.severity === "critical")).toBe(true);
    expect(open.some((a) => a.category === "stockout" && (a.subjects as string[])[0] === "TEST-SKU-02")).toBe(true);
    expect(first.created).toBe(open.length);
    const again = await runAlertEngine(client, WS, new Date("2026-11-15T13:00:00Z"));
    expect(again.created).toBe(0);
    expect(tables.get("alerts")!.filter((a) => a.status !== "resolved")).toHaveLength(open.length);
  });

  it("taux BCE enregistrés depuis le flux quotidien", async () => {
    const { client, tables } = setup();
    const xml = "<Cube time='2026-11-13'><Cube currency='PLN' rate='4.25'/><Cube currency='USD' rate='1.08'/></Cube>";
    const res = await updateEcbRates(client, (async () => new Response(xml)) as typeof fetch);
    expect(res).toEqual({ date: "2026-11-13", currencies: 2 });
    expect(tables.get("fx_rates")!.find((r) => r.currency === "PLN")!.eur_per_unit).toBeCloseTo(0.23529412, 7);
  });
});
