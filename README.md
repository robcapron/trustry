# Trustry

Pilotage des marketplaces e-commerce : profit réel par canal, pays et SKU, alertes priorisées, 7 piliers, serveur MCP.

## Démarrer

```bash
pnpm install
pnpm dev            # http://localhost:3000, mode démo sans .env.local
```

Pour utiliser Supabase : copier `.env.example` en `.env.local` et renseigner l'URL et la clé publishable.

## Vérifier

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
pnpm test:db        # isolation multi-tenant (Postgres local)
```

Règles du projet : [CLAUDE.md](CLAUDE.md). Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
