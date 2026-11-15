-- Ajoute la marque aux agrégats par SKU (filtre du P&L détaillé).
drop function if exists public.metrics_by_sku_store(uuid, date, date);

create function public.metrics_by_sku_store(ws uuid, date_from date, date_to date)
returns table (
  product_id uuid, sku text, title text, brand text, store_id uuid, marketplace text, country text,
  revenue bigint, commissions bigint, ads bigint, logistics bigint, returns bigint, cogs bigint, units bigint, orders bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.sku, p.title, p.brand, s.id, c.marketplace_code, s.country::text,
    sum(m.revenue_ht_eur_cents)::bigint, sum(m.commissions_eur_cents)::bigint, sum(m.ads_eur_cents)::bigint,
    sum(m.logistics_eur_cents)::bigint, sum(m.returns_eur_cents)::bigint, sum(m.cogs_eur_cents)::bigint,
    sum(m.units)::bigint, sum(m.orders_count)::bigint
  from public.daily_sku_metrics m
  join public.products p on p.id = m.product_id
  join public.stores s on s.id = m.store_id
  join public.connections c on c.id = s.connection_id
  where m.workspace_id = ws and m.metric_date between date_from and date_to
  group by p.id, p.sku, p.title, p.brand, s.id, c.marketplace_code, s.country;
$$;

revoke execute on function public.metrics_by_sku_store(uuid, date, date) from public, anon;
grant execute on function public.metrics_by_sku_store(uuid, date, date) to authenticated;
