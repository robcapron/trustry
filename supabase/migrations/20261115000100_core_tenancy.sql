-- Trustry - socle multi-tenant
-- Organisation (agence / distributeur) > espaces clients (workspaces) > membres.
-- Toutes les tables métier portent un workspace_id protégé par RLS.

create schema if not exists private;

-- Types ----------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'manager', 'viewer');
create type public.mcp_permission as enum ('read', 'actions_with_approval', 'actions_auto');

-- Profils utilisateurs ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

-- Organisations ----------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Espaces clients ----------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  base_currency char(3) not null default 'EUR',
  mcp_permission public.mcp_permission not null default 'read',
  enabled_modules text[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.workspaces (organization_id);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'viewer',
  -- modules accordés à ce membre (ex: 'import-oms'). Propriétaire et admin y ont accès d'office.
  granted_modules text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.member_role not null default 'viewer' check (role <> 'owner'),
  granted_modules text[] not null default '{}',
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.invitations (workspace_id);

-- Fonctions d'accès (security definer, hors API) ------------------------------
-- Un utilisateur accède à un espace s'il en est membre, ou s'il est owner/admin de l'organisation.

create or replace function private.workspace_role(ws uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select m.role from public.workspace_members m
      where m.workspace_id = ws and m.user_id = (select auth.uid())),
    (select om.role from public.organization_members om
      join public.workspaces w on w.organization_id = om.organization_id
      where w.id = ws and om.user_id = (select auth.uid()))
  );
$$;

create or replace function private.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.workspace_role(ws) is not null;
$$;

create or replace function private.has_role(ws uuid, roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.workspace_role(ws) = any (roles), false);
$$;

create or replace function private.can_write(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(ws, array['owner', 'admin', 'manager']::public.member_role[]);
$$;

create or replace function private.can_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(ws, array['owner', 'admin']::public.member_role[]);
$$;

create or replace function private.is_org_admin(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = org and om.user_id = (select auth.uid())
  );
$$;

-- Accès à un module (ex: 'import-oms') : activé sur l'espace + (owner/admin ou accordé au membre)
create or replace function private.can_use_module(ws uuid, module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and module = any (w.enabled_modules)
  )
  and (
    private.can_admin(ws)
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = ws and m.user_id = (select auth.uid()) and module = any (m.granted_modules)
    )
  );
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- RLS du socle ---------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;

-- Profils : soi-même + les membres des espaces partagés
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members a
      join public.workspace_members b on a.workspace_id = b.workspace_id
      where a.user_id = (select auth.uid()) and b.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Organisations : visibles si on a accès à au moins un de leurs espaces
create policy organizations_select on public.organizations for select to authenticated
  using (
    private.is_org_admin(id)
    or exists (select 1 from public.workspaces w where w.organization_id = organizations.id and private.is_member(w.id))
  );
create policy organizations_update on public.organizations for update to authenticated
  using (private.is_org_admin(id)) with check (private.is_org_admin(id));

create policy organization_members_select on public.organization_members for select to authenticated
  using (private.is_org_admin(organization_id) or user_id = (select auth.uid()));

-- Espaces
create policy workspaces_select on public.workspaces for select to authenticated
  using (private.is_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (private.can_admin(id)) with check (private.can_admin(id));
create policy workspaces_insert on public.workspaces for insert to authenticated
  with check (private.is_org_admin(organization_id));

-- Membres : visibles par les membres, gérés par owner/admin
create policy workspace_members_select on public.workspace_members for select to authenticated
  using (private.is_member(workspace_id));
create policy workspace_members_insert on public.workspace_members for insert to authenticated
  with check (private.can_admin(workspace_id) and (role <> 'owner' or private.has_role(workspace_id, array['owner']::public.member_role[])));
create policy workspace_members_update on public.workspace_members for update to authenticated
  using (private.can_admin(workspace_id))
  with check (private.can_admin(workspace_id) and (role <> 'owner' or private.has_role(workspace_id, array['owner']::public.member_role[])));
create policy workspace_members_delete on public.workspace_members for delete to authenticated
  using (private.can_admin(workspace_id) and role <> 'owner');

create policy invitations_all on public.invitations for all to authenticated
  using (private.can_admin(workspace_id)) with check (private.can_admin(workspace_id));

-- Profil créé automatiquement à l'inscription
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
