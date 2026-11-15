-- Trustry - tables métier
-- Conventions :
--   * montants en centimes entiers (bigint), devise d'origine + contre-valeur en centimes d'euro HT (*_eur_cents)
--   * aucune marge stockée en € : la marge est toujours calculée en % à l'affichage
--   * workspace_id sur chaque table, RLS appliquée en fin de fichier

create type public.connection_status as enum ('connected', 'syncing', 'error', 'not_connected');
create type public.connection_method as enum ('api', 'mcp');
create type public.listing_status as enum ('active', 'blocked', 'deleted', 'inactive');
create type public.fee_type as enum ('commission', 'advertising', 'logistics', 'return', 'other');
create type public.alert_severity as enum ('critical', 'important', 'info');
create type public.alert_status as enum ('todo', 'in_progress', 'resolved');
create type public.alert_scope as enum ('sku', 'account');

-- Référentiels globaux (lecture seule pour les utilisateurs) ----------------
create table public.marketplaces (
  code text primary key,
  name text not null,
  api_label text not null,
  countries text[] not null default '{}',
  sort_order int not null default 0
);

create table public.fx_rates (
  rate_date date not null,
  currency char(3) not null,
  eur_per_unit numeric(18, 8) not null check (eur_per_unit > 0),
  source text not null default 'BCE',
  primary key (rate_date, currency)
);

-- Connecteurs -------------------------------------------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  marketplace_code text not null references public.marketplaces (code),
  method public.connection_method not null default 'api',
  status public.connection_status not null default 'not_connected',
  -- identifiants chiffrés dans Supabase Vault : on ne stocke que la référence
  credentials_secret_id uuid,
  sync_frequency_minutes int not null default 15 check (sync_frequency_minutes in (15, 60, 1440)),
  data_scopes text[] not null default '{orders,catalog,inventory,returns,finances}',
  sync_progress smallint check (sync_progress between 0 and 100),
  last_sync_at timestamptz,
  token_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (workspace_id, marketplace_code)
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  country char(2) not null,
  currency char(3) not null,
  external_shop_id text,
  unique (connection_id, country)
);
create index on public.stores (workspace_id);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  job text not null,
  status text not null check (status in ('running', 'success', 'error', 'rate_limited')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_upserted int not null default 0,
  quota_remaining int,
  error text
);
create index on public.sync_runs (workspace_id, started_at desc);

-- Catalogue -----------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sku text not null,
  brand text not null default '',
  title text not null,
  ean text,
  created_at timestamptz not null default now(),
  unique (workspace_id, sku)
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  external_id text,
  status public.listing_status not null default 'active',
  block_reason text,
  quality_score smallint check (quality_score between 0 and 100),
  price_cents bigint,
  currency char(3),
  updated_at timestamptz not null default now(),
  unique (product_id, store_id)
);
create index on public.listings (workspace_id, status);

create table public.inventory_snapshots (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  snapshot_date date not null,
  quantity int not null,
  primary key (product_id, snapshot_date)
);
create index on public.inventory_snapshots (workspace_id, snapshot_date);

create table public.product_costs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  unit_cost_cents bigint not null check (unit_cost_cents >= 0),
  currency char(3) not null default 'EUR',
  valid_from date not null,
  source text not null check (source in ('odoo', 'csv', 'manual')),
  unique (product_id, valid_from)
);

-- Ventes et coûts -------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  external_id text not null,
  ordered_at timestamptz not null,
  status text not null,
  currency char(3) not null,
  tracking_number text,
  unique (store_id, external_id)
);
create index on public.orders (workspace_id, ordered_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  quantity int not null check (quantity > 0),
  revenue_ht_cents bigint not null,
  revenue_ht_eur_cents bigint not null
);
create index on public.order_items (order_id);

create table public.fees (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  fee_date date not null,
  type public.fee_type not null,
  amount_cents bigint not null,
  currency char(3) not null,
  amount_eur_cents bigint not null
);
create index on public.fees (workspace_id, fee_date);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  external_id text not null,
  name text not null,
  kind text not null default 'SP',
  unique (store_id, external_id)
);

