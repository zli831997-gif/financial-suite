/**
 * 五险一金计算引擎 — 移植自老版 socialCalculator.js（纯函数，平台无关）。
 * 23 城缴费基数上下限 + 各城险种真实比例。支持扣款反推基数（clamp 上下限）+ 正向明细。
 */

export interface InsuranceRate {
  personal: number;
  company: number;
  label: string;
}
export interface CityRates {
  pension: InsuranceRate;
  medical: InsuranceRate;
  unemployment: InsuranceRate;
  workInjury: InsuranceRate;
  maternity: InsuranceRate;
  housingFund: InsuranceRate;
  _note?: string;
}

// 23 城真实比例（2025 年度）
export const CITY_RATES: Record<string, CityRates> = {
  '北京': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.098, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.12, company: 0.12, label: '住房公积金' } },
  '上海': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.10, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.0026, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.07, company: 0.07, label: '住房公积金' } },
  '天津': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.10, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.005, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.12, company: 0.12, label: '住房公积金' } },
  '重庆': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.08, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.0048, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.07, company: 0.07, label: '住房公积金' } },
  '广州': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.055, label: '医疗保险' }, unemployment: { personal: 0.002, company: 0.008, label: '失业保险' }, workInjury: { personal: 0, company: 0.005, label: '工伤保险' }, maternity: { personal: 0, company: 0.0085, label: '生育保险' }, housingFund: { personal: 0.05, company: 0.05, label: '住房公积金' } },
  '深圳': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.05, label: '医疗保险' }, unemployment: { personal: 0.003, company: 0.007, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0.005, label: '生育保险' }, housingFund: { personal: 0.05, company: 0.05, label: '住房公积金' } },
  '东莞': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.005, company: 0.045, label: '医疗保险' }, unemployment: { personal: 0.003, company: 0.007, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0.005, label: '生育保险' }, housingFund: { personal: 0.05, company: 0.05, label: '住房公积金' } },
  '杭州': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.095, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.003, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.12, company: 0.12, label: '住房公积金' } },
  '宁波': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.085, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.003, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.12, company: 0.12, label: '住房公积金' } },
  '南京': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.09, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.08, company: 0.08, label: '住房公积金' } },
  '苏州': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.07, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.08, company: 0.08, label: '住房公积金' } },
  '成都': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.065, label: '医疗保险(含生育)' }, unemployment: { personal: 0.004, company: 0.006, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.06, company: 0.06, label: '住房公积金' } },
  '武汉': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.08, label: '医疗保险(含生育)' }, unemployment: { personal: 0.003, company: 0.007, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.08, company: 0.08, label: '住房公积金' } },
  '济南': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.08, label: '医疗保险(含生育)' }, unemployment: { personal: 0.003, company: 0.007, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.07, company: 0.07, label: '住房公积金' } },
  '青岛': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.08, label: '医疗保险(含生育)' }, unemployment: { personal: 0.003, company: 0.007, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.07, company: 0.07, label: '住房公积金' } },
  '郑州': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.08, label: '医疗保险(含生育)' }, unemployment: { personal: 0.003, company: 0.007, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.05, company: 0.05, label: '住房公积金' } },
  '福州': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.08, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.12, company: 0.12, label: '住房公积金' } },
  '厦门': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.07, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.05, company: 0.05, label: '住房公积金' } },
  '长沙': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.08, label: '医疗保险(含生育)' }, unemployment: { personal: 0.003, company: 0.007, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.05, company: 0.05, label: '住房公积金' } },
  '合肥': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.065, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.06, company: 0.06, label: '住房公积金' } },
  '西安': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.075, label: '医疗保险(含生育)' }, unemployment: { personal: 0.003, company: 0.007, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.05, company: 0.05, label: '住房公积金' } },
  '大连': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.08, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.05, company: 0.05, label: '住房公积金' } },
  '沈阳': { pension: { personal: 0.08, company: 0.16, label: '养老保险' }, medical: { personal: 0.02, company: 0.08, label: '医疗保险(含生育)' }, unemployment: { personal: 0.005, company: 0.005, label: '失业保险' }, workInjury: { personal: 0, company: 0.004, label: '工伤保险' }, maternity: { personal: 0, company: 0, label: '生育保险(已并入医保)' }, housingFund: { personal: 0.05, company: 0.05, label: '住房公积金' } },
};

