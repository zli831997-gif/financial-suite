import { storage } from '../../storage';
import { KEYS } from '../../storage/keys';
import type { Transaction } from '../../types';
import { adjustAccountBalance, ensureAccounts } from './accounts';
import { todayStr, addDaysStr } from './gamification';

let _idSeq = 0;
/** ID 生成：时间戳 + 自增序列（移植老版 dataManager.genId），避免批量撞 ID。 */
export function genId(): string {
  _idSeq += 1;
  return `${Date.now()}_${_idSeq}`;
}

export function getRecords(): Transaction[] {
  return storage.get<Transaction[]>(KEYS.RECORDS) ?? [];
}

function saveRecords(records: Transaction[]): void {
  storage.set(KEYS.RECORDS, records);
}

/** 记账→账户余额联动：expense 减、income 加；reverse=true 回退（删除时）。 */
function updateBalanceForRecord(record: Transaction, reverse = false): void {
  if (!record.accountId) return;
  const sign = reverse ? -1 : 1;
  let delta = 0;
  if (record.type === 'expense') delta = -sign * record.amount;
  else if (record.type === 'income') delta = sign * record.amount;
  if (delta !== 0) adjustAccountBalance(record.accountId, delta);
}

export function addRecord(record: Transaction): Transaction[] {
  const newRecord: Transaction = { ...record, id: record.id || genId() };
  const updated = [...getRecords(), newRecord];
  saveRecords(updated);
  updateBalanceForRecord(newRecord);
  // TODO(阶段2b): 接 gamification.onRecordCreated(newRecord) 触发打卡/积分/徽章
  return updated;
}

export function deleteRecord(id: string): Transaction[] {
  const records = getRecords();
  const target = records.find(r => r.id === id);
  const updated = records.filter(r => r.id !== id);
  saveRecords(updated);
  if (target) updateBalanceForRecord(target, true); // 回退账户余额
  return updated;
}

/** 更新单条记录（如标记重要），不涉及账户余额。 */
export function updateRecord(id: string, updates: Partial<Transaction>): Transaction[] {
  const records = getRecords().map(r => (r.id === id ? { ...r, ...updates } : r));
  saveRecords(records);
  return records;
}

/** 一次性迁移：旧 finance_hub_transactions_v2 → fin_records（补默认账户）。幂等。 */
export function migrateLegacyTransactions(): void {
  const legacy = storage.get<Transaction[]>(KEYS.TRANSACTIONS);
  if (!legacy || legacy.length === 0) return;
  // 已有 fin_records 数据则不覆盖，仅清掉旧 key
  if (getRecords().length > 0) {
    storage.remove(KEYS.TRANSACTIONS);
    return;
  }
  const migrated: Transaction[] = legacy.map(t => ({
    ...t,
    accountId: t.accountId ?? 'acc_wechat',
    accountName: t.accountName ?? '微信',
    time: t.time ?? '12:00',
  }));
  saveRecords(migrated);
  migrated.forEach(rec => updateBalanceForRecord(rec)); // 补齐账户余额联动
  storage.remove(KEYS.TRANSACTIONS);
}

/** 演示数据（首次打开 fin_records 为空时兜底，让用户有数据可看）。 */
export const DEMO_RECORDS: Transaction[] = [
  { id: 'demo_1', date: '2026-06-21', type: 'expense', amount: 35, category: '餐饮', note: '早午餐咖啡', accountId: 'acc_wechat', accountName: '微信', time: '12:30' },
  { id: 'demo_2', date: '2026-06-20', type: 'income', amount: 15000, category: '工资', note: '6月份实发工资', accountId: 'acc_debit', accountName: '储蓄卡', time: '09:00' },
];

/**
 * 初始化记账数据：确保账户 → 迁移旧数据 → 兜底演示数据。
 * 返回当前 fin_records（供 React state 初始化）。
 */
export function ensureRecords(): Transaction[] {
  ensureAccounts();
  migrateLegacyTransactions();
  const existing = getRecords();
  if (existing.length > 0) return existing;
  // 兜底演示数据，并联动账户余额
  saveRecords(DEMO_RECORDS);
  DEMO_RECORDS.forEach(rec => updateBalanceForRecord(rec));
  return DEMO_RECORDS;
}

/* ────────────────────────────────────────────────────────────
 * 通知监听自动记账（仅安卓 APP，小程序/H5 无此能力）
 * 去重机制仿 templates 的 AutoLog：按日记录已处理的 dedupeKey。
 * ──────────────────────────────────────────────────────────── */

