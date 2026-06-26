/**
 * 房贷 / 贷款计算引擎 — 纯函数，平台无关。
 *
 * - 等额本息 / 等额本金两种还款方式（公式移植自老版 mini-app calcMortgage）
 * - 提前还贷模拟（老版缺失，本版新增）：一次性还 N 万 → 缩短年限 vs 减少月供 两方案对比
 * - 还款明细表（摊销表），供图表与「省多少利息」核算用
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 月利率 = 年利率 / 12 / 100（输入年利率如 4.1 表示 4.1%）。 */
function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12;
}

// ─────────────────────────────────────────────
// 基础：两种还款方式
// ─────────────────────────────────────────────

export interface EqualPaymentResult {
  monthly: number; // 每月还款（固定）
  total: number; // 还款总额
  interest: number; // 利息总额
}

export interface EqualPrincipalResult {
  firstMonth: number; // 首月还款（最高）
  monthlyPrincipal: number; // 每月本金（固定）
  total: number; // 还款总额
  interest: number; // 利息总额
  lastMonth: number; // 末月还款（最低）
}

/** 等额本息：月供 = P·r·(1+r)^n / ((1+r)^n − 1)。 */
export function calcEqualPayment(
  principal: number,
  years: number,
  annualRatePct: number
): EqualPaymentResult {
  const p = Math.max(0, principal);
  const n = Math.max(0, Math.round(years * 12));
  const r = monthlyRate(annualRatePct);
  if (n === 0) return { monthly: 0, total: 0, interest: 0 };
  const monthly = r > 0 ? (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : p / n;
  const total = monthly * n;
  return { monthly: round2(monthly), total: round2(total), interest: round2(total - p) };
}

/** 等额本金：每月本金固定 = P/n，月供 = 本金 + 剩余本金·r。 */
export function calcEqualPrincipal(
  principal: number,
  years: number,
  annualRatePct: number
): EqualPrincipalResult {
  const p = Math.max(0, principal);
  const n = Math.max(0, Math.round(years * 12));
  const r = monthlyRate(annualRatePct);
  if (n === 0) return { firstMonth: 0, monthlyPrincipal: 0, total: 0, interest: 0, lastMonth: 0 };
  const monthlyPrincipal = p / n;
  const firstMonth = monthlyPrincipal + p * r;
  const lastMonth = monthlyPrincipal + monthlyPrincipal * r; // 最后一月只剩一个月本金
  // 等差数列求和利息：(n+1)·P·r / 2
  const interest = ((n + 1) * p * r) / 2;
  const total = p + interest;
  return {
    firstMonth: round2(firstMonth),
    monthlyPrincipal: round2(monthlyPrincipal),
    total: round2(total),
    interest: round2(interest),
    lastMonth: round2(lastMonth),
  };
}

export interface LoanCompareResult {
  principal: number;
  totalMonths: number;
  equalPayment: EqualPaymentResult;
  equalPrincipal: EqualPrincipalResult;
  /** 等额本息比等额本金多付的利息（>0 说明等额本息总利息更高）。 */
  interestDiff: number;
}

/** 两方式对比。 */
export function compareLoanMethods(
  principal: number,
  years: number,
  annualRatePct: number
): LoanCompareResult {
  const equalPayment = calcEqualPayment(principal, years, annualRatePct);
  const equalPrincipal = calcEqualPrincipal(principal, years, annualRatePct);
  return {
    principal,
    totalMonths: Math.round(years * 12),
    equalPayment,
    equalPrincipal,
    interestDiff: round2(equalPayment.interest - equalPrincipal.interest),
  };
}

// ─────────────────────────────────────────────
// 还款明细表（摊销表）
// ─────────────────────────────────────────────

export interface AmortizationRow {
  month: number; // 第几期
  payment: number; // 当月总还款
  principalPart: number; // 还本金
  interestPart: number; // 还利息
  balance: number; // 剩余本金
}

/**
 * 生成等额本息摊销表（提前还贷模拟的核心数据源）。
 * @param principal     初始本金
 * @param totalMonths   总期数
 * @param annualRatePct 年利率（%）
 */
export function generateAmortizationSchedule(
  principal: number,
  totalMonths: number,
  annualRatePct: number
): AmortizationRow[] {
  const p = Math.max(0, principal);
  const n = Math.max(0, Math.round(totalMonths));
  const r = monthlyRate(annualRatePct);
  if (n === 0 || p === 0) return [];
  const monthly = r > 0 ? (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : p / n;
  const rows: AmortizationRow[] = [];
  let balance = p;
  for (let m = 1; m <= n; m++) {
    const interestPart = balance * r;
    let principalPart = monthly - interestPart;
    // 最后一期处理尾差
    if (m === n) principalPart = balance;
    balance = Math.max(0, balance - principalPart);
    rows.push({
      month: m,
      payment: round2(principalPart + interestPart),
      principalPart: round2(principalPart),
      interestPart: round2(interestPart),
      balance: round2(balance),
    });
  }
  return rows;
}

// ─────────────────────────────────────────────
// 提前还贷模拟（核心新功能）
// ─────────────────────────────────────────────

export interface PrepaymentInput {
  principal: number; // 贷款总本金
  years: number; // 贷款总年限
  annualRatePct: number; // 年利率（%）
  paidMonths: number; // 已还期数（月）
  prepayAmount: number; // 一次性提前还款金额
}

export interface PrepaymentScheme {
  name: string; // 方案名
  /** 模拟后剩余的总利息（从提前还款那一刻起，到还清为止） */
  remainingInterest: number;
  /** 模拟后剩余的总还款（本金+利息，从提前还款起） */
  remainingTotal: number;
  remainingMonths: number; // 剩余还需还多少期
  monthlyPayment: number; // 模拟后的月供
  /** 相比「不提前还款」省下的利息 */
  savedInterest: number;
  /** 相比「不提前还款」提前还清的月数 */
  savedMonths: number;
}

export interface PrepaymentResult {
  /** 不提前还款的基线（剩余部分） */
  baseline: PrepaymentScheme;
  /** 方案一：缩短年限（月供不变） */
  shortenTerm: PrepaymentScheme;
  /** 方案二：减少月供（年限不变） */
  reducePayment: PrepaymentScheme;
  /** 两方案中省利息更多的那个 */
  recommendation: 'shortenTerm' | 'reducePayment';
  balanceAfterPrepay: number; // 提前还款后的剩余本金
}

/**
 * 提前还贷模拟。
 *
 * 算法（等额本息口径）：
 * 1. 用摊销表算到第 paidMonths 期的剩余本金 balanceK；
 * 2. 提前还款 prepayAmount 直接冲抵 → newBalance = balanceK − prepayAmount；
 * 3. 基线：不提前，剩余 (totalMonths − paidMonths) 期继续按原月供还；
 * 4. 方案一「缩短年限」：月供保持原月供不变，用 newBalance + 原月供 + 原利率反推剩余期数；
 * 5. 方案二「减少月供」：期数保持 (totalMonths − paidMonths) 不变，用 newBalance + 原期数 + 原利率重算月供。
 *
 * @returns 两方案 + 基线 + 推荐
 */
export function simulatePrepayment(input: PrepaymentInput): PrepaymentResult {
  const { principal, years, annualRatePct, paidMonths, prepayAmount } = input;
  const totalMonths = Math.round(years * 12);
  const r = monthlyRate(annualRatePct);
  const K = Math.min(Math.max(0, Math.round(paidMonths)), totalMonths);
  const remainingMonthsOriginal = Math.max(0, totalMonths - K);

  // 原月供
  const originalMonthly =
    r > 0 ? (principal * r * Math.pow(1 + r, totalMonths)) / (Math.pow(1 + r, totalMonths) - 1) : principal / totalMonths;

  // 第 K 期剩余本金（摊销表）
  const schedule = generateAmortizationSchedule(principal, totalMonths, annualRatePct);
  const balanceK = K === 0 ? principal : schedule[K - 1]?.balance ?? 0;

  // 基线：不提前还款，剩余部分的总利息
  const baselineRemainingInterest = schedule
    .slice(K)
    .reduce((s, row) => s + row.interestPart, 0);

  // 提前还款后剩余本金
  const newBalance = Math.max(0, balanceK - prepayAmount);

  // —— 方案一：缩短年限（月供 = 原月供，反推期数）——
  // 由 月供 = B·r·(1+r)^n / ((1+r)^n − 1) 解 n：
  //   (1+r)^n = monthly / (monthly − B·r)
  //   n = ln(monthly/(monthly−B·r)) / ln(1+r)
  let shortenMonths = remainingMonthsOriginal;
  let shortenMonthly = originalMonthly;
  let shortenInterest = 0;
  if (newBalance > 0 && r > 0) {
    const denom = originalMonthly - newBalance * r;
    if (denom > 0) {
      shortenMonths = Math.ceil(Math.log(originalMonthly / denom) / Math.log(1 + r));
      shortenMonths = Math.max(1, shortenMonths);
    }
    const sch = generateAmortizationSchedule(newBalance, shortenMonths, annualRatePct);
    shortenMonthly = sch[0] ? sch[0].payment : originalMonthly;
    shortenInterest = sch.reduce((s, row) => s + row.interestPart, 0);
  } else if (newBalance <= 0) {
    shortenMonths = 0; // 一次性还清
    shortenInterest = 0;
  }

  // —— 方案二：减少月供（期数 = 原剩余期数，重算月供）——
  let reduceMonthly = originalMonthly;
  let reduceInterest = 0;
  if (newBalance > 0) {
    const sch = generateAmortizationSchedule(newBalance, remainingMonthsOriginal, annualRatePct);
    reduceMonthly = sch[0] ? sch[0].payment : originalMonthly;
    reduceInterest = sch.reduce((s, row) => s + row.interestPart, 0);
  } else {
    reduceMonthly = 0;
    reduceInterest = 0;
  }

  const mkScheme = (
    name: string,
    remainingInterest: number,
    remainingMonths: number,
    monthlyPayment: number
  ): PrepaymentScheme => ({
    name,
    remainingInterest: round2(remainingInterest),
    remainingTotal: round2(remainingInterest + newBalance),
    remainingMonths,
    monthlyPayment: round2(monthlyPayment),
    savedInterest: round2(baselineRemainingInterest - remainingInterest),
    savedMonths: remainingMonthsOriginal - remainingMonths,
  });

  const baseline = mkScheme('不提前还款', baselineRemainingInterest, remainingMonthsOriginal, originalMonthly);
  const shortenTerm = mkScheme('缩短年限（月供不变）', shortenInterest, shortenMonths, shortenMonthly);
  const reducePayment = mkScheme('减少月供（年限不变）', reduceInterest, remainingMonthsOriginal, reduceMonthly);

  // 推荐：通常「缩短年限」省利息更多；月供降幅大且利息接近时也可考虑减月供
  const recommendation: 'shortenTerm' | 'reducePayment' =
    shortenTerm.savedInterest >= reducePayment.savedInterest ? 'shortenTerm' : 'reducePayment';

  return {
    baseline,
    shortenTerm,
    reducePayment,
    recommendation,
    balanceAfterPrepay: round2(newBalance),
  };
}
