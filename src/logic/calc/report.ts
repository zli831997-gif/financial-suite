/**
 * 报表计算引擎 — 利润表 + 现金流量表（纯函数，平台无关）。
 * 把个人当公司管：利润表看「赚多少花多少」，现金流量表看「钱从哪来到哪去」。
 */

import type { Transaction } from '../../types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 期间标识：YYYY-MM（月）或 YYYY（年）。 */
export type Period = string;

// ─────────────────────────────────────────────
// 期间过滤与归类
// ─────────────────────────────────────────────

/** 一条记录是否落在某期间（月 'YYYY-MM' 或年 'YYYY'）。 */
function inPeriod(dateStr: string, period: Period): boolean {
  if (!dateStr) return false;
  // 期间是年（4 位）
  if (period.length === 4) return dateStr.startsWith(period);
  // 期间是月（YYYY-MM）
  return dateStr.startsWith(period);
}

/** 筛选落在期间内的记录。 */
export function filterByPeriod(records: Transaction[], period: Period): Transaction[] {
  return records.filter(r => inPeriod(r.date, period));
}

// ─────────────────────────────────────────────
// 利润表（Income Statement）
// ─────────────────────────────────────────────

export interface CategoryBreakdown {
  category: string;
  amount: number; // 该分类总额
  count: number; // 笔数
  ratio: number; // 占同向（收入/支出）总额的比例，0-1
}

export interface IncomeStatement {
  period: Period;
  totalIncome: number;
  totalExpense: number;
  surplus: number; // 结余 = 收入 - 支出
  surplusRate: number; // 储蓄率 = 结余 / 收入
  incomeByCategory: CategoryBreakdown[]; // 收入分类明细（降序）
  expenseByCategory: CategoryBreakdown[]; // 支出分类明细（降序，Top N 由调用方切）
  recordCount: number;
}

