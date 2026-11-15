-- Invitations : un lien à usage unique (jeton haché en base) pour rejoindre un espace.

-- Aperçu d'une invitation (nom de l'espace) sans être membre : uniquement via le jeton.
create or replace function public.invitation_preview(invite_token text)
returns table (workspace_name text, email text, role public.member_role, expired boolean, accepted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select w.name, i.email, i.role, i.expires_at < now(), i.accepted_at is not null
  from public.invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token_hash = encode(sha256(convert_to(invite_token, 'UTF8')), 'hex');
$$;

-- Accepte une invitation pour l'utilisateur connecté (son email doit correspondre).
create or replace function public.accept_invitation(invite_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations%rowtype;
  user_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  ws_slug text;
begin
  if (select auth.uid()) is null then
    raise exception 'Connexion requise';
  end if;
  select * into inv from public.invitations
  where token_hash = encode(sha256(convert_to(invite_token, 'UTF8')), 'hex')
  for update;
  if not found then raise exception 'Invitation introuvable'; end if;
  if inv.accepted_at is not null then raise exception 'Invitation déjà utilisée'; end if;
  if inv.expires_at < now() then raise exception 'Invitation expirée'; end if;
  if lower(inv.email) <> user_email then raise exception 'Cette invitation est destinée à une autre adresse email'; end if;

  insert into public.workspace_members (workspace_id, user_id, role, granted_modules)
  values (inv.workspace_id, (select auth.uid()), inv.role, inv.granted_modules)
  on conflict (workspace_id, user_id) do update
    set role = excluded.role, granted_modules = excluded.granted_modules
    where public.workspace_members.role <> 'owner';

  update public.invitations set accepted_at = now() where id = inv.id;
  select slug into ws_slug from public.workspaces where id = inv.workspace_id;
  return ws_slug;
end;
$$;

revoke execute on function public.invitation_preview(text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.invitation_preview(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
