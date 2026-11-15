import { describe, expect, it } from "vitest";
import { parseEcbDaily, rateAt } from "@/domain/fx";
import { buildDailyMetrics, type NormalizedOrder } from "@/domain/sync-metrics";

const order = (id: string, over: Partial<NormalizedOrder> = {}): NormalizedOrder => ({
  externalId: id, country: "FR", orderedAt: "2026-11-10T09:00:00Z", status: "shipped", currency: "EUR",
  items: [{ sku: "A", quantity: 2, revenueHtCents: 10_000 }, { sku: "B", quantity: 1, revenueHtCents: 30_000 }], ...over,
});

describe("métriques journalières depuis les données des connecteurs", () => {
  const base = { fees: [], ads: [], returns: [], unitCost: (sku: string) => (sku === "A" ? 2_000 : null), eurPerUnit: () => 1.2 };

  it("CA, unités, commandes, coût d'achat ; annulées exclues ; devises converties au taux du jour", () => {
    const res = buildDailyMetrics({
      ...base,
      orders: [order("1"), order("2", { status: "cancelled" }), order("3", { country: "CH", currency: "CHF", items: [{ sku: "A", quantity: 1, revenueHtCents: 5_000 }] })],
    });
    const a = res.rows.find((r) => r.country === "FR" && r.sku === "A")!;
    expect(a).toMatchObject({ units: 2, orders: 1, revenueHt: 10_000, cogs: 4_000 });
    expect(res.rows.find((r) => r.country === "CH")!.revenueHt).toBe(6_000);
    expect(res.missingCosts).toEqual(["B"]);
  });

  it("frais et pub : au SKU, à la commande, au jour, sinon non affectés", () => {
    const res = buildDailyMetrics({
      ...base,
      orders: [order("1")],
      fees: [
        { date: "2026-11-10", country: "FR", type: "commission", amountCents: 6_000, currency: "EUR", orderExternalId: "1" },
        { date: "2026-11-10", country: "FR", type: "logistics", amountCents: 500, currency: "EUR", sku: "A" },
      ],
      ads: [
        { date: "2026-11-10", country: "FR", campaignExternalId: "c", campaignName: "SP", spendCents: 4_000, currency: "EUR", attributedSalesCents: 0 },
        { date: "2026-11-10", country: "DE", campaignExternalId: "d", campaignName: "SP DE", spendCents: 1_000, currency: "EUR", attributedSalesCents: 0 },
      ],
    });
    const [a, b] = res.rows;
    expect(a.commissions + b.commissions).toBe(6_000);
    expect(b.commissions).toBe(4_500);
    expect(a.logistics).toBe(500);
    expect(a.ads).toBe(1_000);
    expect(b.ads).toBe(3_000);
    expect(res.unallocated.ads).toBe(1_000);
  });

  it("retours : remboursement HT + frais - valeur restockée", () => {
    const res = buildDailyMetrics({
      ...base,
      orders: [order("1")],
      returns: [{ date: "2026-11-12", country: "FR", sku: "B", quantity: 1, refundHtCents: 30_000, returnFeesCents: 800, restockedValueCents: 20_000, currency: "EUR" }],
    });
    const r = res.rows.find((x) => x.date === "2026-11-12")!;
    expect(r).toMatchObject({ sku: "B", returns: 10_800, returnUnits: 1, revenueHt: 0 });
  });
});

describe("taux BCE", () => {
  const xml = `<gesmes:Envelope><Cube><Cube time='2026-11-13'><Cube currency='USD' rate='1.0800'/><Cube currency='CHF' rate='0.9300'/><Cube currency='BRL' rate='6.1'/></Cube></Cube></gesmes:Envelope>`;
  it("lit le flux quotidien et inverse les taux", () => {
    const fx = parseEcbDaily(xml);
    expect(fx.date).toBe("2026-11-13");
    expect(fx.rates.USD).toBeCloseTo(0.92592593, 7);
    expect(fx.rates.CHF).toBeCloseTo(1.07526882, 7);
    expect("BRL" in fx.rates).toBe(false);
  });
  it("prend le dernier taux publié (week-end)", () => {
    const h = [{ date: "2026-11-12", eurPerUnit: 0.9 }, { date: "2026-11-13", eurPerUnit: 0.91 }];
    expect(rateAt(h, "2026-11-15")).toBe(0.91);
    expect(rateAt(h, "2026-11-12")).toBe(0.9);
    expect(rateAt(h, "2026-11-01")).toBe(0.9);
  });
});