type NotifLog = Record<string, string[]>; // { 'YYYY-MM-DD': dedupeKey[] }

function getNotifLog(): NotifLog {
  return storage.get<NotifLog>(KEYS.NOTIF_LOG) ?? {};
}

/** 今日此 dedupeKey 是否已自动记账（去重，防通知重复触发）。 */
export function isNotifLoggedToday(dedupeKey: string): boolean {
  const log = getNotifLog();
  return (log[todayStr()] ?? []).includes(dedupeKey);
}

/**
 * 商户名 → 分类映射表（覆盖微信/支付宝常见收款方）。
 * 优先于关键词匹配，提升自动记账分类准确率。
 * 来源：微信支付/支付宝常见收款方名称归纳。
 */
const MERCHANT_CATEGORY: Record<string, string> = {
  // 餐饮
  '麦当劳': '餐饮', '肯德基': '餐饮', '肯德基!': '餐饮', '必胜客': '餐饮', '星巴克': '餐饮', '瑞幸': '餐饮',
  '美团': '餐饮', '饿了么': '餐饮', '美团外卖': '餐饮', '海底捞': '餐饮', '喜茶': '餐饮', '奈雪': '餐饮',
  '蜜雪冰城': '餐饮', '汉堡王': '餐饮', '德克士': '餐饮', '华莱士': '餐饮', '老乡鸡': '餐饮', '杨国福': '餐饮',
  '张亮': '餐饮', 'coco': '餐饮', '一点点': '餐饮', '书亦烧仙草': '餐饮', '茶百道': '餐饮',
  // 交通
  '滴滴': '交通', '滴滴出行': '交通', '高德打车': '交通', '曹操出行': '交通', 'T3出行': '交通',
  '12306': '交通', '中国铁路': '交通', '中国石化': '交通', '中国石油': '交通', '中海油': '交通',
  '壳牌': '交通', 'ETC': '交通', '地铁': '交通', '公交': '交通', '哈啰': '交通', '哈啰出行': '交通',
  '美团单车': '交通', '携程': '交通', '去哪儿': '交通', '飞猪': '交通', '南方航空': '交通', '东方航空': '交通',
  // 购物
  '淘宝': '购物', '天猫': '购物', '京东': '购物', '拼多多': '购物', '苏宁': '购物', '唯品会': '购物',
  '得物': '购物', '盒马': '购物', '盒马鲜生': '购物', '大润发': '购物', '沃尔玛': '购物', '永辉': '购物',
  '屈臣氏': '购物', '名创优品': '购物', '宜家': '购物', '小米': '购物', '华为': '购物', '苹果': '购物',
  'Apple': '购物', '当当': '购物', '网易严选': '购物', '1688': '购物',
  // 娱乐
  '腾讯视频': '娱乐', '爱奇艺': '娱乐', '优酷': '娱乐', '哔哩哔哩': '娱乐', '网易云音乐': '娱乐',
  'QQ音乐': '娱乐', '芒果TV': '娱乐', '抖音': '娱乐', 'Steam': '娱乐', '猫眼': '娱乐', '淘票票': '娱乐',
  '万达影城': '娱乐', 'CGV': '娱乐', 'PlayStation': '娱乐', 'Nintendo': '娱乐',
  // 住房
  '自如': '住房', '蛋壳': '住房', '链家': '住房', '贝壳': '住房', '万科': '住房', '物业': '住房',
  // 医疗
  '大药房': '医疗', '药店': '医疗', '仁和': '医疗', '海王星辰': '医疗', '健康': '医疗',
};

/**
 * 关键词猜分类（通知里通常只有金额和商户名，没有标准分类）。
 * 先查商户名映射表（准确），命中不到再用宽泛关键词（兜底）。
 */
function guessCategory(note: string, sourceApp: string): string {
  const s = note + sourceApp;
  // 1. 精确商户名匹配（最准）
  for (const [merchant, cat] of Object.entries(MERCHANT_CATEGORY)) {
    if (s.includes(merchant)) return cat;
  }
  // 2. 宽泛关键词兜底
  if (/餐|食|饭|外卖|咖啡|茶饮/.test(s)) return '餐饮';
  if (/车|行|打车|地铁|公交|加油|停车|高铁|机票/.test(s)) return '交通';
  if (/购|买|超市|便利|商城/.test(s)) return '购物';
  if (/影|电影|游戏|玩|乐|会员|视频/.test(s)) return '娱乐';
  if (/房|租|物业|水电|燃气/.test(s)) return '住房';
  if (/医|药|院|诊|病/.test(s)) return '医疗';
  if (/薪|工资|转入|到账|退款|退|返/.test(s)) return '其他';
  return '其他';
}

