/**
 * 企业年金计算引擎（纯函数，平台无关）。
 *
 * 回答用户最关心的 3 个问题：
 * 1. 退休每月能领多少？（按法定计发月数 + 退休后未领部分继续生息）
 * 2. 现在离职/跳槽能带走多少？（企业缴费归属期）
 * 3. 一次性 vs 分期税差？（调用方已有，这里不重复）
 *
 * 法规依据：
 * - 计发月数：复用 pension.ts 的 PENSION_MONTHS 表（40-70岁 31档）
 * - 归属规则：《企业年金办法》第18条：企业缴费可设归属期，常见满8年100%
 *   （实际企业自定，这里按主流 8 年 100% 阶梯估算）
 */

import { getMonthsByAge } from './pension';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 企业缴费归属规则（主流阶梯，企业自定，这里给通用估算） */
export interface VestingRule {
  /** 工作年限 → 企业缴费归属比例（0-1） */
  yearsToRatio: Array<{ years: number; ratio: number }>;
}

/** 主流企业年金归属阶梯（满8年100%，不满按比例） */
export const DEFAULT_VESTING: VestingRule = {
  yearsToRatio: [
    { years: 0, ratio: 0 },
    { years: 1, ratio: 0 },     // 不满1年：企业部分不归属
    { years: 2, ratio: 0.2 },
    { years: 3, ratio: 0.4 },
    { years: 4, ratio: 0.5 },
    { years: 5, ratio: 0.6 },
    { years: 6, ratio: 0.7 },
    { years: 7, ratio: 0.8 },
    { years: 8, ratio: 1.0 },   // 满8年100%
  ],
};

/** 按工龄查归属比例 */
export function getVestingRatio(workYears: number, rule: VestingRule = DEFAULT_VESTING): number {
  let ratio = 0;
  for (const r of rule.yearsToRatio) {
    if (workYears >= r.years) ratio = r.ratio;
  }
  return ratio;
}

export interface AnnuityInput {
  /** 月缴存基数（元/月） */
  monthlyBase: number;
  /** 个人缴存比例（如 0.04） */
  personalRate: number;
  /** 企业匹配比例（如 0.08） */
  companyRate: number;
  /** 已工作年限（用于归属期计算） */
  workedYears: number;
  /** 距退休年数（剩余缴存年限） */
  remainingYears: number;
  /** 历史年化投资收益率（如 0.045） */
  returnRate: number;
  /** 退休年龄（决定计发月数） */
  retireAge: number;
  /** 已有账户余额（元，转入的或历史积累，可选） */
  existingBalance?: number;
  /** 退休后领取期间，未领余额的年化收益率（默认与 returnRate 相同） */
  payoutReturnRate?: number;
}

export interface AnnuityResult {
  /* 积累期 */
  personalMonthly: number;       // 个人月缴
  companyMonthly: number;        // 企业月缴
  totalMonthly: number;          // 双方月缴合计
  personalTotalContribution: number;  // 个人累计缴存本金
  companyTotalContribution: number;   // 企业累计缴存本金
  /** 退休时账户滚存总额（本金+收益） */
  futureValue: number;
  /** 收益部分（滚存 - 本金） */
  earnings: number;

  /* 领取期：退休每月能领多少 */
  payoutMonths: number;          // 计发月数
  monthlyPayout: number;         // 每月领取（税前）
  monthlyPayoutAfterTax: number; // 每月到手（扣3%个税，分期领取优惠税率）
  /** 若按计发月数领完，累计到手 */
  totalPayoutAfterTax: number;

  /* 归属期：离职能带走多少 */
  vestingRatio: number;          // 当前归属比例
  vestedPersonal: number;        // 个人部分（始终100%归属）滚存
  vestedCompany: number;         // 企业部分按归属比例可带走的滚存
  vestedTotal: number;           // 离职共能带走
  unvestedLost: number;          // 因未满归属期损失的（企业部分）

  /* 一次性领取 */
  lumpSumAfterTax: number;       // 一次性到手（扣10%个税）
}

/**
 * 计算企业年金：积累 + 领取 + 归属，一次算清。
 *
 * 积累期：每月缴存按月复利滚存（简化为年末复利，足够估算）
 * 领取期：按法定计发月数均分，未领部分继续按 payoutReturnRate 生息
 */
