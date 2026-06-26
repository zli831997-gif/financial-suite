import { storage } from '../../storage';
import { KEYS } from '../../storage/keys';

/**
 * 游戏化 domain — 移植自老版 gamificationManager.js（平台无关，wx→storage）。
 * 记账即打卡 / 财气值 / 20徽章 / 补签卡。
 * exp 累积（只增不降），points 可消费（补签）。exp 不再用于等级。
 * 外部上下文 ctx 由调用方传入（domain 不依赖 financeState）。
 */

// ========== 类型 ==========
export interface GrowthState {
  schemaVersion: number;
  points: number;                // 可消费财气值
  totalPointsEarned: number;
  totalPointsSpent: number;
  exp: number;                   // 经验（只增，不再用于等级）
  lastCheckinDate: string;       // YYYY-MM-DD（本地时区）
  streak: number;
  bestStreak: number;
  checkinDates: string[];        // 本月打卡
  checkinDatesAll: string[];     // 全量打卡（限90天）
  makeupCards: number;
  makeupCardLog: Array<{ date: string; cost: number; ts: number }>;
  nextMakeupCardAt: number;
  badges: string[];
  badgeLog: Array<{ id: string; unlockedAt: string }>;
  toolUsed: Record<string, boolean>;
  budgetMetMonths: string[];
  lastSettledMonth: string;
  dailyRecord: { date: string; gained: number }; // 当日记账基础分累计（封顶用）
  createdAt: string;
  updatedAt: string;
}

export interface BadgeCtx {
  recordCount: number;
  streak: number;
  bestStreak: number;
  net: number;
  liabilities: number;
  toolsUsed: Record<string, boolean>;
  budgetMetMonths: number;
  makeupUsed: number;
}

/** 外部上下文（调用方传入，domain 不依赖 financeState） */
export interface ExternalCtx {
  recordCount: number;
  net: number;
  liabilities: number;
}

export interface UnlockedBadge {
  id: string;
  icon: string;
  name: string;
  line: string;
  points: number;
}

export interface GamificationEvents {
  pointsGained: number;
  checkedIn: boolean;
  streak: number;
  streakMilestone: number | null;
  newBadges: UnlockedBadge[];
  gotMakeupCard: boolean;
  coinFrom: number;
  coinTo: number;
}

// ========== 常量 ==========
export const POINTS = {
  EXPENSE: 5,
  INCOME: 8,
  FIRST_CHECKIN: 10,
  TOOL: 30,
  BUDGET_MONTH: 200,
};

export const MAKEUP_COST = 50;
export const MAKEUP_RANGE_DAYS = 30;

const MAX_CHECKINALL = 90;
const MAX_BADGELOG = 200;
const DAILY_RECORD_CAP = 30;
const DAILY_STREAK_CAP = 100;

interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  group: string;
  desc: string;
  line: string;
  points: number;
  check: (c: BadgeCtx) => boolean;
}

