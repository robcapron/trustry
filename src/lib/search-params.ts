import type { PnlFilters } from "@/domain/pnl";

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim().slice(0, 80) : undefined;
}

export function parsePnlFilters(params: Params): PnlFilters {
  return { canal: first(params.canal), pays: first(params.pays), marque: first(params.marque), q: first(params.q) };
}
