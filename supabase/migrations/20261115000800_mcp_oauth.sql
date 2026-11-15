-- Serveur MCP : OAuth 2.1 (enregistrement dynamique des clients, code + PKCE, jetons hachés).
-- Les tables d'autorisation ne sont lues et écrites que par le serveur (rôle service) ;
-- les utilisateurs voient et révoquent leurs propres accès, les admins ceux de leur espace.

create table if not exists public.oauth_clients (
  client_id text primary key,
  client_name text not null default 'Client MCP',
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  created_at timestamptz not null default now()
);
alter table public.oauth_clients enable row level security;

create table if not exists public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.oauth_codes enable row level security;

create table if not exists public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  token_hash text not null unique,
  refresh_hash text not null unique,
  expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.mcp_tokens enable row level security;
create index if not exists mcp_tokens_workspace on public.mcp_tokens (workspace_id) where revoked_at is null;

create policy mcp_tokens_select on public.mcp_tokens for select to authenticated
  using (user_id = (select auth.uid()) or private.can_admin(workspace_id));
create policy mcp_tokens_revoke on public.mcp_tokens for update to authenticated
  using (user_id = (select auth.uid()) or private.can_admin(workspace_id))
  with check (user_id = (select auth.uid()) or private.can_admin(workspace_id));

-- Demandes d'action de Claude : qui peut valider (owner/admin/manager), journal de la décision
alter table public.mcp_action_requests
  add column if not exists title text not null default '',
  add column if not exists via text not null default 'oauth' check (via in ('oauth', 'api_key'));