export const BADGE_DEFS: BadgeDef[] = [
  // 打卡类
  { id: 'first_checkin', name: '初心如一', icon: '🌅', group: '打卡', desc: '完成第一次打卡', line: '开启你的财务人生第一笔', points: 50, check: c => c.bestStreak >= 1 },
  { id: 'streak_3', name: '三日之约', icon: '🔥', group: '打卡', desc: '连续打卡 3 天', line: '习惯的种子发芽了', points: 80, check: c => c.bestStreak >= 3 },
  { id: 'streak_7', name: '一周不辍', icon: '📅', group: '打卡', desc: '连续打卡 7 天', line: '送你 1 张补签卡！', points: 150, check: c => c.bestStreak >= 7 },
  { id: 'streak_30', name: '月度满勤', icon: '🏅', group: '打卡', desc: '连续打卡 30 天', line: '你已超越 90% 的用户', points: 300, check: c => c.bestStreak >= 30 },
  { id: 'streak_100', name: '百日筑基', icon: '💎', group: '打卡', desc: '连续打卡 100 天', line: '坚持是最罕见的奢侈品', points: 500, check: c => c.bestStreak >= 100 },
  { id: 'comeback_king', name: '王者归来', icon: '🛡️', group: '打卡', desc: '使用补签卡成功补签 1 次', line: '失而复得，更懂珍惜', points: 100, check: c => c.makeupUsed >= 1 },
  // 记账量类
  { id: 'first_record', name: '第一桶金', icon: '🪙', group: '记账', desc: '记下第 1 笔账', line: '钱途，从这里开始', points: 50, check: c => c.recordCount >= 1 },
  { id: 'record_50', name: '小试牛刀', icon: '📒', group: '记账', desc: '累计记账 50 笔', line: '你的账本有了厚度', points: 100, check: c => c.recordCount >= 50 },
  { id: 'record_500', name: '账房先生', icon: '📚', group: '记账', desc: '累计记账 500 笔', line: '比会计还专业', points: 300, check: c => c.recordCount >= 500 },
  { id: 'record_2000', name: '账海无涯', icon: '🗂️', group: '记账', desc: '累计记账 2000 笔', line: '这是一本人生账本', points: 500, check: c => c.recordCount >= 2000 },
  // 净资产里程碑类
  { id: 'net_10k', name: '万元户', icon: '💵', group: '资产', desc: '净资产达到 1 万', line: '第一桶金，来之不易', points: 100, check: c => c.net >= 10000 },
  { id: 'net_100k', name: '十万存款', icon: '🏦', group: '资产', desc: '净资产达到 10 万', line: '你已是同龄人前 10%', points: 200, check: c => c.net >= 100000 },
  { id: 'net_1m', name: '百万资产', icon: '🏛️', group: '资产', desc: '净资产达到 100 万', line: '迈入百万俱乐部', points: 500, check: c => c.net >= 1000000 },
  { id: 'debt_free', name: '无债一身轻', icon: '🍃', group: '资产', desc: '净资产为正且无负债', line: '轻装上阵，前路坦荡', points: 300, check: c => c.net > 0 && c.liabilities === 0 },
  // 工具探索类
  { id: 'tax_explorer', name: '税务先锋', icon: '🧾', group: '探索', desc: '使用税务计算工具', line: '算清每一分税', points: 80, check: c => !!c.toolsUsed.tax },
  { id: 'social_master', name: '社保达人', icon: '🏥', group: '探索', desc: '使用五险一金工具', line: '五险一金门儿清', points: 80, check: c => !!c.toolsUsed.social },
  { id: 'pension_planner', name: '养老先知', icon: '👴', group: '探索', desc: '使用养老规划工具', line: '提前 20 年规划退休', points: 80, check: c => !!c.toolsUsed.pension },
  { id: 'health_check', name: '体检完成', icon: '💪', group: '探索', desc: '查看财务健康分', line: '给财务做了次全身体检', points: 100, check: c => !!c.toolsUsed.health },
  // 预算自律类
  { id: 'budget_1m', name: '守纪之月', icon: '🎯', group: '自律', desc: '1 个月预算不超支', line: '预算不是束缚，是自由', points: 150, check: c => c.budgetMetMonths >= 1 },
  { id: 'budget_6m', name: '半年自律', icon: '⚖️', group: '自律', desc: '累计 6 个月预算达标', line: '自律给你自由', points: 400, check: c => c.budgetMetMonths >= 6 },
];

// ========== 日期工具（本地时区，修复 UTC 隐患） ==========
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
export function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayStr(): string {
  return formatYMD(new Date());
}
function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDaysStr(ymd: string, n: number): string {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + n);
  return formatYMD(d);
}

