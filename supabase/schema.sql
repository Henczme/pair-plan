create extension if not exists pgcrypto;

create table public.pairs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  next_meeting_at timestamptz,
  next_meeting_place text,
  created_at timestamptz not null default now()
);

create table public.pair_members (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  joined_at timestamptz not null default now(),
  unique(pair_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  title text not null,
  date date not null,
  time time,
  location text,
  type text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shared_items (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  title text not null,
  category text,
  status text not null default 'open',
  priority text not null default 'medium',
  created_by uuid references auth.users(id),
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wishlist (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  title text not null,
  category text,
  estimated_cost numeric,
  priority text not null default 'medium',
  status text not null default 'open',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.date_plans (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  title text not null,
  date date,
  location text,
  budget numeric,
  note text,
  status text not null default 'planning',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.date_plans(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  text text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_pair_member(target_pair_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pair_members
    where pair_id = target_pair_id and user_id = auth.uid()
  );
$$;

alter table public.pairs enable row level security;
alter table public.pair_members enable row level security;
alter table public.events enable row level security;
alter table public.shared_items enable row level security;
alter table public.wishlist enable row level security;
alter table public.date_plans enable row level security;
alter table public.plan_steps enable row level security;
alter table public.activity_log enable row level security;

create policy "members can read own pairs" on public.pairs for select using (public.is_pair_member(id) or created_by = auth.uid());
create policy "users can create pairs" on public.pairs for insert with check (created_by = auth.uid());
create policy "members can update pairs" on public.pairs for update using (public.is_pair_member(id) or created_by = auth.uid());

create policy "members can read membership" on public.pair_members for select using (public.is_pair_member(pair_id) or user_id = auth.uid());
create policy "creators can add own initial membership" on public.pair_members for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.pairs p
    where p.id = pair_id and p.created_by = auth.uid()
  )
);

create or replace function public.join_pair_by_invite(invite text, nickname_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pair_id uuid;
begin
  select id into target_pair_id
  from public.pairs
  where invite_code = upper(invite)
  limit 1;

  if target_pair_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.pair_members (pair_id, user_id, nickname)
  values (target_pair_id, auth.uid(), coalesce(nullif(nickname_input, ''), '我'))
  on conflict (pair_id, user_id) do update
    set nickname = excluded.nickname;

  return target_pair_id;
end;
$$;

create policy "members read events" on public.events for select using (public.is_pair_member(pair_id));
create policy "members write events" on public.events for insert with check (public.is_pair_member(pair_id));
create policy "members update events" on public.events for update using (public.is_pair_member(pair_id));
create policy "members delete events" on public.events for delete using (public.is_pair_member(pair_id));

create policy "members read shared_items" on public.shared_items for select using (public.is_pair_member(pair_id));
create policy "members write shared_items" on public.shared_items for insert with check (public.is_pair_member(pair_id));
create policy "members update shared_items" on public.shared_items for update using (public.is_pair_member(pair_id));
create policy "members delete shared_items" on public.shared_items for delete using (public.is_pair_member(pair_id));

create policy "members read wishlist" on public.wishlist for select using (public.is_pair_member(pair_id));
create policy "members write wishlist" on public.wishlist for insert with check (public.is_pair_member(pair_id));
create policy "members update wishlist" on public.wishlist for update using (public.is_pair_member(pair_id));
create policy "members delete wishlist" on public.wishlist for delete using (public.is_pair_member(pair_id));

create policy "members read date_plans" on public.date_plans for select using (public.is_pair_member(pair_id));
create policy "members write date_plans" on public.date_plans for insert with check (public.is_pair_member(pair_id));
create policy "members update date_plans" on public.date_plans for update using (public.is_pair_member(pair_id));
create policy "members delete date_plans" on public.date_plans for delete using (public.is_pair_member(pair_id));

create policy "members read plan_steps" on public.plan_steps for select using (
  exists (select 1 from public.date_plans p where p.id = plan_id and public.is_pair_member(p.pair_id))
);
create policy "members write plan_steps" on public.plan_steps for insert with check (
  exists (select 1 from public.date_plans p where p.id = plan_id and public.is_pair_member(p.pair_id))
);
create policy "members update plan_steps" on public.plan_steps for update using (
  exists (select 1 from public.date_plans p where p.id = plan_id and public.is_pair_member(p.pair_id))
);

create policy "members read activity" on public.activity_log for select using (public.is_pair_member(pair_id));
create policy "members write activity" on public.activity_log for insert with check (public.is_pair_member(pair_id));
create policy "members delete activity" on public.activity_log for delete using (public.is_pair_member(pair_id));

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.pairs;
alter publication supabase_realtime add table public.shared_items;
alter publication supabase_realtime add table public.wishlist;
alter publication supabase_realtime add table public.date_plans;
alter publication supabase_realtime add table public.plan_steps;
alter publication supabase_realtime add table public.activity_log;