export interface NotifRecordInput {
  /** 来源 app 标识：'wechat' | 'alipay' */
  sourceApp: 'wechat' | 'alipay';
  amount: number;
  type: 'income' | 'expense';
  /** 通知文本（用于猜分类和备注） */
  text: string;
  /** 原生侧生成的去重键（packageName+postTime+text 哈希） */
  dedupeKey: string;
  /** 通知时间戳（毫秒），可选 */
  timestamp?: number;
}

/**
 * 从支付通知写入一条记录。已去重（同一 dedupeKey 今日只记一次）。
 * @returns 写入的记录，或 null（重复/无效被跳过）
 */
export function addRecordFromNotification(input: NotifRecordInput): Transaction | null {
  const { amount, type, text, dedupeKey, sourceApp, timestamp } = input;
  if (!amount || amount <= 0 || !dedupeKey) return null;

  // 去重：今日已处理过此通知则跳过
  if (isNotifLoggedToday(dedupeKey)) return null;

  const ts = timestamp ?? Date.now();
  const d = new Date(ts);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const appName = sourceApp === 'wechat' ? '微信' : '支付宝';
  const accountId = sourceApp === 'wechat' ? 'acc_wechat' : 'acc_alipay';

  const record: Transaction = {
    id: `notif_${dedupeKey}`,
    type,
    amount,
    category: guessCategory(text, sourceApp),
    accountId,
    accountName: appName,
    date: dateStr,
    time: timeStr,
    note: `🤖${appName}自动记账`,
    source: 'notification',
    dedupeKey,
  };

  addRecord(record);

  // 写去重日志 + 清理 30 天前（防 storage 膨胀）
  const log = getNotifLog();
  const today = todayStr();
  if (!log[today]) log[today] = [];
  if (!log[today].includes(dedupeKey)) log[today].push(dedupeKey);
  const cutoff = addDaysStr(today, -30);
  for (const date of Object.keys(log)) {
    if (date < cutoff) delete log[date];
  }
  storage.set(KEYS.NOTIF_LOG, log);

  return record;
}

/* ────────────────────────────────────────────────────────────
 * 标签系统（场景化记账：#充电 #车险 #宝宝 #装修 等）
 * 不依赖固定分类，用户自由打标签，按标签筛选/汇总。
 * ──────────────────────────────────────────────────────────── */

/** 预设常用标签（用户也可自定义输入），覆盖常见场景记账 */
export const PRESET_TAGS = [
  '充电', '加油', '车险', '保养', '停车', // 车相关
  '宝宝', '教育', '医疗', '健身', // 人相关
  '装修', '家电', '房租', '物业', // 房相关
  '旅游', '聚餐', '购物', '人情', // 生活
  '报销', '副业', '理财', // 钱相关
];

/**
 * 给指定记录打标签（覆盖原有标签）。
 */
export function setRecordTags(id: string, tags: string[]): void {
  const records = getRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) return;
  records[idx].tags = tags.filter((t) => t.trim()).map((t) => t.replace(/^#/, ''));
  saveRecords(records);
}

/**
 * 查询含指定标签的所有记录。
 */
export function getRecordsByTag(tag: string): Transaction[] {
  const t = tag.replace(/^#/, '');
  return getRecords().filter((r) => r.tags?.includes(t));
}

/**
 * 统计所有标签的使用情况（用于标签筛选条 + 标签总账）。
 * @returns [{ tag, count, totalExpense, totalIncome }]
 */
export function getTagStats(): Array<{ tag: string; count: number; totalExpense: number; totalIncome: number }> {
  const records = getRecords();
  const map = new Map<string, { count: number; totalExpense: number; totalIncome: number }>();
  for (const r of records) {
    if (!r.tags || r.tags.length === 0) continue;
    for (const tag of r.tags) {
      const cur = map.get(tag) || { count: 0, totalExpense: 0, totalIncome: 0 };
      cur.count++;
      if (r.type === 'expense') cur.totalExpense += r.amount;
      else cur.totalIncome += r.amount;
      map.set(tag, cur);
    }
  }
  return Array.from(map.entries())
    .map(([tag, v]) => ({ tag, ...v }))
    .sort((a, b) => b.totalExpense + b.totalIncome - a.totalExpense - a.totalIncome);
}