// ========== Storage ==========
export function getDefaultGrowth(): GrowthState {
  const now = todayStr();
  return {
    schemaVersion: 1,
    points: 0,
    totalPointsEarned: 0,
    totalPointsSpent: 0,
    exp: 0,
    lastCheckinDate: '',
    streak: 0,
    bestStreak: 0,
    checkinDates: [],
    checkinDatesAll: [],
    makeupCards: 1,
    makeupCardLog: [],
    nextMakeupCardAt: 7,
    badges: [],
    badgeLog: [],
    toolUsed: {},
    budgetMetMonths: [],
    lastSettledMonth: '',
    dailyRecord: { date: '', gained: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

export function getGrowth(): GrowthState {
  const stored = storage.get<Partial<GrowthState>>(KEYS.GROWTH);
  if (!stored) return getDefaultGrowth();
  return { ...getDefaultGrowth(), ...stored }; // 合并默认，防旧数据字段缺失
}

function saveGrowth(g: GrowthState): void {
  g.updatedAt = todayStr();
  storage.set(KEYS.GROWTH, g);
}

export function ensureGrowth(): GrowthState {
  if (!storage.has(KEYS.GROWTH)) saveGrowth(getDefaultGrowth());
  return getGrowth();
}

// ========== 核心：exp/points 解耦 ==========
function gain(g: GrowthState, amount: number): void {
  if (!amount) return;
  g.points += amount;
  g.exp += amount;
  g.totalPointsEarned += amount;
}
function spend(g: GrowthState, amount: number): void {
  g.points -= amount;
  g.totalPointsSpent += amount;
}

// ========== 徽章 ==========
function buildBadgeCtx(g: GrowthState, ext: ExternalCtx): BadgeCtx {
  return {
    recordCount: ext.recordCount,
    streak: g.streak,
    bestStreak: g.bestStreak,
    net: ext.net,
    liabilities: ext.liabilities,
    toolsUsed: g.toolUsed || {},
    budgetMetMonths: (g.budgetMetMonths || []).length,
    makeupUsed: (g.makeupCardLog || []).length,
  };
}

function unlockBadges(g: GrowthState, ext: ExternalCtx): UnlockedBadge[] {
  const ctx = buildBadgeCtx(g, ext);
  const newly: UnlockedBadge[] = [];
  for (const def of BADGE_DEFS) {
    if (!g.badges.includes(def.id) && def.check(ctx)) {
      g.badges.push(def.id);
      g.badgeLog.push({ id: def.id, unlockedAt: todayStr() });
      gain(g, def.points);
      newly.push({ id: def.id, icon: def.icon, name: def.name, line: def.line, points: def.points });
    }
  }
  if (g.badgeLog.length > MAX_BADGELOG) g.badgeLog = g.badgeLog.slice(-MAX_BADGELOG);
  return newly;
}

// ========== 打卡核心（幂等） ==========
interface CheckinResult {
  checkedIn: boolean;
  streak: number;
  streakBonus: number;
  firstCheckinPts: number;
  gotMakeupCard: boolean;
  streakMilestone: number | null;
}

function doCheckin(g: GrowthState, checkDate: string): CheckinResult {
  const res: CheckinResult = {
    checkedIn: false, streak: g.streak, streakBonus: 0,
    firstCheckinPts: 0, gotMakeupCard: false, streakMilestone: null,
  };
  // 仅当 checkDate 比 lastCheckinDate 更晚才算新打卡（同日/历史不重复）
  if (g.lastCheckinDate !== '' && checkDate <= g.lastCheckinDate) return res;

  const yesterday = addDaysStr(checkDate, -1);
  const continued = g.lastCheckinDate === yesterday;
  g.streak = continued ? g.streak + 1 : 1;
  g.lastCheckinDate = checkDate;
  g.bestStreak = Math.max(g.bestStreak, g.streak);
  res.checkedIn = true;
  res.streak = g.streak;

  if (!g.checkinDatesAll.includes(checkDate)) {
    g.checkinDatesAll.push(checkDate);
    g.checkinDatesAll.sort();
    if (g.checkinDatesAll.length > MAX_CHECKINALL) g.checkinDatesAll = g.checkinDatesAll.slice(-MAX_CHECKINALL);
  }
  const monthOf = checkDate.slice(0, 7);
  if (!g.checkinDates.some(d => d.startsWith(monthOf))) g.checkinDates = [];
  if (!g.checkinDates.includes(checkDate)) g.checkinDates.push(checkDate);

  res.firstCheckinPts = POINTS.FIRST_CHECKIN;
  gain(g, POINTS.FIRST_CHECKIN);

  // 连续加成：1-7×1 / 8-30×2 / 31+×3，封顶100
  let sb = g.streak <= 7 ? g.streak : g.streak <= 30 ? g.streak * 2 : g.streak * 3;
  sb = Math.min(sb, DAILY_STREAK_CAP);
  res.streakBonus = sb;
  gain(g, sb);

  if ([7, 30, 100, 365].includes(g.streak)) res.streakMilestone = g.streak;
  if (g.streak >= g.nextMakeupCardAt) {
    g.makeupCards += 1;
    g.nextMakeupCardAt = g.streak + 7;
    res.gotMakeupCard = true;
  }
  return res;
}

function applyCheckinToEvents(events: GamificationEvents, ck: CheckinResult): void {
  if (!ck.checkedIn) return;
  events.checkedIn = true;
  events.streak = ck.streak;
  events.streakMilestone = ck.streakMilestone;
  events.gotMakeupCard = ck.gotMakeupCard;
  events.pointsGained += ck.firstCheckinPts + ck.streakBonus;
}

function emptyEvents(g: GrowthState): GamificationEvents {
  return {
    pointsGained: 0, checkedIn: false, streak: g.streak, streakMilestone: null,
    newBadges: [], gotMakeupCard: false, coinFrom: g.points, coinTo: g.points,
  };
}

// ========== API ==========

/** 记账触发：基础分 + 打卡 + 徽章 */
export function onRecordCreated(record: { type: string; date?: string }, ext: ExternalCtx): GamificationEvents {
  const g = getGrowth();
  const events = emptyEvents(g);
  const checkDate = record.date || todayStr();

  // 基础分（每日封顶 30）
  if (g.dailyRecord.date !== checkDate) g.dailyRecord = { date: checkDate, gained: 0 };
  const base = record.type === 'income' ? POINTS.INCOME : POINTS.EXPENSE;
  const allow = Math.min(base, DAILY_RECORD_CAP - g.dailyRecord.gained);
  if (allow > 0) {
    gain(g, allow);
    g.dailyRecord.gained += allow;
    events.pointsGained += allow;
  }

  applyCheckinToEvents(events, doCheckin(g, checkDate));

  const beforePts = g.points;
  events.newBadges = unlockBadges(g, ext);
  if (events.newBadges.length) events.pointsGained += g.points - beforePts;

  events.coinTo = g.points;
  saveGrowth(g);
  return events;
}

/** 手动打卡（与记账共用幂等打卡逻辑，一天一次） */
export function manualCheckin(ext: ExternalCtx): GamificationEvents {
  const g = getGrowth();
  const events = emptyEvents(g);
  applyCheckinToEvents(events, doCheckin(g, todayStr()));

  const beforePts = g.points;
  events.newBadges = unlockBadges(g, ext);
  if (events.newBadges.length) events.pointsGained += g.points - beforePts;

  events.coinTo = g.points;
  saveGrowth(g);
  return events;
}

/** 补签卡消耗 */
export function redeemMakeupCard(missedDate: string): { ok: boolean; msg: string } {
  const g = getGrowth();
  const today = todayStr();
  if (g.makeupCards < 1) return { ok: false, msg: '没有补签卡了，连续打卡可获得' };
  if (g.points < MAKEUP_COST) return { ok: false, msg: `财气值不足，需 ${MAKEUP_COST}` };
  if (missedDate >= today) return { ok: false, msg: '只能补签过去的日期' };
  if (missedDate < addDaysStr(today, -MAKEUP_RANGE_DAYS)) return { ok: false, msg: `最多补签 ${MAKEUP_RANGE_DAYS} 天内` };
  if (g.checkinDatesAll.includes(missedDate)) return { ok: false, msg: '这天已打卡，无需补签' };

  g.makeupCards -= 1;
  spend(g, MAKEUP_COST);
  g.makeupCardLog.push({ date: missedDate, cost: MAKEUP_COST, ts: Date.now() });
  g.checkinDatesAll.push(missedDate);
  g.checkinDatesAll.sort();
  if (g.checkinDatesAll.length > MAX_CHECKINALL) g.checkinDatesAll = g.checkinDatesAll.slice(-MAX_CHECKINALL);
  if (!g.checkinDates.includes(missedDate)) g.checkinDates.push(missedDate);

  // 重算 streak
  const dates = new Set(g.checkinDatesAll);
  let count = 0;
  let d = g.lastCheckinDate;
  while (dates.has(d)) { count++; d = addDaysStr(d, -1); }
  g.streak = count;
  g.bestStreak = Math.max(g.bestStreak, count);

  saveGrowth(g);
  return { ok: true, msg: `补签成功，连续 ${g.streak} 天` };
}

/** 通用发奖（档案首填/工具奖励等） */
export function awardBonus(reason: string, points: number, ext?: ExternalCtx): GamificationEvents {
  void reason;
  const g = getGrowth();
  const events = emptyEvents(g);
  gain(g, points);
  events.pointsGained = points;
  if (ext) {
    const beforePts = g.points;
    events.newBadges = unlockBadges(g, ext);
    if (events.newBadges.length) events.pointsGained += g.points - beforePts;
  }
  events.coinTo = g.points;
  saveGrowth(g);
  return events;
}

export function checkinStatus(): { checkedToday: boolean; streak: number; bestStreak: number; makeupCards: number } {
  const g = getGrowth();
  return { checkedToday: g.lastCheckinDate === todayStr(), streak: g.streak, bestStreak: g.bestStreak, makeupCards: g.makeupCards };
}

export function getAllBadges(): Array<BadgeDef & { unlocked: boolean }> {
  const g = getGrowth();
  return BADGE_DEFS.map(def => ({ ...def, unlocked: g.badges.includes(def.id) }));
}
