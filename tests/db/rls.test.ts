/**
 * Tests d'isolation multi-tenant (RLS) sur un Postgres local.
 * Lancer avec TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
 * (la base trustry_rls_test est recréée à chaque exécution). Ignoré si la variable est absente.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_URL = process.env.TEST_DATABASE_URL;
const DB = "trustry_rls_test";
const root = path.resolve(__dirname, "../..");

const U = {
  robin: "00000000-0000-4000-8000-000000000001",
  camille: "00000000-0000-4000-8000-000000000002",
  lea: "00000000-0000-4000-8000-000000000003",
  intrus: "00000000-0000-4000-8000-000000000004",
  orgAdmin: "00000000-0000-4000-8000-000000000005",
};
const ORG = "10000000-0000-4000-8000-000000000001";
const WS_SDG = "20000000-0000-4000-8000-000000000001";
const WS_KRAKEN = "20000000-0000-4000-8000-000000000002";
const ORG2 = "10000000-0000-4000-8000-000000000002";
const WS_OTHER = "20000000-0000-4000-8000-000000000003";

let db: Client;

async function asUser<T>(userId: string, fn: (c: Client) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
    return await fn(db);
  } finally {
    await db.query("rollback");
  }
}

const suite = ADMIN_URL ? describe : describe.skip;

suite("RLS multi-tenant", () => {
  beforeAll(async () => {
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`drop database if exists ${DB} with (force)`);
    await admin.query(`create database ${DB}`);
    await admin.end();

    const url = new URL(ADMIN_URL!);
    url.pathname = `/${DB}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();
    await db.query(readFileSync(path.join(root, "supabase/tests/supabase-shim.sql"), "utf8"));
    for (const f of readdirSync(path.join(root, "supabase/migrations")).sort()) {
      await db.query(readFileSync(path.join(root, "supabase/migrations", f), "utf8"));
    }

    // Jeu d'essai (en superutilisateur, comme une synchro avec le rôle service)
    for (const [name, id] of Object.entries(U)) {
      await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, `${name}@test.fr`, { full_name: name }]);
    }
    await db.query("insert into organizations (id, name, slug) values ($1, 'SDG', 'sdg'), ($2, 'Autre agence', 'autre')", [ORG, ORG2]);
    await db.query("insert into organization_members (organization_id, user_id, role) values ($1, $2, 'admin')", [ORG, U.orgAdmin]);
    await db.query(
      `insert into workspaces (id, organization_id, name, slug, enabled_modules) values
       ($1, $4, 'SDG Distribution', 'sdg-distribution', '{import-oms}'),
       ($2, $4, 'Kraken', 'kraken', '{}'),
       ($3, $5, 'Concurrent', 'concurrent', '{import-oms}')`,
      [WS_SDG, WS_KRAKEN, WS_OTHER, ORG, ORG2],
    );
    await db.query(
      `insert into workspace_members (workspace_id, user_id, role, granted_modules) values
       ($1, $3, 'owner', '{}'), ($1, $4, 'manager', '{import-oms}'), ($1, $5, 'viewer', '{}'),
       ($2, $3, 'owner', '{}'), ($6, $7, 'owner', '{}')`,
      [WS_SDG, WS_KRAKEN, U.robin, U.camille, U.lea, WS_OTHER, U.intrus],
    );
    await db.query(
      `insert into alerts (workspace_id, severity, category, title, dedupe_key) values
       ($1, 'critical', 'blocked_listing', 'Bloquée SDG', 'a1'),
       ($2, 'info', 'sync', 'Kraken', 'a2'),
       ($3, 'critical', 'stockout', 'Concurrent', 'a3')`,
      [WS_SDG, WS_KRAKEN, WS_OTHER],
    );
    await db.query(
      `insert into oms_export_lines (workspace_id, marketplace, order_ref) values ($1, 'decathlon', 'CMD-1'), ($2, 'decathlon', 'CMD-X')`,
      [WS_SDG, WS_OTHER],
    );
  });

  async function seedMetrics(ws: string, suffix: string) {
    const conn = await db.query("insert into connections (workspace_id, marketplace_code, status) values ($1, 'decathlon', 'connected') returning id", [ws]);
    const store = await db.query("insert into stores (workspace_id, connection_id, country, currency) values ($1, $2, 'FR', 'EUR') returning id", [ws, conn.rows[0].id]);
    const product = await db.query("insert into products (workspace_id, sku, title) values ($1, $2, 'Produit') returning id", [ws, `SKU-${suffix}`]);
    await db.query(
      `insert into daily_sku_metrics (workspace_id, metric_date, store_id, product_id, units, orders_count, revenue_ht_eur_cents, commissions_eur_cents, cogs_eur_cents)
       values ($1, '2026-11-10', $2, $3, 2, 2, 10000, 1500, 4000)`,
      [ws, store.rows[0].id, product.rows[0].id],
    );
  }

  it("les agrégats SQL respectent la RLS de l'appelant", async () => {
    await seedMetrics(WS_SDG, "SDG");
    await seedMetrics(WS_OTHER, "OTHER");
    const own = await asUser(U.lea, (c) => c.query("select * from metrics_daily($1, '2026-11-01', '2026-11-15')", [WS_SDG]));
    expect(own.rows).toHaveLength(1);
    expect(Number(own.rows[0].revenue)).toBe(10000);
    const channel = await asUser(U.lea, (c) => c.query("select * from metrics_by_channel($1, '2026-11-01', '2026-11-15')", [WS_SDG]));
    expect(channel.rows[0].marketplace).toBe("decathlon");
    const sku = await asUser(U.lea, (c) => c.query("select * from metrics_by_sku_store($1, '2026-11-01', '2026-11-15')", [WS_SDG]));
    expect(sku.rows[0].sku).toBe("SKU-SDG");
    const other = await asUser(U.lea, (c) => c.query("select * from metrics_daily($1, '2026-11-01', '2026-11-15')", [WS_OTHER]));
    expect(other.rows).toHaveLength(0);
    const net = await db.query("select net_profit_eur_cents from daily_sku_metrics where workspace_id = $1", [WS_SDG]);
    expect(Number(net.rows[0].net_profit_eur_cents)).toBe(4500);
  });

  it("une invitation fait rejoindre l'espace avec le rôle et les modules prévus, une seule fois", async () => {
    const token = "jeton-secret-de-test";
    await db.query(
      "insert into invitations (workspace_id, email, role, granted_modules, token_hash) values ($1, 'intrus@test.fr', 'manager', '{import-oms}', encode(sha256(convert_to($2, 'UTF8')), 'hex'))",
      [WS_SDG, token],
    );
    // Mauvais email : refus
    await expect(
      asUser(U.orgAdmin, async (c) => {
        await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.orgAdmin, email: "orgadmin@test.fr" })]);
        return c.query("select accept_invitation($1)", [token]);
      }),
    ).rejects.toThrow(/autre adresse/);
    // Bon email : accepté (on valide dans la transaction)
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.intrus, email: "intrus@test.fr" })]);
    const res = await db.query("select accept_invitation($1) as slug", [token]);
    expect(res.rows[0].slug).toBe("sdg-distribution");
    const seen = await db.query("select slug from workspaces order by slug");
    expect(seen.rows.map((r) => r.slug)).toContain("sdg-distribution");
    const oms = await db.query("select private.can_use_module($1, 'import-oms') as ok", [WS_SDG]);
    expect(oms.rows[0].ok).toBe(true);
    await expect(db.query("select accept_invitation($1)", [token])).rejects.toThrow(/déjà utilisée/);
    await db.query("rollback");
  });

  afterAll(async () => {
    await db?.end();
  });

  it("chaque utilisateur ne voit que ses espaces", async () => {
    const robin = await asUser(U.robin, (c) => c.query("select slug from workspaces order by slug"));
    expect(robin.rows.map((r) => r.slug)).toEqual(["kraken", "sdg-distribution"]);
    const lea = await asUser(U.lea, (c) => c.query("select slug from workspaces"));
    expect(lea.rows.map((r) => r.slug)).toEqual(["sdg-distribution"]);
    const intrus = await asUser(U.intrus, (c) => c.query("select slug from workspaces"));
    expect(intrus.rows.map((r) => r.slug)).toEqual(["concurrent"]);
  });

  it("un admin d'organisation voit tous les espaces de son organisation, pas ceux des autres", async () => {
    const r = await asUser(U.orgAdmin, (c) => c.query("select slug from workspaces order by slug"));
    expect(r.rows.map((x) => x.slug)).toEqual(["kraken", "sdg-distribution"]);
  });

  it("les données métier sont cloisonnées par workspace_id", async () => {
    const r = await asUser(U.robin, (c) => c.query("select title from alerts order by title"));
    expect(r.rows.map((x) => x.title)).toEqual(["Bloquée SDG", "Kraken"]);
    const i = await asUser(U.intrus, (c) => c.query("select title from alerts"));
    expect(i.rows.map((x) => x.title)).toEqual(["Concurrent"]);
  });

  it("la lecture seule ne peut pas écrire", async () => {
    await expect(
      asUser(U.lea, (c) =>
        c.query("insert into alerts (workspace_id, severity, category, title, dedupe_key) values ($1, 'info', 'other', 'x', 'x')", [WS_SDG]),
      ),
    ).rejects.toThrow(/row-level security/);
    const upd = await asUser(U.lea, (c) => c.query("update alerts set status = 'resolved' where workspace_id = $1", [WS_SDG]));
    expect(upd.rowCount).toBe(0);
  });

  it("un manager peut traiter une alerte de son espace mais pas d'un autre", async () => {
    const ok = await asUser(U.camille, (c) => c.query("update alerts set status = 'in_progress' where workspace_id = $1", [WS_SDG]));
    expect(ok.rowCount).toBe(1);
    const ko = await asUser(U.camille, (c) => c.query("update alerts set status = 'resolved' where workspace_id = $1", [WS_OTHER]));
    expect(ko.rowCount).toBe(0);
  });

  it("impossible d'insérer des données dans l'espace d'un autre client", async () => {
    await expect(
      asUser(U.robin, (c) =>
        c.query("insert into alerts (workspace_id, severity, category, title, dedupe_key) values ($1, 'info', 'other', 'x', 'y')", [WS_OTHER]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("Import OMS : accès réservé aux membres autorisés", async () => {
    const owner = await asUser(U.robin, (c) => c.query("select order_ref from oms_export_lines"));
    expect(owner.rows.map((r) => r.order_ref)).toEqual(["CMD-1"]);
    const granted = await asUser(U.camille, (c) => c.query("select order_ref from oms_export_lines"));
    expect(granted.rows.map((r) => r.order_ref)).toEqual(["CMD-1"]);
    const viewer = await asUser(U.lea, (c) => c.query("select order_ref from oms_export_lines"));
    expect(viewer.rows).toEqual([]);
  });

  it("seuls owner/admin gèrent les membres, et personne ne s'auto-promeut propriétaire", async () => {
    const byManager = await asUser(U.camille, (c) =>
      c.query("update workspace_members set role = 'admin' where workspace_id = $1 and user_id = $2", [WS_SDG, U.camille]),
    );
    expect(byManager.rowCount).toBe(0);
    const grant = await asUser(U.robin, (c) =>
      c.query("update workspace_members set granted_modules = '{import-oms}' where workspace_id = $1 and user_id = $2", [WS_SDG, U.lea]),
    );
    expect(grant.rowCount).toBe(1);
  });

  it("les identifiants des connecteurs ne sont modifiables que par owner/admin", async () => {
    await expect(
      asUser(U.camille, (c) => c.query("insert into connections (workspace_id, marketplace_code) values ($1, 'bol')", [WS_SDG])),
    ).rejects.toThrow(/row-level security/);
    const ok = await asUser(U.robin, (c) =>
      c.query("insert into connections (workspace_id, marketplace_code) values ($1, 'bol') returning id", [WS_SDG]),
    );
    expect(ok.rowCount).toBe(1);
  });

  it("un utilisateur anonyme ne voit rien", async () => {
    await db.query("begin");
    try {
      await db.query("set local role anon");
      await expect(db.query("select * from workspaces")).resolves.toMatchObject({ rowCount: 0 });
    } finally {
      await db.query("rollback");
    }
  });
});
