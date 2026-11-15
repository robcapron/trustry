import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { isAllowedRedirectUri, sha256Hex, verifyPkce, workspaceFromResource } from "@/domain/oauth";
import { authenticate, createAuthorizationCode, exchangeCode, refreshTokens, registerClient, type McpPrincipal } from "@/server/mcp/auth";
import { runWithMcpContext } from "@/server/mcp/context";
import { createTrustryMcpServer } from "@/server/mcp/server";
import { getDemoDataset } from "@/server/demo/store";
import { createFakeSupabase } from "./fake-supabase";

const verifier = "a".repeat(20) + "-B_c.d~" + "9".repeat(20);
const challenge = createHash("sha256").update(verifier).digest("base64url");

describe("OAuth 2.1 du serveur MCP", () => {
  it("règles pures : PKCE S256, URI de retour, ressource", () => {
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce(verifier, "autre")).toBe(false);
    expect(verifyPkce("court", challenge)).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:6274/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://evil.example/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://x.fr/cb#frag")).toBe(false);
    expect(workspaceFromResource("https://trustry.app/api/mcp/sdg-distribution")).toBe("sdg-distribution");
    expect(workspaceFromResource("https://trustry.app/autre")).toBeNull();
  });

  it("code à usage unique + PKCE -> jetons ; rotation du rafraîchissement ; accès retiré = jeton refusé", async () => {
    const { client, tables } = createFakeSupabase({
      workspaces: [{ id: "w1", slug: "sdg", name: "SDG", mcp_permission: "actions_with_approval" }],
      workspace_members: [{ workspace_id: "w1", user_id: "u1", role: "manager" }],
    });
    const clientId = await registerClient(client, { clientName: "Claude", redirectUris: ["https://claude.ai/cb"] });
    const code = await createAuthorizationCode(client, { clientId, userId: "u1", workspaceId: "w1", redirectUri: "https://claude.ai/cb", codeChallenge: challenge });
    expect(tables.get("oauth_codes")![0].code_hash).toBe(sha256Hex(code));

    await expect(exchangeCode(client, { code, clientId, redirectUri: "https://claude.ai/cb", codeVerifier: "x".repeat(43) })).rejects.toThrow(/PKCE/);
    const t = await exchangeCode(client, { code, clientId, redirectUri: "https://claude.ai/cb", codeVerifier: verifier });
    await expect(exchangeCode(client, { code, clientId, redirectUri: "https://claude.ai/cb", codeVerifier: verifier })).rejects.toThrow(/invalide|utilisé/);
    expect(tables.get("mcp_tokens")![0].token_hash).toBe(sha256Hex(t.access_token));

    const p = await authenticate(client, t.access_token);
    expect(p).toMatchObject({ userId: "u1", role: "manager", via: "oauth", workspace: { slug: "sdg", mcpPermission: "actions_with_approval" } });

    const t2 = await refreshTokens(client, { refreshToken: t.refresh_token, clientId });
    expect(await authenticate(client, t.access_token)).toBeNull();
    await expect(refreshTokens(client, { refreshToken: t.refresh_token, clientId })).rejects.toThrow();
    expect(await authenticate(client, t2.access_token)).not.toBeNull();

    tables.set("workspace_members", []);
    expect(await authenticate(client, t2.access_token)).toBeNull();
  });

  it("clé API Trustry : droits admin de l'espace, clé révoquée refusée", async () => {
    const key = "trs_live_secretdetest";
    const { client, tables } = createFakeSupabase({
      workspaces: [{ id: "w1", slug: "sdg", name: "SDG", mcp_permission: "read" }],
      api_keys: [{ id: "k1", workspace_id: "w1", key_hash: sha256Hex(key), revoked_at: null }],
    });
    expect(await authenticate(client, key)).toMatchObject({ role: "admin", via: "api_key", userId: null });
    tables.get("api_keys")![0].revoked_at = "2026-11-15T10:00:00Z";
    expect(await authenticate(client, key)).toBeNull();
  });
});

async function connect(principal: McpPrincipal) {
  const server = createTrustryMcpServer(principal);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(b);
  return client;
}

function principal(role: McpPrincipal["role"], level: McpPrincipal["workspace"]["mcpPermission"]): McpPrincipal {
  const ws = getDemoDataset().workspaces.find((w) => w.slug === "sdg-distribution")!;
  return { userId: "u1", role, via: "oauth", workspace: { id: ws.id, slug: ws.slug, name: ws.name, mcpPermission: level } };
}