create table public.ad_spend_daily (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  spend_date date not null,
  spend_cents bigint not null,
  currency char(3) not null,
  spend_eur_cents bigint not null,
  attributed_sales_eur_cents bigint not null default 0,
  primary key (campaign_id, spend_date)
);
create index on public.ad_spend_daily (workspace_id, spend_date);

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  return_date date not null,
  quantity int not null default 1,
  -- coût d'un retour = remboursement HT + frais de retour - valeur restockée
  refund_ht_eur_cents bigint not null default 0,
  return_fees_eur_cents bigint not null default 0,
  restocked_value_eur_cents bigint not null default 0,
  reason text
);
create index on public.returns (workspace_id, return_date);

create table public.logistics_costs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  carrier text not null,
  cost_eur_cents bigint not null,
  cost_date date not null,
  source text not null default 'google_drive'
);
create index on public.logistics_costs (workspace_id, cost_date);

-- Pilotage -----------------------------------------------------------------------
-- Agrégat quotidien par boutique et SKU : source du Dashboard et du P&L.
create table public.daily_sku_metrics (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  metric_date date not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  units int not null default 0,
  orders_count int not null default 0,
  revenue_ht_eur_cents bigint not null default 0,
  commissions_eur_cents bigint not null default 0,
  ads_eur_cents bigint not null default 0,
  logistics_eur_cents bigint not null default 0,
  returns_eur_cents bigint not null default 0,
  cogs_eur_cents bigint not null default 0,
  net_profit_eur_cents bigint generated always as (
    revenue_ht_eur_cents - commissions_eur_cents - ads_eur_cents
    - logistics_eur_cents - returns_eur_cents - cogs_eur_cents
  ) stored,
  primary key (store_id, product_id, metric_date)
);
create index on public.daily_sku_metrics (workspace_id, metric_date);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  severity public.alert_severity not null,
  category text not null,
  pillar smallint check (pillar between 1 and 7),
  title text not null,
  detail text not null default '',
  scope public.alert_scope not null default 'sku',
  -- SKU concernés, ou libellé du compte si la baisse est liée au compte
  subjects text[] not null default '{}',
  revenue_at_risk_eur_cents bigint not null default 0,
  suggested_action text,
  status public.alert_status not null default 'todo',
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);
create unique index alerts_open_dedupe on public.alerts (workspace_id, dedupe_key) where status <> 'resolved';
create index on public.alerts (workspace_id, status);

create table public.alert_rules (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  sales_drop_percent numeric(5, 2) not null default 20,
  sales_drop_window_days int not null default 7,
  stock_cover_days int not null default 7,
  tacos_target_percent numeric(5, 2) not null default 10,
  updated_at timestamptz not null default now()
);

create table public.pillar_scores (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  score_date date not null,
  pillar smallint not null check (pillar between 1 and 7),
  score smallint not null check (score between 0 and 100),
  headline text not null default '',
  components jsonb not null default '{}'::jsonb,
  primary key (workspace_id, score_date, pillar)
);

create table public.launches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  launch_date date not null,
  target_units_90d int,
  gtm_steps jsonb not null default '[]'::jsonb
);

create table public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  received_at timestamptz not null,
  responded_at timestamptz,
  subject text not null default '',
  status text not null default 'open'
);

-- Import OMS (historique partagé, module réservé) --------------------------------
create table public.oms_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  file_name text not null,
  order_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.oms_export_lines (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  marketplace text not null,
  order_ref text not null,
  export_id uuid references public.oms_exports (id) on delete set null,
  exported_at timestamptz not null default now(),
  primary key (workspace_id, marketplace, order_ref)
);

-- MCP et sécurité ----------------------------------------------------------------
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table public.mcp_action_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  tool text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log (workspace_id, created_at desc);

