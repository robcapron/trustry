# Architecture Trustry

## Vue d'ensemble

```
Chrome (équipe) / iPhone (PWA)          Claude (connecteur MCP)
            |                                     |
            v                                     v
   Vercel - app Next.js 16 : interface, serveur MCP (/api/mcp), point d'entrée Inngest
            |                                     |
            v                                     v
   Supabase : Postgres + RLS, Auth (+ OAuth 2.1 pour MCP), Vault     Inngest : synchro, alertes, scores
                                                                          |
                                                                          v
                         Sources : API marketplaces, Odoo (coûts d'achat), Google Drive (coûts transport), BCE (taux)
```

## Modèle de données

| Bloc | Tables | Rôle |
|---|---|---|
| Comptes | `organizations`, `organization_members`, `workspaces`, `workspace_members`, `invitations`, `profiles` | Agence > espaces clients, 4 rôles, modules accordés par membre |
| Connecteurs | `marketplaces`, `connections` (clés dans Vault), `stores`, `sync_runs` | Statut, fréquence, journal, quotas |
| Catalogue | `products`, `listings`, `inventory_snapshots`, `product_costs` | Fiches, blocages, stocks, coût d'achat |
| Ventes et coûts | `orders`, `order_items`, `fees`, `ad_campaigns`, `ad_spend_daily`, `returns`, `logistics_costs`, `fx_rates` | Briques du profit net |
| Pilotage | `daily_sku_metrics`, `alerts`, `alert_rules`, `pillar_scores`, `launches`, `customer_messages` | Dashboard, P&L, alertes, piliers |
| Import OMS | `oms_exports`, `oms_export_lines` | Historique partagé (module réservé) |
| MCP et sécurité | `api_keys`, `mcp_action_requests`, `audit_log` | Actions en attente de validation, traçabilité |

Conventions : montants en centimes entiers, devise d'origine + contre-valeur `*_eur_cents` (HT). `daily_sku_metrics.net_profit_eur_cents` est une colonne calculée. Aucune marge en € stockée.

## Sécurité

- RLS sur toutes les tables (`supabase/migrations`), fonctions d'accès dans le schéma `private`.
- Les synchronisations écrivent avec le rôle service (Inngest), les utilisateurs avec leur session.
- Identifiants marketplaces dans Supabase Vault, jamais en clair ni côté client.
- Import OMS servi par une route qui vérifie session + accès au module.
- Tests : `tests/db/rls.test.ts` (isolation entre clients, rôles, modules).

## Arborescence

```
src/
  app/
    connexion/, auth/            connexion email + mot de passe ou lien magique
    (app)/[espace]/              écrans d'un espace client (layout = navigation)
      dashboard, alertes, pnl, import-oms, piliers/[pilier], parametres/[onglet], plus
  components/trustry/            design system (boutons, cartes, statuts, états)
  components/layout/             navigation desktop, barre d'onglets iPhone, sélecteur d'espace
  domain/                        règles métier pures (profit, alertes, piliers, accès, devises)
  server/data/                   accès aux données (Supabase ou démo)
  server/demo/                   données d'exemple déterministes
  modules/import-oms/            outil HTML Import Commandes SDG (tel quel)
supabase/migrations/             schéma + RLS
tests/unit, tests/db, tests/e2e  Vitest, RLS sur Postgres, Playwright
design/                          maquettes de référence et charte
```
