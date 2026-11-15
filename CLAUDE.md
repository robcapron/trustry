# Trustry - règles du projet

SaaS multi-clients de pilotage des marketplaces e-commerce (profit réel, alertes, 7 piliers, serveur MCP).
Porteur : Robin Capron (SDG Distribution). Interface 100 % en français.

@AGENTS.md

## Règles métier (non négociables)

- Montants toujours en **€ HT**, jamais en TTC. Multi-devises (EUR, CHF, GBP, PLN, SEK, USD, JPY, AUD, CZK) converties en EUR (taux BCE du jour de la commande) pour les totaux.
- Marges toujours en **%**, jamais en €. Aucune marge stockée en base : elle se calcule à l'affichage.
- Profit net = CA HT - commissions marketplace - publicité - logistique - retours - coût d'achat (`src/domain/profit.ts`).
- Publicité : toujours le **TACoS** (dépenses pub / CA HT total), jamais l'ACoS.
- **Aucun tiret long ni demi-cadratin** dans le code, les textes, libellés ou données : uniquement `-`. Le test `tests/unit/no-long-dashes.test.ts` le vérifie, et `sanitizeDashes()` nettoie les sorties Intl.
- Pour cibler un tiret long dans le code (regex, tests), le construire par son code : `String.fromCharCode(0x2014)`. Ne jamais l'écrire en clair.
- Format FR partout via `src/lib/format.ts` : `1 234,56 €`, `21,4 %`, `-0,6 pt`. Ne jamais formater un nombre à la main.
- Référence bloquée = priorité absolue : une alerte de blocage passe toujours avant un réassort (`compareAlerts`).
- Chute de ventes : l'alerte doit identifier les SKU concernés ou indiquer que la baisse est liée au compte (`scope = 'account'`).
- Coût de retour = remboursement HT + frais de retour - valeur restockée.
- Revue mensuelle (`src/domain/monthly-review.ts`, reprise du Sheet "Mensu | Analyse") : 4 pôles à améliorer chaque mois, tous en taux "plus bas = mieux" : Acquisition (TACoS), Retours (unités retournées / unités vendues), Logistique (logistique / CA), Frais internes (OpEx / CA). Cibles dans `alert_rules`, OpEx et objectif de CA par mois dans `monthly_costs`. Marge nette de la revue = après OpEx.
- Prévision d'atterrissage (`src/domain/forecast.ts`) : réalisé des jours clos + jours restants au rythme des 14 derniers jours clos, corrigé du profil N-1 aligné à 364 jours (garde jours de semaine et Black Friday). Fourchette = moitié de l'écart entre les 2 méthodes, bornée 5 % - 12 %. Profit projeté à marge constante. Période « Trimestre » : atterrissage fin de trimestre, objectif = somme des 3 objectifs mensuels (affiché seulement si les 3 sont saisis).
- Objectifs SDG : ligne « CA Prévi » de l'onglet « 2026 Prévi » du Sheet Suivi Production Marketplace, importés dans `monthly_costs` (le chargement des données d'exemple ne remplace jamais un mois déjà saisi).

## Multi-tenant et accès

