import { describe, expect, it } from "vitest";
import { buildDemoDataset } from "@/server/demo/seed";
import { FORBIDDEN_DASHES } from "./chars";

const ds = buildDemoDataset(new Date("2026-11-15T15:00:00Z"));
const sdg = ds.workspaces.find((w) => w.slug === "sdg-distribution")!;

describe("données d'exemple", () => {
  it("sont déterministes", () => {
    const again = buildDemoDataset(new Date("2026-11-15T15:00:00Z"));
    expect(again.metrics.length).toBe(ds.metrics.length);
    expect(again.metrics[123]).toEqual(ds.metrics[123]);
  });

  it("ne contiennent aucun tiret long ni demi-cadratin", () => {
    expect(JSON.stringify(ds)).not.toMatch(FORBIDDEN_DASHES);
  });

  it("calibrent le mois en cours de SDG sur la maquette (CA HT, profit, marge)", () => {
    const rows = ds.metrics.filter((m) => m.workspaceId === sdg.id && m.date >= "2026-11-01");
    const revenue = rows.reduce((s, m) => s + m.revenueHt, 0);
    const profit = rows.reduce((s, m) => s + m.revenueHt - m.commissions - m.ads - m.logistics - m.returns - m.cogs, 0);
    // Calibré sur 142 380 € avant incidents (références bloquées, rupture)
    expect(revenue / 100).toBeGreaterThan(132_000);
    expect(revenue / 100).toBeLessThan(143_000);
    expect((profit / revenue) * 100).toBeGreaterThan(20.5);
    expect((profit / revenue) * 100).toBeLessThan(22.5);
  });

  it("isolent chaque ligne dans un espace existant", () => {
    const ids = new Set(ds.workspaces.map((w) => w.id));
    for (const m of ds.metrics) expect(ids.has(m.workspaceId)).toBe(true);
    for (const a of ds.alerts) expect(ids.has(a.workspaceId)).toBe(true);
  });

  it("comptent 29 références bloquées et 7 alertes ouvertes pour SDG", () => {
    expect(ds.listings.filter((l) => l.workspaceId === sdg.id && l.status === "blocked")).toHaveLength(29);
    expect(ds.alerts.filter((a) => a.workspaceId === sdg.id && a.status !== "resolved")).toHaveLength(7);
  });

  it("réservent Import OMS à SDG, avec des accès différents selon les membres", () => {
    expect(sdg.enabledModules).toContain("import-oms");
    for (const w of ds.workspaces.filter((x) => x.id !== sdg.id)) expect(w.enabledModules).not.toContain("import-oms");
    const viewer = ds.members.find((m) => m.workspaceId === sdg.id && m.role === "viewer")!;
    expect(viewer.grantedModules).not.toContain("import-oms");
  });
});
