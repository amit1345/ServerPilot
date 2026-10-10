-- ServerPilot — initial schema, Row Level Security and helper functions.
-- Run once in Supabase → SQL Editor (or `supabase db push`).
--
-- Security model
--   * Every table has RLS enabled. The browser only ever uses the anon key, so
--     these policies ARE the authorization layer.
--   * A user can only see a workspace (and its reports, members, settings,
--     activity) if they have a row in workspace_members for it.
--   * Roles are ranked: owner(4) > admin(3) > moderator(2) > viewer(1).
--   * Multi-step / privileged operations (create workspace, add member by
--     email) go through SECURITY DEFINER functions that re-check auth.uid().

-- ---------------------------------------------------------------- types
create type public.workspace_role as enum ('owner', 'admin', 'moderator', 'viewer');
create type public.report_status  as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.report_priority as enum ('low', 'medium', 'high', 'critical');
create type public.report_category as enum ('player', 'bug', 'cheating', 'staff', 'other');

-- ---------------------------------------------------------------- tables
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null default '' check (char_length(display_name) <= 60),
  locale       text not null default 'he' check (locale in ('he', 'en')),
  created_at   timestamptz not null default now()
);

create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 60),
  plan       text not null default 'free' check (plan in ('free')),
  -- Owner's account deleted → their workspaces go with it.
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.workspace_role not null default 'viewer',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- Non-secret connection details only. No RCON passwords, txAdmin tokens or
-- license keys are ever stored here: remote administration is out of scope.
create table public.server_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  server_name  text not null default '' check (char_length(server_name) <= 80),
  host         text not null default '' check (char_length(host) <= 255),
  port         int  not null default 30120 check (port between 1 and 65535),
  cfx_code     text not null default '' check (cfx_code ~ '^[a-z0-9]{0,12}$'),
  max_players  int  not null default 64 check (max_players between 1 and 2048),
  description  text not null default '' check (char_length(description) <= 500),
  updated_at   timestamptz not null default now()
);

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  title         text not null check (char_length(title) between 3 and 120),
  description   text not null default '' check (char_length(description) <= 4000),
  category      public.report_category not null default 'other',
  status        public.report_status   not null default 'open',
  priority      public.report_priority not null default 'medium',
  reporter_name text not null default '' check (char_length(reporter_name) <= 60),
  target_player text not null default '' check (char_length(target_player) <= 60),
  assigned_to   uuid references auth.users (id) on delete set null,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create index reports_workspace_created_idx on public.reports (workspace_id, created_at desc);

create table public.activity_log (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id     uuid references auth.users (id) on delete set null,
  action       text not null,
  entity_id    uuid,
  summary      text not null default '',
  created_at   timestamptz not null default now()
);
create index activity_log_workspace_idx on public.activity_log (workspace_id, created_at desc);

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER so policies on workspace_members don't recurse into themselves.
-- NULL (not a member) ranks 0 so it never satisfies any role check.
create or replace function public.role_rank(r public.workspace_role)
returns int language sql immutable set search_path = '' as $$
  select case r when 'owner' then 4 when 'admin' then 3 when 'moderator' then 2 when 'viewer' then 1 else 0 end;
$$;

create or replace function public.my_role(ws uuid)
returns public.workspace_role language sql stable security definer set search_path = '' as $$
  select role from public.workspace_members where workspace_id = ws and user_id = auth.uid();
$$;

