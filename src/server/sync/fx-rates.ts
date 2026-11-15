import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ECB_DAILY_URL, parseEcbDaily } from "@/domain/fx";

/** Récupère les taux BCE du jour et les enregistre (idempotent). */
export async function updateEcbRates(supabase: SupabaseClient, fetcher: typeof fetch = fetch) {
  const res = await fetcher(ECB_DAILY_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`BCE indisponible (${res.status})`);
  const { date, rates } = parseEcbDaily(await res.text());
  const rows = Object.entries(rates).map(([currency, eur]) => ({ rate_date: date, currency, eur_per_unit: eur, source: "BCE" }));
  const { error } = await supabase.from("fx_rates").upsert(rows, { onConflict: "rate_date,currency" });
  if (error) throw new Error(`fx_rates : ${error.message}`);
  return { date, currencies: rows.length };
}
