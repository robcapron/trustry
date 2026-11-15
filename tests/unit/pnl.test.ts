import { describe, expect, it } from "vitest";
import { MARKETPLACE_NAMES } from "@/domain/marketplaces";
import { buildPeriod } from "@/domain/period";
import { buildPnl, flattenPnl, pnlMetrics } from "@/domain/pnl";
import { netProfit } from "@/domain/profit";
import { rollupInMemory } from "@/server/data/rollups";
import { buildDemoDataset } from "@/server/demo/seed";

const ds = buildDemoDataset(new Date("2026-11-15T15:00:00Z"));
const ws = ds.workspaces.find((w) => w.slug === "sdg-distribution")!.id;
const f = <T extends { workspaceId: string }>(rows: T[]) => rows.filter((r) => r.workspaceId === ws);
const period = buildPeriod("mois", ds.today);
const roll = (r: typeof period.current) => rollupInMemory(f(ds.metrics), f(ds.stores), f(ds.products), r).skus;
const current = roll(period.current);
const previous = roll(period.previous);

describe("P&L détaillé", () => {
  const view = buildPnl({ current, previous, names: MARKETPLACE_NAMES, filters: {} });

  it("les niveaux s'additionnent : canal = somme des pays = somme des SKU", () => {
    for (const ch of view.rows) {
      const countries = ch.children.reduce((t, c) => t + c.totals.revenueHt, 0);
      expect(countries).toBe(ch.totals.revenueHt);
      for (const co of ch.children) {
        expect(co.children.reduce((t, s) => t + s.totals.revenueHt, 0)).toBe(co.totals.revenueHt);
      }
    }
    expect(view.rows.reduce((t, c) => t + c.totals.revenueHt, 0)).toBe(view.total.totals.revenueHt);
  });

  it("calcule profit net, marge et TACoS au niveau total", () => {
    const m = pnlMetrics(view.total);
    expect(m.profit).toBe(netProfit(view.total.totals));
    expect(m.margin).toBeCloseTo((m.profit / m.revenue) * 100, 6);
    expect(m.tacos).toBeCloseTo((m.ads / m.revenue) * 100, 6);
  });

  it("filtre par canal, pays, marque et recherche", () => {
    const deca = buildPnl({ current, previous, names: MARKETPLACE_NAMES, filters: { canal: "decathlon", pays: "FR" } });
    expect(deca.rows).toHaveLength(1);
    expect(deca.rows[0].label).toBe("Décathlon");
    expect(deca.rows[0].children.map((c) => c.label)).toEqual(["FR"]);
    const acta = buildPnl({ current, previous, names: MARKETPLACE_NAMES, filters: { marque: "ACTA" } });
    expect(flattenPnl(acta).every((r) => r.node.sublabel?.startsWith("ACTA-"))).toBe(true);
    const q = buildPnl({ current, previous, names: MARKETPLACE_NAMES, filters: { q: "kegel" } });
    expect(flattenPnl(q).every((r) => r.node.sublabel === "ORNG-KEGEL-80A")).toBe(true);
  });

  it("garde les SKU qui n'ont plus de ventes (bloqués) avec -100 %", () => {
    const flat = flattenPnl(view);
    const zero = flat.filter((r) => r.node.totals.revenueHt === 0 && r.node.previousRevenue > 0);
    expect(zero.length).toBeGreaterThan(0);
    expect(pnlMetrics(zero[0].node).delta).toBe(-100);
  });
});