export function calcAnnuity(input: AnnuityInput): AnnuityResult {
  const {
    monthlyBase, personalRate, companyRate, workedYears, remainingYears,
    returnRate, retireAge, existingBalance = 0, payoutReturnRate,
  } = input;

  const personalMonthly = monthlyBase * personalRate;
  const companyMonthly = monthlyBase * companyRate;
  const totalMonthly = personalMonthly + companyMonthly;

  const totalYears = workedYears + remainingYears;

  // 积累期：年末复利滚存（个人 + 企业 分别算，用于归属拆分）
  // FV = PMT * [((1+r)^n - 1) / r]，r 为年利率，PMT 为年缴存
  const calcFV = (annualContribution: number, years: number, r: number) => {
    if (years <= 0) return 0;
    if (r === 0) return annualContribution * years;
    return annualContribution * ((Math.pow(1 + r, years) - 1) / r);
  };

  // 个人部分：工作以来全部缴存（含历史 workedYears）
  // 简化：假设历史也按相同比例缴存，滚存到退休
  const personalAnnual = personalMonthly * 12;
  const companyAnnual = companyMonthly * 12;

  // 历史已缴部分（workedYears）滚存到退休
  const personalPastFV = calcFV(personalAnnual, workedYears, returnRate) * Math.pow(1 + returnRate, remainingYears);
  const companyPastFV = calcFV(companyAnnual, workedYears, returnRate) * Math.pow(1 + returnRate, remainingYears);
  // 未来缴存部分（remainingYears）
  const personalFutureFV = calcFV(personalAnnual, remainingYears, returnRate);
  const companyFutureFV = calcFV(companyAnnual, remainingYears, returnRate);
  // 已有余额滚存
  const existingFV = existingBalance * Math.pow(1 + returnRate, totalYears);

  const personalFV = personalPastFV + personalFutureFV;
  const companyFV = companyPastFV + companyFutureFV;
  const futureValue = personalFV + companyFV + existingFV;

  const personalTotalContribution = personalAnnual * totalYears;
  const companyTotalContribution = companyAnnual * totalYears;
  const earnings = futureValue - personalTotalContribution - companyTotalContribution - existingBalance;

  // 领取期：按计发月数
  const payoutMonths = getMonthsByAge(retireAge);
  // 考虑退休后未领余额继续生息：实际月领略高于简单均分
  // 精确做法是年金现值公式：月领 = 余额 / [计发月数对应的年金现值因子]
  // 这里用近似：均分 + 一定生息补偿（保守取均分 × 1.08，模拟未领部分生息）
  const payoutRate = payoutReturnRate ?? returnRate;
  // 年金现值因子（按月利率折算计发月数期）
  const monthlyRate = payoutRate / 12;
  const annuityFactor = monthlyRate > 0
    ? (1 - Math.pow(1 + monthlyRate, -payoutMonths)) / monthlyRate
    : payoutMonths;
  const monthlyPayout = futureValue / annuityFactor;

  // 分期领取：3% 优惠个税
  const monthlyPayoutAfterTax = monthlyPayout * 0.97;
  const totalPayoutAfterTax = monthlyPayoutAfterTax * payoutMonths;

  // 一次性领取：10% 个税
  const lumpSumAfterTax = futureValue * 0.90;

  // 归属期：离职能带走多少
  const vestingRatio = getVestingRatio(workedYears);
  // 个人部分始终100%归属
  const vestedPersonal = personalFV + existingFV * 0.5; // 已有余额假设个人企业各半
  // 企业部分按归属比例
  const vestedCompany = companyFV * vestingRatio + existingFV * 0.5 * vestingRatio;
  const vestedTotal = vestedPersonal + vestedCompany;
  const unvestedLost = companyFV * (1 - vestingRatio) + existingFV * 0.5 * (1 - vestingRatio);

  return {
    personalMonthly: round2(personalMonthly),
    companyMonthly: round2(companyMonthly),
    totalMonthly: round2(totalMonthly),
    personalTotalContribution: round2(personalTotalContribution),
    companyTotalContribution: round2(companyTotalContribution),
    futureValue: round2(futureValue),
    earnings: round2(earnings),
    payoutMonths,
    monthlyPayout: round2(monthlyPayout),
    monthlyPayoutAfterTax: round2(monthlyPayoutAfterTax),
    totalPayoutAfterTax: round2(totalPayoutAfterTax),
    vestingRatio,
    vestedPersonal: round2(vestedPersonal),
    vestedCompany: round2(vestedCompany),
    vestedTotal: round2(vestedTotal),
    unvestedLost: round2(unvestedLost),
    lumpSumAfterTax: round2(lumpSumAfterTax),
  };
}
