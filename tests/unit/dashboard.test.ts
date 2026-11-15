import { describe, expect, it } from "vitest";
import { buildDashboard } from "@/domain/dashboard";
import { MARKETPLACE_NAMES } from "@/domain/marketplaces";
import { buildPeriod, formatRange } from "@/domain/period";
import { rollupInMemory } from "@/server/data/rollups";
import { buildDemoDataset } from "@/server/demo/seed";

describe("périodes", () => {
  it("compare le mois en cours aux mêmes jours du mois précédent", () => {
    const p = buildPeriod("mois", "2026-11-15");
    expect(p.current).toEqual({ from: "2026-11-01", to: "2026-11-15" });
    expect(p.previous).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(formatRange(p.previous)).toBe("1-15 oct.");
  });
  it("borne la période précédente à la fin d'un mois plus court", () => {
    expect(buildPeriod("mois", "2026-03-31").previous).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("gère 7 jours et le trimestre", () => {
    expect(buildPeriod("7j", "2026-11-15").previous).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    const q = buildPeriod("trimestre", "2026-11-15");
    expect(q.current.from).toBe("2026-10-01");
    expect(q.previous).toEqual({ from: "2026-07-01", to: "2026-08-15" });
    expect(buildPeriod("trimestre", "2026-01-10").previous.from).toBe("2025-10-01");
  });
});

describe("Dashboard global (données de démo)", () => {
  const ds = buildDemoDataset(new Date("2026-11-15T15:00:00Z"));
  const ws = ds.workspaces.find((w) => w.slug === "sdg-distribution")!.id;
  const f = <T extends { workspaceId: string }>(rows: T[]) => rows.filter((r) => r.workspaceId === ws);
  const period = buildPeriod("mois", ds.today);
  const roll = (range: typeof period.current) => rollupInMemory(f(ds.metrics), f(ds.stores), f(ds.products), range);
  const view = buildDashboard({
    period,
    today: ds.today,
    current: roll(period.current),
    previous: roll(period.previous),
    alerts: f(ds.alerts),
    pillarScores: f(ds.pillarScores),
    blockedListings: new Set(f(ds.listings).filter((l) => l.status === "blocked").map((l) => `${l.storeId}:${l.productId}`)),
    marketplaceNames: MARKETPLACE_NAMES,
  });

  it("calcule profit et marge de façon cohérente", () => {
    expect(view.profit.value! / view.revenue.value!).toBeCloseTo(view.margin.value! / 100, 5);
    expect(view.margin.value!).toBeGreaterThan(20);
    expect(view.margin.value!).toBeLessThan(23);
  });

  it("aligne les barres quotidiennes et marque aujourd'hui", () => {
    expect(view.daily).toHaveLength(15);
    expect(view.daily.at(-1)?.isToday).toBe(true);
    expect(view.daily.reduce((t, d) => t + d.current, 0)).toBe(view.revenue.value);
  });

  it("limite le tableau par canal à 8 lignes + Autres, triées par CA", () => {
    expect(view.channels.length).toBeLessThanOrEqual(9);
    expect(view.channels.at(-1)?.name).toBe("Autres");
    expect(view.channels[0].name).toBe("Amazon UE");
    expect(view.channels[0].share).toBe(1);
  });

  it("place les références bloquées en tête des alertes prioritaires", () => {
    expect(view.alerts.top[0].category).toBe("blocked_listing");
    const firstStockout = view.alerts.top.findIndex((a) => a.category === "stockout");
    const lastBlocked = view.alerts.top.map((a) => a.category).lastIndexOf("blocked_listing");
    expect(lastBlocked).toBeLessThan(firstStockout);
    expect(view.alerts.total).toBe(7);
  });

  it("explique chaque flop SKU par une cause", () => {
    expect(view.flopSkus.length).toBeGreaterThan(0);
    for (const s of view.flopSkus) {
      expect(s.delta!).toBeLessThan(0);
      expect(s.cause?.label).toBeTruthy();
    }
    expect(view.flopSkus.some((s) => s.cause?.label.startsWith("Bloqué"))).toBe(true);
  });

  it("calcule le score global des piliers", () => {
    expect(view.pillars.rows).toHaveLength(7);
    expect(view.pillars.global).toBe(79);
  });
});