const text = (r: unknown) => (r as { content: { text: string }[] }).content[0].text;

describe("outils MCP selon le rôle et le niveau d'accès", () => {
  it("lecture seule : aucun outil d'action ni d'import", async () => {
    const c = await connect(principal("viewer", "actions_auto"));
    const names = (await c.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(["etat_connecteurs", "lister_alertes", "pnl_detaille", "prevision_atterrissage", "resume_espace", "revue_mensuelle"]);
  });

  it("niveau lecture : imports autorisés pour un manager, pas d'actions", async () => {
    const names = (await (await connect(principal("manager", "read"))).listTools()).tools.map((t) => t.name);
    expect(names).toContain("importer_ventes");
    expect(names).not.toContain("changer_statut_alerte");
  });

  it("outils de lecture : montants en euros HT, marges en %, aucun tiret long", async () => {
    const c = await connect(principal("viewer", "read"));
    const resume = JSON.parse(text(await c.callTool({ name: "resume_espace", arguments: { periode: "mois" } })));
    expect(resume.ca_ht.valeur).toMatch(/€$/);
    expect(resume.marge_nette.valeur).toMatch(/%$/);
    const alertes = JSON.parse(text(await c.callTool({ name: "lister_alertes", arguments: {} })));
    expect(alertes[0].categorie).toBe("Référence bloquée");
    const pnl = JSON.parse(text(await c.callTool({ name: "pnl_detaille", arguments: { niveau: "pays", limite: 3 } })));
    expect(pnl.lignes).toHaveLength(3);
    const all = [resume, alertes, pnl].map((x) => JSON.stringify(x)).join("");
    expect(all.includes(String.fromCharCode(0x2014)) || all.includes(String.fromCharCode(0x2013))).toBe(false);
  });

  it("actions avec validation : une demande est créée, rien n'est exécuté", async () => {
    const p = principal("manager", "actions_with_approval");
    const { client: supa, tables } = createFakeSupabase();
    const c = await connect(p);
    const alert = getDemoDataset().alerts.find((a) => a.workspaceId === p.workspace.id && a.status !== "resolved")!;
    const before = alert.status;
    const res = await runWithMcpContext({ supabase: supa, workspaceId: p.workspace.id, userId: "u1" }, () =>
      c.callTool({ name: "changer_statut_alerte", arguments: { alerte_id: alert.id, statut: "resolved" } }),
    );
    expect(JSON.parse(text(res)).execute).toBe(false);
    expect(alert.status).toBe(before);
    expect(tables.get("mcp_action_requests")![0]).toMatchObject({ status: "pending", tool: "changer_statut_alerte" });
    expect(tables.get("audit_log")).toHaveLength(1);
  });

  it("import des ventes via Claude : conversion BCE, coût d'achat, connexion créée", async () => {
    const p = principal("admin", "read");
    const { client: supa, tables } = createFakeSupabase({
      fx_rates: [{ rate_date: "2026-11-13", currency: "PLN", eur_per_unit: 0.25 }],
      products: [{ id: "p1", workspace_id: p.workspace.id, sku: "ACTA-1" }],
      product_costs: [{ product_id: "p1", workspace_id: p.workspace.id, unit_cost_cents: 1000, valid_from: "2026-01-01" }],
    });
    const c = await connect(p);
    const res = await runWithMcpContext({ supabase: supa, workspaceId: p.workspace.id, userId: "u1" }, () =>
      c.callTool({
        name: "importer_ventes",
        arguments: { marketplace: "allegro", lignes: [{ date: "2026-11-14", pays: "PL", sku: "ACTA-1", unites: 2, ca_ht_centimes: 20000, devise: "PLN", commissions_centimes: 2000 }] },
      }),
    );
    expect(JSON.parse(text(res))).toMatchObject({ lignes_enregistrees: 1, sku_sans_cout_achat: 0 });
    expect(tables.get("daily_sku_metrics")![0]).toMatchObject({ revenue_ht_eur_cents: 5000, commissions_eur_cents: 500, cogs_eur_cents: 2000, units: 2 });
    expect(tables.get("connections")![0]).toMatchObject({ marketplace_code: "allegro", method: "mcp", status: "connected" });
    expect(tables.get("sync_runs")![0]).toMatchObject({ job: "claude", status: "success" });
  });
});
