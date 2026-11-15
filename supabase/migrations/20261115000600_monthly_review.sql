-- Revue mensuelle par pôle (acquisition, retours, logistique, frais internes).

alter table public.daily_sku_metrics add column if not exists returns_units int not null default 0;

-- Cibles par pôle (le TACoS cible existe déjà)
alter table public.alert_rules
  add column if not exists returns_rate_target_percent numeric(5, 2) not null default 6,
  add column if not exists logistics_rate_target_percent numeric(5, 2) not null default 12,
  add column if not exists opex_rate_target_percent numeric(5, 2) not null default 1.5;

-- Plan mensuel : frais internes (OpEx) et objectif de CA
create table if not exists public.monthly_costs (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  opex_eur_cents bigint not null default 0,
  -- objectif de CA HT du mois (prévision d'atterrissage du Dashboard)
  revenue_target_eur_cents bigint check (revenue_target_eur_cents is null or revenue_target_eur_cents >= 0),
  note text,
  primary key (workspace_id, month)
);
alter table public.monthly_costs enable row level security;
create policy monthly_costs_select on public.monthly_costs for select to authenticated using (private.is_member(workspace_id));
create policy monthly_costs_write on public.monthly_costs for all to authenticated
  using (private.can_admin(workspace_id)) with check (private.can_admin(workspace_id));

-- Agrégat mensuel par marketplace et marque
create or replace function public.metrics_monthly(ws uuid, date_from date, date_to date)
returns table (
  month text, marketplace text, brand text,
  revenue bigint, commissions bigint, ads bigint, logistics bigint, returns bigint, cogs bigint,
  units bigint, orders bigint, returns_units bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select to_char(m.metric_date, 'YYYY-MM'), c.marketplace_code, p.brand,
    sum(m.revenue_ht_eur_cents)::bigint, sum(m.commissions_eur_cents)::bigint, sum(m.ads_eur_cents)::bigint,
    sum(m.logistics_eur_cents)::bigint, sum(m.returns_eur_cents)::bigint, sum(m.cogs_eur_cents)::bigint,
    sum(m.units)::bigint, sum(m.orders_count)::bigint, sum(m.returns_units)::bigint
  from public.daily_sku_metrics m
  join public.products p on p.id = m.product_id
  join public.stores s on s.id = m.store_id
  join public.connections c on c.id = s.connection_id
  where m.workspace_id = ws and m.metric_date between date_from and date_to
  group by 1, 2, 3;
$$;

revoke execute on function public.metrics_monthly(uuid, date, date) from public, anon;
grant execute on function public.metrics_monthly(uuid, date, date) to authenticated;