/** 把记录按 category 聚合成明细（降序），并算占比。 */
function breakdownByCategory(records: Transaction[], type: 'income' | 'expense'): CategoryBreakdown[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const r of records) {
    if (r.type !== type) continue;
    const cur = map.get(r.category) || { amount: 0, count: 0 };
    cur.amount += r.amount;
    cur.count += 1;
    map.set(r.category, cur);
  }
  const total = Array.from(map.values()).reduce((s, v) => s + v.amount, 0);
  return Array.from(map.entries())
    .map(([category, v]) => ({
      category,
      amount: round2(v.amount),
      count: v.count,
      ratio: total > 0 ? v.amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * 构建利润表：总收入 / 总支出 / 结余 / 储蓄率 / 分类明细。
 * @param records 全量记账记录（函数内按 period 过滤）
 * @param period  YYYY-MM（月）或 YYYY（年）
 */
export function buildIncomeStatement(records: Transaction[], period: Period): IncomeStatement {
  const inPeriodRecords = filterByPeriod(records, period);
  const totalIncome = round2(
    inPeriodRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  );
  const totalExpense = round2(
    inPeriodRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  );
  const surplus = round2(totalIncome - totalExpense);
  const surplusRate = totalIncome > 0 ? surplus / totalIncome : 0;

  return {
    period,
    totalIncome,
    totalExpense,
    surplus,
    surplusRate,
    incomeByCategory: breakdownByCategory(inPeriodRecords, 'income'),
    expenseByCategory: breakdownByCategory(inPeriodRecords, 'expense'),
    recordCount: inPeriodRecords.length,
  };
}

// ─────────────────────────────────────────────
// 现金流量表（Cash Flow Statement）
// ─────────────────────────────────────────────

/**
 * 个人现金流量表三分类（对齐企业会计准则的三类活动）：
 * - operating 经营活动：日常收支（工资、餐饮、购物、交通等）
 * - investing 投资活动：投资买入/卖出、投资收益（分红/利息/理财）
 * - financing 筹资活动：借贷与还款（房贷/车贷月供、借入/偿还借款）
 *
 * 按 category 关键词归类，落不进关键词的默认归入经营。
 */

export type CashFlowActivity = 'operating' | 'investing' | 'financing';

export interface CashFlowLine {
  activity: CashFlowActivity;
  inflow: number; // 流入
  outflow: number; // 流出
  net: number; // 净额 = 流入 - 流出
}

export interface CashFlowStatement {
  period: Period;
  lines: CashFlowLine[]; // 三类活动各一行
  netChange: number; // 现金净增减额 = 三类净额之和
  recordCount: number;
}

// 投资类关键词（category 命中即归投资）
const INVESTING_KEYWORDS = ['投资', '理财', '分红', '利息', '基金', '股票', '收益', '股息', '存款利息'];
// 筹资类关键词
const FINANCING_KEYWORDS = ['房贷', '车贷', '还款', '借款', '还贷', '贷款', '借出', '借入', '偿还', '信用卡还款'];

function classifyActivity(record: Transaction): CashFlowActivity {
  const cat = record.category || '';
  if (INVESTING_KEYWORDS.some(k => cat.includes(k))) return 'investing';
  if (FINANCING_KEYWORDS.some(k => cat.includes(k))) return 'financing';
  return 'operating';
}

/**
 * 构建现金流量表：经营/投资/筹资三类活动的流入流出与净额。
 * @param records 全量记账记录
 * @param period  YYYY-MM 或 YYYY
 */
export function buildCashFlowStatement(records: Transaction[], period: Period): CashFlowStatement {
  const inPeriodRecords = filterByPeriod(records, period);
  const buckets: Record<CashFlowActivity, CashFlowLine> = {
    operating: { activity: 'operating', inflow: 0, outflow: 0, net: 0 },
    investing: { activity: 'investing', inflow: 0, outflow: 0, net: 0 },
    financing: { activity: 'financing', inflow: 0, outflow: 0, net: 0 },
  };

  for (const r of inPeriodRecords) {
    const act = classifyActivity(r);
    if (r.type === 'income') buckets[act].inflow += r.amount;
    else buckets[act].outflow += r.amount;
  }

  const lines = (['operating', 'investing', 'financing'] as CashFlowActivity[]).map(a => {
    const line = buckets[a];
    const inflow = round2(line.inflow);
    const outflow = round2(line.outflow);
    return { activity: a, inflow, outflow, net: round2(inflow - outflow) };
  });

  const netChange = round2(lines.reduce((s, l) => s + l.net, 0));

  return { period, lines, netChange, recordCount: inPeriodRecords.length };
}

// ─────────────────────────────────────────────
// 多期对比（走势图数据源）
// ─────────────────────────────────────────────

export interface PeriodTrendPoint {
  period: Period;
  income: number;
  expense: number;
  surplus: number;
  netCashChange: number;
}

/** 列出记录中出现的所有月份（YYYY-MM），降序。 */
export function listMonthPeriods(records: Transaction[]): string[] {
  const months = new Set<string>();
  for (const r of records) {
    if (r.date && r.date.length >= 7) months.add(r.date.slice(0, 7));
  }
  return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
}

/**
 * 生成最近 N 个月的走势（收入/支出/结余/现金净增），最旧→最新排序，供折线图用。
 * @param records 全量记录
 * @param months  取最近几个月（默认 6）
 */
export function buildMonthlyTrend(records: Transaction[], months = 6): PeriodTrendPoint[] {
  const allMonths = listMonthPeriods(records);
  const recent = allMonths.slice(0, months).reverse(); // 最旧→最新
  return recent.map(period => {
    const is = buildIncomeStatement(records, period);
    const cf = buildCashFlowStatement(records, period);
    return {
      period,
      income: is.totalIncome,
      expense: is.totalExpense,
      surplus: is.surplus,
      netCashChange: cf.netChange,
    };
  });
}
