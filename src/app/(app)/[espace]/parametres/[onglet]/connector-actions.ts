"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canManageMembers } from "@/domain/access";
import { CONNECTOR_SPECS, DATA_SCOPES, validateCredentials } from "@/domain/connector-fields";
import { MARKETPLACE_ORDER, MARKETPLACES } from "@/domain/marketplaces";
import { EVENTS, inngest } from "@/inngest/client";
import { isDemoMode } from "@/lib/env";
import { connectors, getCurrentUser, getWorkspace } from "@/server/data";
import { createSupabaseAdminClient, hasAdminAccess } from "@/server/supabase/admin";
import { runConnectionSync } from "@/server/sync/run-sync";
import type { MarketplaceCode } from "@/server/types";

export type ConnectorState = { ok?: string; error?: string; key?: string };

async function adminWorkspace(slug: string) {
  const [workspace, user] = await Promise.all([getWorkspace(slug), getCurrentUser()]);
  if (!workspace || !user || !canManageMembers(workspace.role)) return null;
  return { workspace, user };
}

function done(slug: string, state: ConnectorState): ConnectorState {
  revalidatePath(`/${slug}`, "layout");
  return state;
}

/** Lance la synchro : via Inngest en production, en direct pour la connexion de test sans Inngest. */
async function triggerSync(connectionId: string, workspaceId: string, adapter: string): Promise<string> {
  if (isDemoMode()) return "Synchro lancée (démo).";
  if (process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV) {
    await inngest.send({ name: EVENTS.syncConnection, data: { connectionId, workspaceId } });
    return "Synchro lancée.";
  }
  if (adapter === "mock" && hasAdminAccess()) {
    const res = await runConnectionSync(createSupabaseAdminClient(), connectionId);
    return res.status === "success" ? `Synchro terminée : ${res.rows} lignes.` : `Synchro : ${res.message ?? res.status}`;
  }
  return "Connexion enregistrée : la synchro démarrera avec le planificateur.";
}

const levelSchema = z.object({ espace: z.string(), niveau: z.enum(["read", "actions_with_approval", "actions_auto"]) });

export async function saveMcpLevel(_p: ConnectorState, formData: FormData): Promise<ConnectorState> {
  const parsed = levelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Requête invalide." };
  const ctx = await adminWorkspace(parsed.data.espace);
  if (!ctx) return { error: "Réservé au propriétaire ou à un admin." };
  await connectors.setMcpPermission(ctx.workspace.id, parsed.data.niveau);
  return done(parsed.data.espace, { ok: "Niveau d'accès de Claude mis à jour." });
}

export async function saveFrequency(_p: ConnectorState, formData: FormData): Promise<ConnectorState> {
  const espace = String(formData.get("espace") ?? "");
  const minutes = Number(formData.get("frequence"));
  if (![15, 60, 1440].includes(minutes)) return { error: "Fréquence invalide." };
  const ctx = await adminWorkspace(espace);
  if (!ctx) return { error: "Réservé au propriétaire ou à un admin." };
  await connectors.setSyncFrequency(ctx.workspace.id, minutes as 15 | 60 | 1440);
  return done(espace, { ok: "Fréquence enregistrée." });
}

export async function regenerateApiKey(_p: ConnectorState, formData: FormData): Promise<ConnectorState> {
  const espace = String(formData.get("espace") ?? "");
  const ctx = await adminWorkspace(espace);
  if (!ctx) return { error: "Réservé au propriétaire ou à un admin." };
  const { key } = await connectors.createApiKey(ctx.workspace.id, ctx.user.id);
  return done(espace, { ok: "Nouvelle clé créée. Copiez-la maintenant : elle ne sera plus affichée.", key });
}

function readConnectForm(formData: FormData) {
  const marketplace = String(formData.get("marketplace") ?? "") as MarketplaceCode;
  if (!MARKETPLACE_ORDER.includes(marketplace)) return null;
  const method = String(formData.get("methode") ?? "api");
  if (!["api", "mcp", "test"].includes(method)) return null;
  const spec = CONNECTOR_SPECS[marketplace];
  const values = Object.fromEntries(spec.fields.map((f) => [f.name, String(formData.get(f.name) ?? "").trim()]));
  const scopes = DATA_SCOPES.map((s) => s.key).filter((k) => formData.get(`scope_${k}`) === "on");
  return { marketplace, method: method as "api" | "mcp" | "test", spec, values, scopes };
}

