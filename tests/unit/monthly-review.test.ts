import { describe, expect, it } from "vitest";
import { buildMonthlyReview, DEFAULT_TARGETS, lastClosedMonth, poleStatus, previousMonth, type MonthlyRow } from "@/domain/monthly-review";
import { getMonthlyRows, getOpex } from "@/server/data/demo-source";
import { getDemoDataset } from "@/server/demo/store";

const row = (month: string, marketplace: string, over: Partial<MonthlyRow> = {}): MonthlyRow => ({
  month, marketplace, brand: "ACTA",
  revenueHt: 100_000, commissions: 15_000, ads: 10_000, logistics: 8_000, returns: 3_000, cogs: 40_000,
  units: 100, orders: 90, returnUnits: 5, ...over,
});

describe("revue mensuelle", () => {
  it("navigue entre les mois", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(lastClosedMonth("2026-11-15")).toBe("2026-10");
  });

  it("statut par rapport à la cible (plus bas = mieux)", () => {
    expect(poleStatus(9, 10)).toBe("good");
    expect(poleStatus(11, 10)).toBe("watch");
    expect(poleStatus(12, 10)).toBe("critical");
  });

  it("calcule TACoS, taux de retour, logistique, OpEx et marge nette", () => {
    const review = buildMonthlyReview({
      rows: [row("2026-09", "amazon_eu"), row("2026-10", "amazon_eu", { ads: 14_000 }), row("2026-10", "decathlon", { units: 50, returnUnits: 6 })],
      opex: { "2026-10": 2_000 },
      today: "2026-11-15",
      selectedMonth: "2026-10",
      targets: DEFAULT_TARGETS,
      names: { amazon_eu: "Amazon", decathlon: "Décathlon" },
    });
    const s = review.selected!;
    expect(s.revenue).toBe(200_000);
    expect(s.tacos).toBeCloseTo(12);
    expect(s.returnRate).toBeCloseTo((11 / 150) * 100);
    expect(s.opexRate).toBeCloseTo(1);
    // 200 000 - 30 000 - 24 000 - 16 000 - 6 000 - 80 000 - 2 000
    expect(s.netProfit).toBe(42_000);
    expect(s.revenueDelta).toBeCloseTo(100);
    const acq = review.poles.find((p) => p.key === "acquisition")!;
    expect(acq.status).toBe("critical");
    expect(acq.deltaPoints).toBeCloseTo(2);
    expect(acq.levers[0]).toMatch(/^Amazon : TACoS 14,0 %/);
    expect(review.byMarketplace[0].share).toBeCloseTo(50);
    expect(review.months.map((m) => m.month)).toEqual(["2026-10", "2026-09"]);
  });

  it("données démo SDG : 13 mois, taux de retour réaliste", async () => {
    const ds = getDemoDataset();
    const sdg = ds.workspaces.find((w) => w.slug === "sdg-distribution")!;
    const rows = await getMonthlyRows(sdg.id, { from: "2025-09-01", to: "2026-10-31" });
    const review = buildMonthlyReview({
      rows, opex: await getOpex(sdg.id), today: ds.today, selectedMonth: lastClosedMonth(ds.today), targets: DEFAULT_TARGETS, names: {},
    });
    expect(review.months.length).toBe(13);
    expect(review.selected!.returnRate!).toBeGreaterThan(2);
    expect(review.selected!.returnRate!).toBeLessThan(15);
    expect(review.selected!.opex).toBe(120_000);
  });
});