// 缴费基数上下限（2025 年度，全口径社平工资 60%-300%）
export const BASE_LIMITS: Record<string, { min: number; max: number; socialAvg: number }> = {
  '北京': { min: 7162, max: 35811, socialAvg: 11937 },
  '上海': { min: 7460, max: 37302, socialAvg: 12434 },
  '天津': { min: 5124, max: 25620, socialAvg: 8540 },
  '重庆': { min: 4350, max: 21750, socialAvg: 7250 },
  '广州': { min: 5500, max: 27501, socialAvg: 9167 },
  '深圳': { min: 5500, max: 27501, socialAvg: 9167 },
  '东莞': { min: 4775, max: 23874, socialAvg: 7958 },
  '杭州': { min: 5500, max: 24930, socialAvg: 8310 },
  '宁波': { min: 5500, max: 24930, socialAvg: 8310 },
  '南京': { min: 4880, max: 24042, socialAvg: 8014 },
  '苏州': { min: 4880, max: 24042, socialAvg: 8014 },
  '成都': { min: 4510, max: 22554, socialAvg: 7518 },
  '武汉': { min: 4498, max: 22490, socialAvg: 7496 },
  '济南': { min: 4504, max: 22521, socialAvg: 7507 },
  '青岛': { min: 4504, max: 22521, socialAvg: 7507 },
  '郑州': { min: 3831, max: 19155, socialAvg: 6385 },
  '福州': { min: 4425, max: 22125, socialAvg: 7375 },
  '厦门': { min: 4425, max: 22125, socialAvg: 7375 },
  '长沙': { min: 4072, max: 20361, socialAvg: 6787 },
  '合肥': { min: 4227, max: 21135, socialAvg: 7045 },
  '西安': { min: 4350, max: 22750, socialAvg: 7583 },
  '大连': { min: 4100, max: 20500, socialAvg: 6833 },
  '沈阳': { min: 4100, max: 20500, socialAvg: 6833 },
  'default': { min: 4462, max: 22314, socialAvg: 7438 },
};

export function getCityRates(city: string): CityRates {
  return CITY_RATES[city] || CITY_RATES['北京'];
}
export function getBaseLimits(city: string): { min: number; max: number; socialAvg: number } {
  return BASE_LIMITS[city] || BASE_LIMITS['default'];
}
export function getCities(): string[] {
  return Object.keys(CITY_RATES);
}
export function clampBase(base: number, city: string): number {
  const { min, max } = getBaseLimits(city);
  return Math.max(min, Math.min(max, base));
}

/** 个人比例合计（排除工伤/生育个人为0） */
function sumPersonalRate(rates: CityRates): number {
  let sum = 0;
  for (const key of Object.keys(rates)) {
    if (key.startsWith('_')) continue;
    sum += (rates as any)[key].personal;
  }
  return sum;
}

export interface ReverseBaseResult {
  base: number;
  rawBase: number;
  clamped: boolean;
  personalRateTotal: number;
  minDeduction: number;
  maxDeduction: number;
}

/** 扣款反推缴费基数（含上下限 clamp） */
export function reverseBaseFromDeduction(city: string, deduction: number, fundRate?: number): ReverseBaseResult {
  const limits = getBaseLimits(city);
  if (!deduction || deduction <= 0) {
    return { base: 0, rawBase: 0, clamped: false, personalRateTotal: 0, minDeduction: 0, maxDeduction: 0 };
  }
  const rates = { ...getCityRates(city) };
  if (fundRate != null) rates.housingFund = { personal: fundRate, company: fundRate, label: '住房公积金' };
  const personalRateTotal = sumPersonalRate(rates);
  const rawBase = deduction / personalRateTotal;
  const base = clampBase(rawBase, city);
  return {
    personalRateTotal: Math.round(personalRateTotal * 10000) / 100,
    rawBase: Math.round(rawBase * 100) / 100,
    base,
    clamped: Math.abs(rawBase - base) > 1,
    minDeduction: Math.round(limits.min * personalRateTotal * 100) / 100,
    maxDeduction: Math.round(limits.max * personalRateTotal * 100) / 100,
  };
}

export interface SocialItem {
  key: string;
  label: string;
  personalRate: number;
  companyRate: number;
  personalAmount: number;
  companyAmount: number;
  total: number;
}
export interface SocialResult {
  city: string;
  base: number;
  items: SocialItem[];
  personalTotal: number;
  companyTotal: number;
  total: number;
}

/** 正向：base → 各险种明细（base 会被 clamp 到城市上下限） */
export function calcSocialInsurance(city: string, base: number, fundRate?: number): SocialResult {
  const rates = { ...getCityRates(city) };
  if (fundRate != null) rates.housingFund = { personal: fundRate, company: fundRate, label: '住房公积金' };
  const actualBase = clampBase(base, city);
  const items: SocialItem[] = [];
  let personalTotal = 0, companyTotal = 0;
  for (const key of Object.keys(rates)) {
    if (key.startsWith('_')) continue;
    const r: InsuranceRate = (rates as any)[key];
    const personalAmount = Math.round(actualBase * r.personal * 100) / 100;
    const companyAmount = Math.round(actualBase * r.company * 100) / 100;
    personalTotal += personalAmount;
    companyTotal += companyAmount;
    items.push({
      key, label: r.label,
      personalRate: Math.round(r.personal * 10000) / 100,
      companyRate: Math.round(r.company * 10000) / 100,
      personalAmount, companyAmount, total: personalAmount + companyAmount,
    });
  }
  return {
    city, base: actualBase, items,
    personalTotal: Math.round(personalTotal * 100) / 100,
    companyTotal: Math.round(companyTotal * 100) / 100,
    total: Math.round((personalTotal + companyTotal) * 100) / 100,
  };
}

/** 简化 compat：扣款 → 基数（默认城市，返回 number；供 financeState re-export） */
export function reverseSocialSecurityBase(deduction: number): number {
  return reverseBaseFromDeduction('default', deduction).base;
}
