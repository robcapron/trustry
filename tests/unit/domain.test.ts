import { describe, expect, it } from "vitest";
import { canUseModule } from "@/domain/access";
import { sortAlerts, type AlertForSort } from "@/domain/alerts";
import { netMarginPercent, netProfit, tacosPercent } from "@/domain/profit";
import { healthFromScore } from "@/domain/pillars";
import { toEurCents } from "@/domain/money";

describe("profit net", () => {
  it("applique la formule CA HT - commissions - pub - logistique - retours - coût d'achat", () => {
    const c = { revenueHt: 100_000, commissions: 15_000, ads: 8_000, logistics: 9_000, returns: 3_000, cogs: 43_000 };
    expect(netProfit(c)).toBe(22_000);
    expect(netMarginPercent(c)).toBeCloseTo(22);
  });
  it("renvoie null sans CA (pas de marge inventée)", () => {
    expect(netMarginPercent({ revenueHt: 0, commissions: 0, ads: 0, logistics: 0, returns: 0, cogs: 0 })).toBeNull();
  });
  it("calcule le TACoS sur le CA total", () => {
    expect(tacosPercent(1_280, 10_000)).toBeCloseTo(12.8);
  });
  it("convertit les devises en euros", () => {
    expect(toEurCents(10_000, "EUR", 1)).toBe(10_000);
    expect(toEurCents(10_000, "PLN", 0.23)).toBe(2_300);
    expect(() => toEurCents(10_000, "GBP", 0)).toThrow();
  });
});

describe("priorité des alertes", () => {
  const base = (over: Partial<AlertForSort>): AlertForSort => ({
    severity: "important",
    category: "other",
    revenueAtRiskCents: 0,
    createdAt: new Date("2026-11-15T10:00:00Z"),
    ...over,
  });
  it("place toujours une référence bloquée avant un réassort, même moins sévère", () => {
    const restock = base({ severity: "critical", category: "stockout", revenueAtRiskCents: 999_999 });
    const blocked = base({ severity: "important", category: "blocked_listing", revenueAtRiskCents: 10 });
    expect(sortAlerts([restock, blocked])[0]).toBe(blocked);
  });
  it("trie ensuite par sévérité puis CA à risque", () => {
    const info = base({ severity: "info", revenueAtRiskCents: 9_000 });
    const crit = base({ severity: "critical", revenueAtRiskCents: 100 });
    const crit2 = base({ severity: "critical", revenueAtRiskCents: 500 });
    expect(sortAlerts([info, crit, crit2])).toEqual([crit2, crit, info]);
  });
});

describe("santé des piliers", () => {
  it("reprend les seuils de la maquette", () => {
    expect(healthFromScore(79)).toBe("good");
    expect(healthFromScore(75)).toBe("good");
    expect(healthFromScore(74)).toBe("watch");
    expect(healthFromScore(60)).toBe("watch");
    expect(healthFromScore(58)).toBe("critical");
  });
});

describe("accès aux modules", () => {
  const enabled = ["import-oms"];
  it("donne l'accès d'office au propriétaire et à l'admin", () => {
    expect(canUseModule({ module: "import-oms", role: "owner", enabledModules: enabled, grantedModules: [] })).toBe(true);
    expect(canUseModule({ module: "import-oms", role: "admin", enabledModules: enabled, grantedModules: [] })).toBe(true);
  });
  it("exige un accord explicite pour manager et lecture seule", () => {
    expect(canUseModule({ module: "import-oms", role: "manager", enabledModules: enabled, grantedModules: [] })).toBe(false);
    expect(canUseModule({ module: "import-oms", role: "viewer", enabledModules: enabled, grantedModules: ["import-oms"] })).toBe(true);
  });
  it("refuse tout le monde si le module n'est pas activé sur l'espace", () => {
    expect(canUseModule({ module: "import-oms", role: "owner", enabledModules: [], grantedModules: ["import-oms"] })).toBe(false);
  });
});
