import { describe, expect, it } from "vitest";
import { compareAlerts } from "@/domain/alerts";
import { DEFAULT_RULES, detectConnections, detectSalesDrops, detectStock, detectTacos, evaluateAlerts, type ListingInput } from "@/domain/alert-engine";

const NBSP = new RegExp(`[${String.fromCharCode(0xa0)}${String.fromCharCode(0x202f)}]`, "g");
const plain = (v: string) => v.replace(NBSP, " ");

const listing = (sku: string, over: Partial<ListingInput> = {}): ListingInput => ({
  sku, storeKey: "amazon_eu:DE", storeLabel: "Amazon DE", brand: "ACTA", status: "blocked", blockReason: "Informations GPSR manquantes", dailyRevenueCents: 10_000, ...over,
});

describe("moteur d'alertes", () => {
  it("regroupe les références bloquées par boutique et motif, toujours en critique", () => {
    const out = evaluateAlerts({
      now: "2026-11-15T10:00:00Z", rules: DEFAULT_RULES,
      listings: [listing("A"), listing("B", { dailyRevenueCents: 30_000 }), listing("C", { status: "active" })],
      stock: [], sales: [], ads: [], connections: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ severity: "critical", category: "blocked_listing", pillar: 4, subjects: ["B", "A"], revenueAtRiskCents: 280_000 });
    expect(plain(out[0].title)).toBe("2 références ACTA bloquées sur Amazon DE");
  });

  it("le blocage passe avant la rupture, même avec moins de CA à risque", () => {
    const [blocked] = evaluateAlerts({ now: "2026-11-15T10:00:00Z", rules: DEFAULT_RULES, listings: [listing("A", { dailyRevenueCents: 1 })], stock: [], sales: [], ads: [], connections: [] });
    const [stock] = detectStock([{ sku: "S", quantity: 0, dailyUnits: 5, dailyRevenueCents: 500_000, channels: 4 }], DEFAULT_RULES);
    const asSort = (a: typeof blocked) => ({ ...a, revenueAtRiskCents: a.revenueAtRiskCents, createdAt: new Date("2026-11-15") });
    expect(compareAlerts(asSort(blocked), asSort(stock))).toBeLessThan(0);
    expect(stock.title).toBe("Rupture sur 4 canaux");
  });

  it("stock bas sous la couverture minimale, ignoré sans ventes récentes", () => {
    const out = detectStock(
      [
        { sku: "LOW", quantity: 9, dailyUnits: 3, dailyRevenueCents: 9_000, channels: 1 },
        { sku: "OK", quantity: 90, dailyUnits: 3, dailyRevenueCents: 9_000, channels: 1 },
        { sku: "DORMANT", quantity: 0, dailyUnits: 0, dailyRevenueCents: 0, channels: 1 },
      ],
      DEFAULT_RULES,
    );
    expect(out.map((a) => a.subjects[0])).toEqual(["LOW"]);
    expect(out[0].severity).toBe("important");
    expect(out[0].title).toBe("Stock bas : 3 jours de couverture");
  });

  it("chute de ventes : cite les SKU quand ils expliquent la baisse", () => {
    const [a] = detectSalesDrops(
      [{ storeKey: "decathlon:FR", storeLabel: "Décathlon FR", previous: { X: 50_000, Y: 30_000, Z: 20_000 }, current: { X: 5_000, Y: 30_000, Z: 20_000 } }],
      DEFAULT_RULES,
    );
    expect(a).toMatchObject({ scope: "sku", subjects: ["X"], pillar: 2, revenueAtRiskCents: 45_000 });
    expect(plain(a.title)).toMatch(/^Décathlon FR : ventes -45 %/);
  });

  it("chute de ventes diffuse : liée au compte", () => {
    const prev = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`S${i}`, 10_000]));
    const cur = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`S${i}`, 6_000]));
    const [a] = detectSalesDrops([{ storeKey: "kaufland:DE", storeLabel: "Kaufland DE", previous: prev, current: cur }], DEFAULT_RULES);
    expect(a).toMatchObject({ scope: "account", subjects: ["Compte Kaufland DE"], pillar: 6, severity: "important" });
    expect(a.detail).toMatch(/^Baisse liée au compte/);
    expect(detectSalesDrops([{ storeKey: "k", storeLabel: "K", previous: { A: 100 }, current: { A: 90 } }], DEFAULT_RULES)).toHaveLength(0);
  });

  it("TACoS au-dessus de la cible", () => {
    const out = detectTacos(
      [{ marketplace: "amazon_eu", label: "Amazon FR", adsCents: 12_800, revenueCents: 100_000 }, { marketplace: "decathlon", label: "Décathlon", adsCents: 3_000, revenueCents: 100_000 }],
      DEFAULT_RULES,
    );
    expect(out).toHaveLength(1);
    expect(plain(out[0].title)).toBe("TACoS Amazon FR à 12,8 % (cible 10,0 %)");
    expect(out[0].revenueAtRiskCents).toBe(2_800);
  });

  it("connecteurs : accès qui expire, erreur, retard", () => {
    const out = detectConnections(
      [
        { marketplace: "tiktok", label: "TikTok Shop", status: "connected", lastSyncAt: "2026-11-15T09:50:00Z", syncFrequencyMinutes: 15, tokenExpiresAt: "2026-11-17T10:00:00Z", lastError: null },
        { marketplace: "ebay", label: "eBay", status: "error", lastSyncAt: null, syncFrequencyMinutes: 15, tokenExpiresAt: null, lastError: "401 Unauthorized" },
        { marketplace: "allegro", label: "Allegro", status: "connected", lastSyncAt: "2026-11-15T04:00:00Z", syncFrequencyMinutes: 60, tokenExpiresAt: null, lastError: null },
      ],
      "2026-11-15T10:00:00Z",
    );
    expect(out.map((a) => [a.dedupeKey, a.severity])).toEqual([
      ["token:tiktok", "important"],
      ["sync-error:ebay", "important"],
      ["sync-late:allegro", "info"],
    ]);
    expect(out[0].title).toBe("Accès TikTok Shop expire dans 2 jours");
  });
});
