-- Apply in Supabase SQL Editor. Safe to re-run for initial setup.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro','team','enterprise')),
  status text not null default 'inactive',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.user_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_key text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_records enable row level security;
alter table public.user_files enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
drop policy if exists "Users manage own conversations" on public.conversations;
create policy "Users manage own conversations" on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own messages" on public.messages;
create policy "Users manage own messages" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users view own subscription" on public.subscriptions;
create policy "Users view own subscription" on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists "Users view own usage" on public.usage_records;
create policy "Users view own usage" on public.usage_records for select using (auth.uid() = user_id);
drop policy if exists "Users manage own file metadata" on public.user_files;
create policy "Users manage own file metadata" on public.user_files for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists conversations_user_updated_idx on public.conversations(user_id, updated_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists messages_user_created_idx on public.messages(user_id, created_at desc);
create index if not exists usage_user_created_idx on public.usage_records(user_id, created_at desc);

-- Do not grant clients write access to subscription plan/status. A verified server webhook
-- should update entitlements using a server-only credential after payment verification.


-- Phase 3: monthly usage metering and quotas.
-- Limits are starter values; adjust them to match pricing and provider spend.
alter table public.usage_records
  add column if not exists request_status text not null default 'completed';

create index if not exists usage_user_created_idx on public.usage_records(user_id, created_at desc);

create or replace function public.reserve_ai_request(
  p_model text,
  p_input_tokens integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_status text := 'inactive';
  v_request_limit integer := 50;
  v_token_limit bigint := 100000;
  v_requests_used integer := 0;
  v_tokens_used bigint := 0;
  v_input_tokens integer := greatest(0, least(coalesce(p_input_tokens, 0), 10000000));
  v_usage_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;

  -- Serialize reservations per user to prevent concurrent requests bypassing limits.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select s.plan, s.status into v_plan, v_status
  from public.subscriptions s where s.user_id = v_user_id limit 1;

  if v_plan is null or v_status not in ('active', 'trialing') then v_plan := 'free'; end if;
  case v_plan
    when 'pro' then v_request_limit := 1000; v_token_limit := 2000000;
    when 'team' then v_request_limit := 5000; v_token_limit := 10000000;
    when 'enterprise' then v_request_limit := 20000; v_token_limit := 50000000;
    else v_plan := 'free'; v_request_limit := 50; v_token_limit := 100000;
  end case;

  select count(*)::integer,
         coalesce(sum(input_tokens + output_tokens), 0)::bigint
    into v_requests_used, v_tokens_used
  from public.usage_records
  where user_id = v_user_id
    and created_at >= date_trunc('month', now())
    and request_status in ('reserved', 'completed')
;

  if v_requests_used >= v_request_limit then
    return jsonb_build_object('allowed', false, 'reason', 'request_limit', 'plan', v_plan,
      'requests_used', v_requests_used, 'request_limit', v_request_limit,
      'tokens_used', v_tokens_used, 'token_limit', v_token_limit);
  end if;
  if v_tokens_used + v_input_tokens > v_token_limit then
    return jsonb_build_object('allowed', false, 'reason', 'token_limit', 'plan', v_plan,
      'requests_used', v_requests_used, 'request_limit', v_request_limit,
      'tokens_used', v_tokens_used, 'token_limit', v_token_limit);
  end if;

  insert into public.usage_records(user_id, model, input_tokens, output_tokens, request_status)
  values (v_user_id, left(coalesce(p_model, 'unknown'), 120), v_input_tokens, 0, 'reserved')
  returning id into v_usage_id;

  return jsonb_build_object('allowed', true, 'plan', v_plan, 'usage_id', v_usage_id,
    'requests_used', v_requests_used + 1, 'request_limit', v_request_limit,
    'tokens_used', v_tokens_used + v_input_tokens, 'token_limit', v_token_limit);
end;
$$;

create or replace function public.finalize_ai_usage(
  p_usage_id uuid,
  p_output_tokens integer default 0,
  p_status text default 'completed',
  p_input_tokens integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return false; end if;
  update public.usage_records
  set input_tokens = greatest(0, least(coalesce(p_input_tokens, input_tokens), 10000000)),
      output_tokens = greatest(0, least(coalesce(p_output_tokens, 0), 10000000)),
      request_status = case when p_status in ('completed', 'failed') then p_status else 'failed' end
  where id = p_usage_id and user_id = v_user_id and request_status = 'reserved';
  return found;
end;
$$;

revoke all on function public.reserve_ai_request(text, integer) from public, anon;
grant execute on function public.reserve_ai_request(text, integer) to authenticated;
revoke all on function public.finalize_ai_usage(uuid, integer, text, integer) from public, anon;
grant execute on function public.finalize_ai_usage(uuid, integer, text, integer) to authenticated;
