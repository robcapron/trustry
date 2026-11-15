import { describe, expect, it } from "vitest";
import { buildForecast, forecastRanges, monthEnd } from "@/domain/forecast";
import { ZERO_TOTALS, type DailyRollup } from "@/domain/metrics";
import { eachDay, isoAddDays } from "@/domain/period";

const day = (date: string, revenueHt: number): DailyRollup => ({ ...ZERO_TOTALS, date, revenueHt, cogs: revenueHt * 0.5, ads: revenueHt * 0.1 });
const series = (from: string, to: string, v: (d: string) => number) => eachDay({ from, to }).map((d) => day(d, v(d)));

describe("prévision d'atterrissage", () => {
  const today = "2026-11-15";

  it("bornes de dates", () => {
    expect(monthEnd(today)).toBe("2026-11-30");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    const r = forecastRanges(today);
    expect(r.recent).toEqual({ from: "2026-11-01", to: "2026-11-14" });
    expect(r.previousMonth).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(r.lastYearMonth).toEqual({ from: "2025-11-01", to: "2025-11-30" });
    expect(r.lastYear.to).toBe(isoAddDays("2026-11-30", -364));
  });

  it("au rythme constant sans historique : réalisé clos + rythme x jours restants", () => {
    const mtd = series("2026-11-01", today, (d) => (d === today ? 400 : 1000));
    const f = buildForecast({
      today, monthToDate: mtd, recent: mtd, lastYearDaily: [], previousMonthRevenue: 25_000, lastYearMonthRevenue: null, target: 32_000,
    });
    expect(f.method).toBe("rythme");
    expect(f.closedDays).toBe(14);
    expect(f.remainingDays).toBe(16);
    expect(f.landing).toBe(30_000);
    expect(f.low).toBe(28_500);
    expect(f.high).toBe(31_500);
    expect(f.deltaVsPreviousMonth).toBeCloseTo(20);
    expect(f.targetProgress).toBeCloseTo(93.75);
    expect(f.requiredDaily).toBe(1125);
    expect(f.netMargin).toBeCloseTo(40);
    expect(f.netProfit).toBe(12_000);
    expect(f.tacos).toBeCloseTo(10);
    expect(f.confidence).toBe("bonne");
  });

  it("corrige par le profil N-1 (pic Black Friday)", () => {
    const mtd = series("2026-11-01", today, () => 1000);
    const r = forecastRanges(today);
    // N-1 : moitié du niveau actuel, avec un pic x3 sur les 4 jours du Black Friday aligné
    const bf = new Set(eachDay({ from: "2026-11-27", to: "2026-11-30" }).map((d) => isoAddDays(d, -364)));
    const ly = series(r.lastYear.from, r.lastYear.to, (d) => (bf.has(d) ? 1500 : 500));
    const f = buildForecast({ today, monthToDate: mtd, recent: mtd, lastYearDaily: ly, previousMonthRevenue: null, lastYearMonthRevenue: null, target: null });
    expect(f.method).toBe("saisonnalise");
    // 14 000 clos + 12 jours x 1000 + 4 jours x 3000
    expect(f.landing).toBe(38_000);
    expect(f.runRateLanding).toBe(30_000);
    expect(f.high - f.landing).toBe(4_000);
    expect(f.target).toBeNull();
    expect(f.requiredDaily).toBeNull();
  });
});