/** Teste les identifiants sans les enregistrer (Mirakl : lecture du compte vendeur). */
export async function testConnection(_p: ConnectorState, formData: FormData): Promise<ConnectorState> {
  const form = readConnectForm(formData);
  if (!form) return { error: "Requête invalide." };
  const ctx = await adminWorkspace(String(formData.get("espace") ?? ""));
  if (!ctx) return { error: "Réservé au propriétaire ou à un admin." };
  if (form.method !== "api") return { ok: "Rien à tester pour cette méthode." };
  const invalid = validateCredentials(form.spec, form.values);
  if (invalid) return { error: invalid };
  if (form.spec.family !== "mirakl") return { ok: "Format valide. Le test en direct arrive avec le connecteur natif." };
  try {
    const res = await fetch(`${form.values.url.replace(/\/$/, "")}/api/account?shop_id=${encodeURIComponent(form.values.shop_id)}`, {
      headers: { Authorization: form.values.api_key, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { error: "Clé API refusée par Mirakl." };
    if (!res.ok) return { error: `Mirakl a répondu ${res.status}.` };
    const body = (await res.json()) as { shop_name?: string };
    return { ok: `Connexion réussie${body.shop_name ? ` : boutique ${body.shop_name}` : ""}.` };
  } catch {
    return { error: "Instance Mirakl injoignable : vérifiez l'URL." };
  }
}

export async function connectMarketplaceAction(_p: ConnectorState, formData: FormData): Promise<ConnectorState> {
  const form = readConnectForm(formData);
  const espace = String(formData.get("espace") ?? "");
  if (!form) return { error: "Requête invalide." };
  const ctx = await adminWorkspace(espace);
  if (!ctx) return { error: "Réservé au propriétaire ou à un admin." };
  if (form.method === "test" && process.env.TRUSTRY_ALLOW_DEMO_SEED !== "1" && !isDemoMode()) return { error: "Connexion de test désactivée sur cet environnement." };
  if (form.method === "api") {
    if (form.spec.family === "oauth") return { error: "Autorisation OAuth disponible avec le connecteur natif : connectez via Claude en attendant." };
    const invalid = validateCredentials(form.spec, form.values);
    if (invalid) return { error: invalid };
  }
  if (!form.scopes.length) return { error: "Choisissez au moins un type de données." };
  let message: string;
  try {
    const { connectionId, adapter } = await connectors.connect(ctx.workspace.id, {
      marketplace: form.marketplace,
      method: form.method,
      credentials: form.method === "api" ? form.values : null,
      scopes: form.scopes,
    });
    const name = MARKETPLACES[form.marketplace].name;
    message =
      form.method === "mcp"
        ? `${name} relié via Claude : les données arriveront à la prochaine synchro Claude.`
        : `${name} connecté. ${await triggerSync(connectionId, ctx.workspace.id, adapter)}`;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Connexion impossible." };
  }
  revalidatePath(`/${espace}`, "layout");
  // La ligne passe en "Connecté" : on rouvre le panneau en mode gestion avec la confirmation
  redirect(`/${espace}/parametres/connecteurs?connecter=${form.marketplace}&ok=${encodeURIComponent(message)}#panneau`);
}

export async function syncNowAction(_p: ConnectorState, formData: FormData): Promise<ConnectorState> {
  const espace = String(formData.get("espace") ?? "");
  const connectionId = String(formData.get("connexion") ?? "");
  const ctx = await adminWorkspace(espace);
  if (!ctx) return { error: "Réservé au propriétaire ou à un admin." };
  const overview = await import("@/server/data").then((m) => m.getConnectorsOverview(ctx.workspace.id));
  const row = overview.rows.find((r) => r.connection?.id === connectionId);
  if (!row?.connection) return { error: "Connexion introuvable." };
  if (row.connection.method === "mcp") return { ok: "Connexion via Claude : lancez la synchro depuis Claude." };
  return done(espace, { ok: await triggerSync(connectionId, ctx.workspace.id, row.connection.adapter ?? "native") });
}

export async function disconnectAction(_p: ConnectorState, formData: FormData): Promise<ConnectorState> {
  const espace = String(formData.get("espace") ?? "");
  const ctx = await adminWorkspace(espace);
  if (!ctx) return { error: "Réservé au propriétaire ou à un admin." };
  await connectors.disconnect(ctx.workspace.id, String(formData.get("connexion") ?? ""));
  return done(espace, { ok: "Marketplace déconnectée. L'historique est conservé." });
}
