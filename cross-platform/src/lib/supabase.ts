import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase 同步客户端（组队记账后端）。
 *
 * 部署后把你的 Supabase URL 和 anon key 填到下方（或环境变量）。
 * 小程序和 APP 共用同一套客户端，实现家庭组真同步。
 *
 * 安全：anon key 是公开的（RLS 保证安全），可放前端。
 *      service_role key 绝不能放前端。
 */

// ↓↓↓ 部署后替换为你的真实值（Supabase Dashboard → Settings → API）↓↓↓
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
// ↑↑↑

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (SUPABASE_URL.includes('YOUR-PROJECT')) {
    // 未配置，返回 null（同步功能静默禁用，本地记账正常）
    return null;
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

/** 同步功能是否已配置（URL/key 填了真实值）*/
export function isSyncEnabled(): boolean {
  return getSupabase() !== null;
}

/* ─────────── 认证（账号密码）─────────── */

export interface AuthResult {
  user: { id: string; email: string } | null;
  error: string | null;
}

export async function signUp(email: string, password: string, nickname?: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { user: null, error: '同步未配置' };
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });
  if (error) return { user: null, error: error.message };
  return { user: data.user ? { id: data.user.id, email: data.user.email || '' } : null, error: null };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { user: null, error: '同步未配置' };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { user: null, error: error.message };
  return { user: data.user ? { id: data.user.id, email: data.user.email || '' } : null, error: null };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email || '' };
}

/* ─────────── 家庭组 ─────────── */

/** 生成 6 位匹配码（大写字母+数字，去易混字符）*/
export function genInviteCode(): string {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 去 0/O/1/I/L
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  role: string;
}

/** 创建家庭组，返回带匹配码的家庭信息 */
export async function createHousehold(name: string): Promise<{ household: Household | null; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { household: null, error: '同步未配置' };
  const user = await getCurrentUser();
  if (!user) return { household: null, error: '未登录' };

  // 尝试生成唯一匹配码（重试 3 次）
  let code = '';
  for (let i = 0; i < 3; i++) {
    code = genInviteCode();
    const { data, error } = await sb.rpc('create_household', { p_name: name, p_code: code });
    if (!error && data) {
      return {
        household: { id: data as string, name, invite_code: code, role: 'owner' },
        error: null,
      };
    }
    // 匹配码冲突就重试
  }
  return { household: null, error: '创建失败，请重试' };
}

/** 通过匹配码加入家庭组 */
export async function joinHousehold(code: string): Promise<{ household: Household | null; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { household: null, error: '同步未配置' };
  const user = await getCurrentUser();
  if (!user) return { household: null, error: '未登录' };

  const { data, error } = await sb.rpc('join_household', { p_code: code.toUpperCase().trim() });
  if (error) return { household: null, error: '匹配码无效或已失效' };
  if (!data) return { household: null, error: '匹配码无效' };

  // 查家庭详情
  const { data: h } = await sb.from('households').select('id, name, invite_code').eq('id', data).single();
  return {
    household: h ? { id: h.id, name: h.name, invite_code: h.invite_code, role: 'member' } : null,
    error: null,
  };
}

/** 获取当前用户所在的家庭组（一个用户可能多个家庭，这里取第一个）*/
export async function getMyHousehold(): Promise<Household | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await sb
    .from('memberships')
    .select('household_id, role, households(id, name, invite_code)')
    .eq('user_id', user.id)
    .limit(1)
    .single();
  const m = data as any;
  if (!m?.households) return null;
  return {
    id: m.households.id,
    name: m.households.name,
    invite_code: m.households.invite_code,
    role: m.role,
  };
}

/* ─────────── 账本同步（push/pull）─────────── */

export interface SharedRecord {
  id: string;
  household_id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  time?: string;
  note: string;
  account_name?: string;
  source?: string;
  tags?: string[];
  updated_at: string;
  deleted: boolean;
}

/**
 * 拉取家庭组的账本（增量：只取 lastSyncAt 之后更新的）。
 * @returns 新增/变更的记录 + 最新同步时间
 */
export async function pullRecords(householdId: string, lastSyncAt?: string): Promise<{ records: SharedRecord[]; latestAt: string | null }> {
  const sb = getSupabase();
  if (!sb) return { records: [], latestAt: null };

  let query = sb.from('shared_records').select('*').eq('household_id', householdId);
  if (lastSyncAt) query = query.gt('updated_at', lastSyncAt);
  const { data, error } = await query.order('updated_at', { ascending: true });
  if (error || !data) return { records: [], latestAt: null };

  const latestAt = data.length > 0 ? data[data.length - 1].updated_at : lastSyncAt || null;
  return { records: data as SharedRecord[], latestAt };
}

/**
 * 推送本地记录到云端（含软删除）。
 * 冲突处理：用 updated_at 做 LWW（后写覆盖），由 DB 触发器保证 updated_at 新鲜度。
 */
export async function pushRecord(
  householdId: string,
  record: {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    date: string;
    time?: string;
    note: string;
    account_name?: string;
    source?: string;
    tags?: string[];
    deleted?: boolean;
  },
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const user = await getCurrentUser();
  if (!user) return false;

  const { error } = await sb.from('shared_records').upsert({
    id: record.id,
    household_id: householdId,
    user_id: user.id,
    type: record.type,
    amount: record.amount,
    category: record.category,
    date: record.date,
    time: record.time,
    note: record.note,
    account_name: record.account_name,
    source: record.source || 'manual',
    tags: record.tags || [],
    deleted: record.deleted || false,
  });

  return !error;
}