-- RLS --------------------------------------------------------------------------------
alter table public.marketplaces enable row level security;
alter table public.fx_rates enable row level security;
create policy marketplaces_read on public.marketplaces for select to authenticated using (true);
create policy fx_rates_read on public.fx_rates for select to authenticated using (true);

-- Tables métier : lecture pour tout membre, écriture pour owner/admin/manager.
-- Les synchronisations écrivent avec le rôle service (qui contourne la RLS).
do $$
declare
  t text;
begin
  foreach t in array array[
    'connections', 'stores', 'sync_runs', 'products', 'listings', 'inventory_snapshots',
    'product_costs', 'orders', 'order_items', 'fees', 'ad_campaigns', 'ad_spend_daily',
    'returns', 'logistics_costs', 'daily_sku_metrics', 'alerts', 'alert_rules',
    'pillar_scores', 'launches', 'customer_messages'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_write(workspace_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_write(workspace_id)) with check (private.can_write(workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_write(workspace_id))', t || '_delete', t);
  end loop;
end
$$;

-- Les connecteurs (identifiants) ne sont modifiables que par owner/admin
drop policy connections_insert on public.connections;
drop policy connections_update on public.connections;
drop policy connections_delete on public.connections;
create policy connections_insert on public.connections for insert to authenticated with check (private.can_admin(workspace_id));
create policy connections_update on public.connections for update to authenticated using (private.can_admin(workspace_id)) with check (private.can_admin(workspace_id));
create policy connections_delete on public.connections for delete to authenticated using (private.can_admin(workspace_id));

-- Import OMS : réservé aux membres ayant accès au module
alter table public.oms_exports enable row level security;
alter table public.oms_export_lines enable row level security;
create policy oms_exports_rw on public.oms_exports for all to authenticated
  using (private.can_use_module(workspace_id, 'import-oms'))
  with check (private.can_use_module(workspace_id, 'import-oms'));
create policy oms_export_lines_rw on public.oms_export_lines for all to authenticated
  using (private.can_use_module(workspace_id, 'import-oms'))
  with check (private.can_use_module(workspace_id, 'import-oms'));

-- Clés API et actions MCP : owner/admin
alter table public.api_keys enable row level security;
alter table public.mcp_action_requests enable row level security;
alter table public.audit_log enable row level security;
create policy api_keys_admin on public.api_keys for all to authenticated
  using (private.can_admin(workspace_id)) with check (private.can_admin(workspace_id));
create policy mcp_action_requests_select on public.mcp_action_requests for select to authenticated
  using (private.is_member(workspace_id));
create policy mcp_action_requests_decide on public.mcp_action_requests for update to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));
create policy audit_log_select on public.audit_log for select to authenticated
  using (private.can_admin(workspace_id));

-- Référentiel des marketplaces
insert into public.marketplaces (code, name, api_label, countries, sort_order) values
  ('amazon_eu', 'Amazon UE', 'SP-API + Ads API', '{FR,DE,IT,ES,NL,BE,PL,SE}', 1),
  ('amazon_us', 'Amazon US', 'SP-API + Ads API', '{US}', 2),
  ('amazon_jp_au', 'Amazon JP / AU', 'SP-API', '{JP,AU}', 3),
  ('decathlon', 'Décathlon', 'API Mirakl', '{FR,DE,ES,IT,BE}', 4),
  ('kaufland', 'Kaufland', 'API Kaufland', '{DE,CZ,SK}', 5),
  ('bol', 'Bol.com', 'Retailer API', '{NL,BE}', 6),
  ('cdiscount', 'Cdiscount', 'API Octopia', '{FR}', 7),
  ('ebay', 'eBay', 'OAuth eBay', '{FR,DE,IT,ES}', 8),
  ('allegro', 'Allegro', 'REST API', '{PL}', 9),
  ('tiktok_shop', 'TikTok Shop', 'Partner API', '{FR,DE,ES,IT}', 10),
  ('alltricks', 'Alltricks', 'API Mirakl', '{FR}', 11);
