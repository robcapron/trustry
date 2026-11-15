/**
 * Configuration publique. Sans variables Supabase, l'application tourne en mode démo
 * (données d'exemple en mémoire, utilisateur fictif) : utile avant la mise en service
 * et pour les tests. TRUSTRY_DEMO=1 force le mode démo.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function isDemoMode(): boolean {
  if (process.env.TRUSTRY_DEMO === "1") return true;
  return !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY;
}
