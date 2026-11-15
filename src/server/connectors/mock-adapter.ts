/**
 * Connecteur de test : données déterministes (même connexion + même jour = mêmes données),
 * pour valider la chaîne complète synchro -> métriques -> alertes sans marketplace réelle.
 */
import { currencyForCountry } from "@/domain/money";
import { eachDay } from "@/domain/period";
import type { NormalizedAdSpend, NormalizedFee, NormalizedListing, NormalizedOrder, NormalizedReturn } from "@/domain/sync-metrics";
import { hashString, mulberry32 } from "@/server/demo/random";
import type { AdapterContext, DataScope, MarketplaceAdapter, NormalizedMessage } from "./types";

const FALLBACK_CATALOGUE = Array.from({ length: 12 }, (_, i) => ({
  sku: `TEST-SKU-${String(i + 1).padStart(2, "0")}`,
  title: `Produit de test ${i + 1}`,
  brand: i % 2 ? "ACTA" : "SIXTEN",
  priceHtCents: 2_500 + i * 900,
}));

/** Taux de change fictifs pour les devises hors EUR (le prix catalogue est en EUR HT). */
const LOCAL_PER_EUR: Record<string, number> = { PLN: 4.3, SEK: 11.4, CZK: 25, USD: 1.08, JPY: 162, AUD: 1.65, CHF: 0.93, GBP: 0.85 };

export class MockAdapter implements MarketplaceAdapter {
  readonly scopes: DataScope[] = ["orders", "catalog", "inventory", "prices", "ads", "finances", "returns", "messages"];
  readonly code;
  private readonly catalogue;

  constructor(private readonly ctx: AdapterContext) {
    this.code = ctx.marketplace;
    this.catalogue = ctx.catalogue.length ? ctx.catalogue.slice(0, 40) : FALLBACK_CATALOGUE;
  }

  private rand(...parts: string[]) {
    return mulberry32(hashString([this.ctx.connectionId, ...parts].join("|")));
  }

  private local(cents: number, country: string) {
    const cur = currencyForCountry(country);
    return Math.round(cents * (LOCAL_PER_EUR[cur] ?? 1));
  }

  async orders(range: { from: string; to: string }): Promise<NormalizedOrder[]> {
    const out: NormalizedOrder[] = [];
    for (const day of eachDay(range)) {
      for (const country of this.ctx.countries) {
        const rand = this.rand("orders", day, country);
        const n = Math.floor(rand() * 6) + (country === this.ctx.countries[0] ? 4 : 0);
        for (let i = 0; i < n; i++) {
          const p = this.catalogue[Math.floor(rand() * this.catalogue.length)];
          const qty = rand() < 0.85 ? 1 : 2;
          out.push({
            externalId: `${country}-${day.replaceAll("-", "")}-${i + 1}`,
            country,
            orderedAt: `${day}T${String(8 + Math.floor(rand() * 13)).padStart(2, "0")}:00:00Z`,
            status: rand() < 0.03 ? "cancelled" : day === range.to ? "pending" : "shipped",
            currency: currencyForCountry(country),
            items: [{ sku: p.sku, quantity: qty, revenueHtCents: this.local(p.priceHtCents * qty, country) }],
          });
        }
      }
    }
    return out;
  }

  async listings(): Promise<NormalizedListing[]> {
    return this.ctx.countries.flatMap((country) =>
      this.catalogue.map((p, i) => {
        const blocked = this.rand("listing", p.sku, country)() < 0.04 || (i === 0 && country === this.ctx.countries[0]);
        return {
          sku: p.sku,
          country,
          externalId: `${this.ctx.marketplace.toUpperCase()}-${p.sku}`,
          status: blocked ? ("blocked" as const) : ("active" as const),
          blockReason: blocked ? "Informations GPSR manquantes" : null,
          priceCents: this.local(Math.round(p.priceHtCents * 1.2), country),
          currency: currencyForCountry(country),
          title: p.title,
          brand: p.brand,
        };
      }),
    );
  }

  async inventory() {
    return this.catalogue.map((p, i) => ({ sku: p.sku, quantity: i === 1 ? 0 : Math.floor(this.rand("stock", p.sku, this.ctx.today)() * 80) }));
  }

  async ads(range: { from: string; to: string }): Promise<NormalizedAdSpend[]> {
    if (!this.ctx.marketplace.startsWith("amazon") && this.ctx.marketplace !== "decathlon") return [];
    return eachDay(range).flatMap((day) =>
      this.ctx.countries.slice(0, 2).map((country) => {
        const spend = this.local(Math.round(1_500 + this.rand("ads", day, country)() * 3_000), country);
        return { date: day, country, campaignExternalId: `SP-${country}`, campaignName: `SP ${country}`, spendCents: spend, currency: currencyForCountry(country), attributedSalesCents: spend * 5 };
      }),
    );
  }

  async finances(range: { from: string; to: string }): Promise<NormalizedFee[]> {
    // Commission de 15 % du CA HT, rattachée à chaque commande
    const orders = await this.orders(range);
    return orders
      .filter((o) => o.status !== "cancelled")
      .map((o) => ({
        date: o.orderedAt.slice(0, 10),
        country: o.country,
        type: "commission" as const,
        amountCents: Math.round(o.items.reduce((t, it) => t + it.revenueHtCents, 0) * 0.15),
        currency: o.currency,
        orderExternalId: o.externalId,
      }));
  }

  async returns(range: { from: string; to: string }): Promise<NormalizedReturn[]> {
    const orders = await this.orders(range);
    return orders
      .filter((o) => o.status === "shipped" && this.rand("return", o.externalId)() < 0.05)
      .map((o) => {
        const it = o.items[0];
        return {
          date: o.orderedAt.slice(0, 10),
          country: o.country,
          sku: it.sku,
          quantity: 1,
          refundHtCents: Math.round(it.revenueHtCents / it.quantity),
          returnFeesCents: this.local(600, o.country),
          restockedValueCents: Math.round((it.revenueHtCents / it.quantity) * 0.4),
          currency: o.currency,
          orderExternalId: o.externalId,
          reason: "Taille",
        };
      });
  }

  async messages(): Promise<NormalizedMessage[]> {
    return [];
  }

  async tokenExpiresAt() {
    return null;
  }

  quota() {
    return { remaining: null, resetAt: null };
  }
}