- Organisation (agence / distributeur) > espaces clients (`workspaces`) > membres (`workspace_members`).
- Rôles par espace : `owner` (Propriétaire), `admin`, `manager`, `viewer` (Lecture seule). Libellés dans `src/domain/access.ts`.
- Toutes les tables métier portent `workspace_id` + RLS (`supabase/migrations`). Lecture : membres. Écriture : owner/admin/manager. Connecteurs, clés API, membres : owner/admin.
- Fonctions d'accès SQL dans le schéma `private` (security definer, hors API) : `is_member`, `can_write`, `can_admin`, `can_use_module`.
- Modules optionnels (`workspaces.enabled_modules`) accordés membre par membre (`workspace_members.granted_modules`). Owner/admin y ont accès d'office.
- **Import OMS** : outil HTML existant de SDG, intégré **tel quel** (`src/modules/import-oms/`), servi par une route protégée (jamais dans `public/`). Activé uniquement sur l'espace SDG. Ne pas modifier le HTML sans demande explicite.
- Invitations : lien à usage unique (jeton haché sha256 en base), `accept_invitation` et `invitation_preview` sont security definer volontairement (protégés par le jeton et l'email) : l'avertissement de l'advisor Supabase est attendu.
- Identifiants marketplaces : `save_connection_credentials` (security definer, owner/admin, écriture seule dans Vault : avertissement advisor attendu) ; lecture déchiffrée `connection_credentials` réservée au rôle service (jobs).
- Serveur MCP (`/api/mcp/<espace>`, `src/server/mcp/`) : OAuth 2.1 maison (DCR `/api/oauth/register`, consentement `/oauth/autoriser` sur la session Supabase, code + PKCE S256 à usage unique, jetons `mcp_tokens` hachés, rotation au rafraîchissement) ou clé API Trustry (droits admin). Le rôle est relu à chaque appel. `oauth_clients` / `oauth_codes` : RLS sans policy (serveur seul, info advisor attendue). Les outils réutilisent la couche données via un client lié à l'espace autorisé (`runWithMcpContext`).
- Niveaux MCP (`workspaces.mcp_permission`) : `read` (lecture + imports pour owner/admin/manager), `actions_with_approval` (les actions créent des `mcp_action_requests` validées dans la page Alertes), `actions_auto` (changement de statut d'alerte exécuté directement). Les actions marketplace (débloquer, prix, enchères, réassort) restent des demandes tant qu'il n'y a pas de connecteur natif.
- Toute nouvelle table métier : ajouter `workspace_id`, l'ajouter à la boucle RLS ou écrire ses policies, et un test dans `tests/db/rls.test.ts`.

## Stack

- Next.js 16 (App Router, Turbopack, `proxy.ts` remplace `middleware.ts`, `params` asynchrones) + TypeScript strict. Lire `node_modules/next/dist/docs/` avant d'utiliser une API Next.
- `cacheComponents` désactivé volontairement (pages propres à chaque utilisateur, RLS).
- Tailwind CSS v4 (tokens dans `src/app/globals.css`), composants maison inspirés de shadcn/ui sur Radix (`radix-ui`), graphiques Recharts.
- Supabase : Postgres + Auth + RLS + Vault (identifiants marketplaces, jamais en clair). Projet dev : `trustry-dev`.
- Jobs : Inngest. Serveur MCP : SDK officiel `@modelcontextprotocol/sdk`, Streamable HTTP sans session, OAuth 2.1 adossé à Supabase Auth.
- Tests : Vitest (unitaires + RLS sur Postgres local), Playwright (parcours clés, desktop + iPhone).
- Déploiement : Vercel (équipe Trustry) + Supabase. PWA installable (Chrome et écran d'accueil iPhone).

## Architecture du code

- `src/domain/` : règles métier pures et testées (profit, alertes, piliers, accès, devises). Aucune dépendance à Next ou Supabase.
- `src/server/data/` : seule porte d'accès aux données pour les pages (Data Access Layer). Deux sources : Supabase (session utilisateur, RLS) et démo (`src/server/demo/`).
- Mode démo : actif sans variables Supabase ou avec `TRUSTRY_DEMO=1`. Données déterministes (`src/server/demo/seed.ts`), mois en cours de SDG calibré sur la maquette.
- `src/components/trustry/` : design system. `src/components/layout/` : navigation desktop et mobile.
- Agrégats : fonctions SQL `metrics_daily`, `metrics_by_channel`, `metrics_by_sku_store` (security invoker, RLS de l'appelant) ; même forme en mémoire pour la démo (`src/server/data/rollups.ts`). Le Dashboard est calculé par `buildDashboard` (`src/domain/dashboard.ts`).
- Périodes : `?periode=7j|mois|trimestre`, comparées à la période précédente équivalente (`src/domain/period.ts`).
- Connecteurs : interface `MarketplaceAdapter` (`src/server/connectors/types.ts`), données normalisées et calcul des métriques dans `src/domain/sync-metrics.ts` (commissions, pub, logistique au SKU sinon au prorata du CA ; retours ; coût d'achat ; taux BCE). `MockAdapter` = "Données de test" (`connections.adapter = 'mock'`). Sans connecteur natif, la connexion passe "Via Claude (MCP)".
- Jobs Inngest (`src/inngest/`, route `/api/inngest`) : planificateur 15 min, synchro par connexion (une à la fois), moteur d'alertes (après synchro + toutes les heures), taux BCE (jours ouvrés 16 h 30). Client service `src/server/supabase/admin.ts` (`SUPABASE_SECRET_KEY`), jamais pour une requête utilisateur.
- Moteur d'alertes `src/domain/alert-engine.ts` : blocages (critique, groupés par boutique et motif), ruptures / couverture < `stock_cover_days`, chutes de ventes (SKU qui expliquent >= 60 % de la baisse, 5 max, sinon `scope = 'account'`), TACoS > cible + 10 %, accès qui expire / erreur / retard. Clés de dédoublonnage stables ; résolution automatique quand la cause disparaît.

## Design system (DA Trustry, direction "Combo A+B")

- Référence : `design/mockups/*.html` et `.png`. Reproduire fidèlement, ne pas inventer de valeurs : ajouter un token dans `globals.css` si besoin.
- Couleurs : carbone `#111214`, fluo `#E4FF1A`, asphalte `#E9EAEC`, blanc, cartes `#F5F5F7`.
- Le jaune fluo ne s'utilise **jamais en texte sur fond clair** : seulement en fond sous du texte noir, ou en texte sur fond carbone.
- Statuts : critique `#B42318`, important / à surveiller `#B54708`, bon `#067647`, info `#175CD3`, toujours avec un libellé (`StatusBadge`).
- Typo : Inter pour l'interface, Archivo Black Italic réservé au logo et aux grands titres de marque (`font-brand`).
- Cartes arrondies 20 px sans bordure, boutons en pilule, beaucoup d'air, tableaux et graphiques denses.
- Desktop + iPhone (barre d'onglets en bas sous 1024 px), tablette utilisable. Chaque écran prévoit les états vide, chargement et erreur de synchro (`src/components/trustry/states.tsx`).
- Icônes : uniquement le jeu `src/components/trustry/icons.tsx` (tracés des maquettes).

## Commandes

```bash
pnpm dev                 # mode démo si pas de .env.local
pnpm test                # tests unitaires (+ RLS si TEST_DATABASE_URL est défini)
pnpm test:db             # RLS sur Postgres local (postgresql://postgres:postgres@localhost:5432/postgres)
pnpm test:e2e            # Playwright (démarre l'app en mode démo)
pnpm typecheck && pnpm lint && pnpm build
```

## Méthode de travail

- Avancer phase par phase. En fin de phase : ce qui est fait, comment le tester, ce qui reste.
- Toute migration SQL va dans `supabase/migrations/` (horodatée), est testée en local (`pnpm test:db`) puis appliquée sur Supabase.
- Ne jamais committer de secret (`.env*` ignoré). Les clés marketplaces vont dans Vault.
- Tenir ce fichier à jour à chaque décision structurante.

## Avancement

| Phase | Contenu | Statut |
|---|---|---|
| 0 | Repo, design system, layout et navigation (desktop + iPhone), auth, multi-tenant + RLS, données d'exemple, Import OMS intégré | Fait |
| 1 | Dashboard global + sélecteur d'espace (données mock) | Fait |
| 2 | P&L détaillé (canal > pays > SKU, filtres, export CSV) + Centre d'alertes + gestion des membres, accès et invitations | Fait |
| 3 | Revue mensuelle par pôle, prévision d'atterrissage, écran Connecteurs (maquette), interface connecteurs + MockAdapter, calcul du profit réel depuis les données brutes, moteur d'alertes, jobs Inngest, taux BCE, identifiants dans Vault. Reste : connecteurs natifs (Mirakl d'abord), imports Odoo / Drive, notifications push | Fait (socle) |
| 4 | Serveur MCP : 6 outils de lecture, actions avec validation (3 niveaux), imports pour la synchro via Claude (ventes, fiches et stock, coûts d'achat), OAuth 2.1 + clé API, validation des demandes dans Alertes | Fait |
| 5 | Les 7 modules piliers | A faire |
