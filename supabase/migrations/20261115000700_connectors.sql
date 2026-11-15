-- Connecteurs : type d'adaptateur, identifiants chiffrés dans Vault, journal de synchro.

alter table public.connections
  add column if not exists adapter text not null default 'native' check (adapter in ('native', 'mock'));

-- Enregistre (ou remplace) les identifiants d'une connexion dans Vault. Réservé owner/admin.
-- Les identifiants ne sont jamais stockés en clair ni relisibles par les utilisateurs.
create or replace function public.save_connection_credentials(target uuid, secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conn record;
begin
  select id, workspace_id, credentials_secret_id, marketplace_code into conn from public.connections where id = target;
  if conn.id is null or not private.can_admin(conn.workspace_id) then
    raise exception 'Connexion introuvable ou droits insuffisants' using errcode = '42501';
  end if;
  if length(coalesce(secret, '')) < 2 then
    raise exception 'Identifiants vides' using errcode = '22023';
  end if;
  if conn.credentials_secret_id is null then
    update public.connections
      set credentials_secret_id = vault.create_secret(secret, 'connection:' || conn.id::text, 'Identifiants ' || conn.marketplace_code),
          status = 'syncing', last_error = null
      where id = conn.id;
  else
    perform vault.update_secret(conn.credentials_secret_id, secret);
    update public.connections set status = 'syncing', last_error = null where id = conn.id;
  end if;
end;
$$;
revoke execute on function public.save_connection_credentials(uuid, text) from public, anon;
grant execute on function public.save_connection_credentials(uuid, text) to authenticated;

-- Lecture déchiffrée : uniquement pour les jobs de synchro (rôle service).
create or replace function public.connection_credentials(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from public.connections c
  join vault.decrypted_secrets s on s.id = c.credentials_secret_id
  where c.id = target;
$$;
revoke execute on function public.connection_credentials(uuid) from public, anon, authenticated;
grant execute on function public.connection_credentials(uuid) to service_role;

create index if not exists sync_runs_connection_started on public.sync_runs (connection_id, started_at desc);
