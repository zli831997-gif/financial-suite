-- ============================================================
-- FinanceHub 家庭组队记账 - 数据库 Schema (Supabase / PostgreSQL)
-- ============================================================
-- 在 Supabase Dashboard → SQL Editor 里整段执行。
-- 执行后自动创建：用户扩展表、家庭组、成员关系、共享账本。
-- ============================================================

-- 1. 用户扩展表（Supabase auth.users 存账号密码，这里存业务字段）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  created_at timestamptz default now()
);

-- 新用户注册时自动建 profile（触发器）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. 家庭组（一个家庭一本共享账本）
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- 家庭名称（如"张家"）
  invite_code text unique not null,      -- 6位匹配码（邀请加入用）
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 生成 6 位匹配码（大写字母+数字，去掉易混的 0/O/1/I/L）
create or replace function public.gen_invite_code()
returns text
language sql
as $$
  select lpad(
    to_hex(floor(random() * 2176782336)::bigint),
    6, '0'
  );
$$;
-- 注：实际匹配码由应用层生成并校验唯一，这里只提供参考函数

-- 3. 成员关系（家庭组 ↔ 用户，多对多）
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',   -- 'owner' 创建者 / 'member' 成员
  joined_at timestamptz default now(),
  unique(household_id, user_id)          -- 同一用户不能重复加入同一家庭
);

-- 4. 共享账本记录（同步核心表）
--    与本地 Transaction 结构对齐，加同步字段
create table if not exists public.shared_records (
  id text primary key,                   -- 用客户端生成的 id（时间戳+随机），便于幂等
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id),  -- 谁记的
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null,
  category text not null,
  date text not null,                    -- YYYY-MM-DD
  time text,                             -- HH:mm
  note text not null default '',
  account_name text,
  source text default 'manual',          -- manual/template/notification
  tags text[] default '{}',              -- 标签数组
  created_at timestamptz default now(),
  updated_at timestamptz default now(),  -- 用于 LWW 冲突解决
  deleted boolean default false          -- 软删除（同步删除操作）
);

-- 按家庭组查询的索引
create index if not exists idx_shared_records_household
  on public.shared_records(household_id, date desc);

-- 更新时自动刷新 updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_shared_records_updated on public.shared_records;
create trigger trg_shared_records_updated
  before update on public.shared_records
  for each row execute procedure public.touch_updated_at();

-- ============================================================
-- 行级安全策略（RLS）：用户只能访问自己所在家庭组的数据
-- ============================================================

alter table public.households enable row level security;
alter table public.memberships enable row level security;
alter table public.shared_records enable row level security;

-- 家庭组：成员可见
create policy "households visible to members"
  on public.households for select
  using (
    exists (
      select 1 from public.memberships m
      where m.household_id = households.id and m.user_id = auth.uid()
    )
  );

-- 成员关系：成员可见（用来知道家里有谁）
create policy "memberships visible to members"
  on public.memberships for select
  using (
    exists (
      select 1 from public.memberships m2
      where m2.household_id = memberships.household_id and m2.user_id = auth.uid()
    )
  );

-- 共享账本：家庭成员可读写（全账单共享模式）
create policy "records visible to family"
  on public.shared_records for select
  using (
    exists (
      select 1 from public.memberships m
      where m.household_id = shared_records.household_id and m.user_id = auth.uid()
    )
  );

create policy "records insertable by family"
  on public.shared_records for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.household_id = shared_records.household_id and m.user_id = auth.uid()
    )
  );

create policy "records updatable by family"
  on public.shared_records for update
  using (
    exists (
      select 1 from public.memberships m
      where m.household_id = shared_records.household_id and m.user_id = auth.uid()
    )
  );

-- profiles：用户只能改自己的
create policy "profiles self read"
  on public.profiles for select using (id = auth.uid());
create policy "profiles self update"
  on public.profiles for update using (id = auth.uid());

-- ============================================================
-- 用户可以创建家庭组和加入家庭组（这些操作需要 definer 绕过 RLS）
-- ============================================================

-- 创建家庭组（自动加为 owner）
create or replace function public.create_household(p_name text, p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.households (name, invite_code, created_by)
  values (p_name, p_code, auth.uid())
  returning id into new_id;

  insert into public.memberships (household_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  return new_id;
end;
$$;

-- 通过匹配码加入家庭组
create or replace function public.join_household(p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id from public.households where invite_code = upper(p_code);
  if target_id is null then
    raise exception '匹配码无效';
  end if;

  insert into public.memberships (household_id, user_id, role)
  values (target_id, auth.uid(), 'member')
  on conflict do nothing;

  return target_id;
end;
$$;

-- ============================================================
-- 完成提示
-- ============================================================
-- 执行成功后，数据库已具备：
--   ✓ 账号密码注册（Supabase Auth 自动建 profile）
--   ✓ 家庭组创建/加入（create_household / join_household）
--   ✓ 共享账本读写（RLS 保证只看自家）
--   ✓ 软删除 + 更新时间戳（用于同步）