create or replace function public.has_role(ws uuid, min_role public.workspace_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.my_role(ws) is not null
     and public.role_rank(public.my_role(ws)) >= public.role_rank(min_role);
$$;

create or replace function public.shares_workspace(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ---------------------------------------------------------------- triggers
-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(left(new.raw_user_meta_data ->> 'display_name', 60), ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Reports: lock identity columns, keep timestamps honest, validate assignee.
create or replace function public.reports_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- FK actions (e.g. ON DELETE SET NULL when a user is deleted) pass through.
  if pg_trigger_depth() > 1 then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then
    new.closed_at := now();
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;
  if new.assigned_to is not null and not exists (
    select 1 from public.workspace_members
    where workspace_id = new.workspace_id and user_id = new.assigned_to and role <> 'viewer'
  ) then
    raise exception 'Assignee must be a staff member of this workspace';
  end if;
  return new;
end $$;

create trigger reports_before_write
  before insert or update on public.reports
  for each row execute function public.reports_before_write();

-- Activity log is written only by triggers (no insert policy for clients).
-- Actor is NULL when the acting user no longer exists (e.g. during account deletion).
create or replace function public.current_actor()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where id = auth.uid();
$$;

create or replace function public.log_report_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare act text;
begin
  -- Ignore changes nobody made on purpose (FK cascades nulling created_by etc.).
  if tg_op = 'UPDATE' and (new.title, new.description, new.category, new.status, new.priority,
      new.reporter_name, new.target_player) is not distinct from (old.title, old.description, old.category,
      old.status, old.priority, old.reporter_name, old.target_player)
     and (new.assigned_to is not distinct from old.assigned_to or public.current_actor() is null) then
    return null;
  end if;
  if tg_op = 'INSERT' then act := 'report_created';
  elsif new.status is distinct from old.status then act := 'report_' || new.status::text;
  elsif new.assigned_to is distinct from old.assigned_to then act := 'report_assigned';
  else act := 'report_updated';
  end if;
  insert into public.activity_log (workspace_id, actor_id, action, entity_id, summary)
  values (new.workspace_id, public.current_actor(), act, new.id, new.title);
  return new;
end $$;

create trigger reports_activity
  after insert or update on public.reports
  for each row execute function public.log_report_activity();

-- Membership guard. Clients have no INSERT policy on workspace_members, so rows
-- only arrive through create_workspace / add_workspace_member; updates and
-- deletes come from admins via RLS. Rules enforced here for every path:
--   * exactly one owner, created together with the workspace, never changed;
--   * non-owners can only grant / manage roles strictly below their own;
--   * anyone (except the owner) may remove themselves.
create or replace function public.members_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := coalesce(new.workspace_id, old.workspace_id);
  me public.workspace_role;
begin
  -- Cascades (workspace or auth user deleted) are always allowed.
  if pg_trigger_depth() > 1 or not exists (select 1 from public.workspaces where id = ws) then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' and new.role = 'owner' then
    if new.user_id = auth.uid()
       and exists (select 1 from public.workspaces where id = ws and created_by = auth.uid())
       and not exists (select 1 from public.workspace_members where workspace_id = ws) then
      return new;
    end if;
    raise exception 'Only one owner per workspace';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' then
    raise exception 'The owner membership cannot be changed or removed';
  end if;
  if tg_op = 'DELETE' and old.user_id = auth.uid() then return old; end if;
  if tg_op = 'UPDATE' then
    new.workspace_id := old.workspace_id;
    new.user_id := old.user_id;
    if new.role = 'owner' then raise exception 'Only one owner per workspace'; end if;
  end if;

  me := public.my_role(ws);
  if me is distinct from 'owner' then
    if tg_op in ('UPDATE', 'DELETE') and public.role_rank(old.role) >= public.role_rank(me) then
      raise exception 'You cannot manage a member with a role equal to or above your own';
    end if;
    if tg_op in ('INSERT', 'UPDATE') and public.role_rank(new.role) >= public.role_rank(me) then
      raise exception 'You cannot grant a role equal to or above your own';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger members_guard
  before insert or update or delete on public.workspace_members
  for each row execute function public.members_guard();

create or replace function public.log_member_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.workspace_members := coalesce(new, old);
begin
  -- Skip cascades (workspace or user being deleted).
  if not exists (select 1 from public.workspaces where id = r.workspace_id)
     or not exists (select 1 from public.profiles where id = r.user_id) then
    return null;
  end if;
  insert into public.activity_log (workspace_id, actor_id, action, entity_id, summary)
  values (
    r.workspace_id, public.current_actor(),
    case tg_op when 'INSERT' then 'member_added' when 'UPDATE' then 'member_role_changed' else 'member_removed' end,
    r.user_id,
    coalesce((select coalesce(nullif(display_name, ''), email) from public.profiles where id = r.user_id), '')
      || ' · ' || r.role::text
  );
  return null;
end $$;

create trigger members_activity
  after insert or update or delete on public.workspace_members
  for each row execute function public.log_member_activity();

-- ---------------------------------------------------------------- RPCs
create or replace function public.create_workspace(ws_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare ws_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if (select count(*) from public.workspaces where created_by = auth.uid()) >= 5 then
    raise exception 'Workspace limit reached for the free plan';
  end if;
  insert into public.workspaces (name, created_by) values (trim(ws_name), auth.uid()) returning id into ws_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, auth.uid(), 'owner');
  insert into public.server_settings (workspace_id, server_name) values (ws_id, trim(ws_name));
  return ws_id;
end $$;

-- Adds an EXISTING ServerPilot user by email (lookup needs definer rights).
create or replace function public.add_workspace_member(ws uuid, member_email text, member_role public.workspace_role)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.has_role(ws, 'admin') then raise exception 'Not allowed'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(member_email));
  if uid is null then raise exception 'No ServerPilot account uses this email'; end if;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, member_role);
end $$;

revoke execute on function public.create_workspace(text) from public, anon;
revoke execute on function public.add_workspace_member(uuid, text, public.workspace_role) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.add_workspace_member(uuid, text, public.workspace_role) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.server_settings   enable row level security;
alter table public.reports           enable row level security;
alter table public.activity_log      enable row level security;

-- profiles: see yourself and people you share a workspace with; edit only yourself.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- email is managed by auth; users may only change display_name and locale.
revoke update on public.profiles from authenticated;
grant update (display_name, locale) on public.profiles to authenticated;

-- workspaces: members read; admins rename; owner deletes. Insert only via RPC.
create policy workspaces_select on public.workspaces for select to authenticated
  using (public.has_role(id, 'viewer'));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.has_role(id, 'admin')) with check (public.has_role(id, 'admin'));
create policy workspaces_delete on public.workspaces for delete to authenticated
  using (public.has_role(id, 'owner'));
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;

-- members: members read the roster; admins manage (guard trigger limits roles).
create policy members_select on public.workspace_members for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));
create policy members_update on public.workspace_members for update to authenticated
  using (public.has_role(workspace_id, 'admin')) with check (public.has_role(workspace_id, 'admin'));
create policy members_delete on public.workspace_members for delete to authenticated
  using (public.has_role(workspace_id, 'admin') or user_id = auth.uid());
revoke update on public.workspace_members from authenticated;
grant update (role) on public.workspace_members to authenticated;

-- server settings: members read; admins write.
create policy settings_select on public.server_settings for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));
create policy settings_update on public.server_settings for update to authenticated
  using (public.has_role(workspace_id, 'admin')) with check (public.has_role(workspace_id, 'admin'));

-- reports: members read; moderators+ create and update. No client deletes.
create policy reports_select on public.reports for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));
create policy reports_insert on public.reports for insert to authenticated
  with check (public.has_role(workspace_id, 'moderator'));
create policy reports_update on public.reports for update to authenticated
  using (public.has_role(workspace_id, 'moderator')) with check (public.has_role(workspace_id, 'moderator'));

-- activity: members read; writes only via triggers.
create policy activity_select on public.activity_log for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));

-- anon gets nothing at all.
revoke all on all tables in schema public from anon;
