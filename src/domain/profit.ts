/**
 * Calcul du profit net. Tous les montants sont en centimes d'euro HT.
 * Profit net = CA HT - commissions - publicité - logistique - retours - coût d'achat
 * La marge est TOUJOURS exprimée en %, jamais en €.
 */

export type ProfitComponents = {
  revenueHt: number;
  commissions: number;
  ads: number;
  logistics: number;
  returns: number;
  cogs: number;
};

export const EMPTY_COMPONENTS: ProfitComponents = {
  revenueHt: 0,
  commissions: 0,
  ads: 0,
  logistics: 0,
  returns: 0,
  cogs: 0,
};

export function netProfit(c: ProfitComponents): number {
  return c.revenueHt - c.commissions - c.ads - c.logistics - c.returns - c.cogs;
}

/** Marge nette en % du CA HT, ou null si pas de CA. */
export function netMarginPercent(c: ProfitComponents): number | null {
  if (c.revenueHt === 0) return null;
  return (netProfit(c) / c.revenueHt) * 100;
}

/** TACoS = dépenses publicitaires / CA HT total, en %. Utilisé partout à la place de l'ACoS. */
export function tacosPercent(adsCents: number, revenueHtCents: number): number | null {
  if (revenueHtCents === 0) return null;
  return (adsCents / revenueHtCents) * 100;
}

export function sumComponents(rows: ProfitComponents[]): ProfitComponents {
  return rows.reduce<ProfitComponents>(
    (acc, r) => ({
      revenueHt: acc.revenueHt + r.revenueHt,
      commissions: acc.commissions + r.commissions,
      ads: acc.ads + r.ads,
      logistics: acc.logistics + r.logistics,
      returns: acc.returns + r.returns,
      cogs: acc.cogs + r.cogs,
    }),
    { ...EMPTY_COMPONENTS },
  );
}

/** Évolution en % entre deux valeurs (null si base nulle). */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
