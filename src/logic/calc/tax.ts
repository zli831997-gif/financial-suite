/**
 * 个税计算引擎 — 移植自老版 taxCalculator.js（纯函数，平台无关）。
 * 累计预扣预缴（年度12月）+ 年终红单独/合并对比 + 劳务报酬 + 专项附加扣除。
 */

export const COMPREHENSIVE_TAX_BRACKETS = [
  { upper: 36000, rate: 0.03, deduction: 0 },
  { upper: 144000, rate: 0.10, deduction: 2520 },
  { upper: 300000, rate: 0.20, deduction: 16920 },
  { upper: 420000, rate: 0.25, deduction: 31920 },
  { upper: 660000, rate: 0.30, deduction: 52920 },
  { upper: 960000, rate: 0.35, deduction: 85920 },
  { upper: Infinity, rate: 0.45, deduction: 181920 },
];

export const BONUS_TAX_BRACKETS = [
  { upper: 36000, rate: 0.03, deduction: 0 },
  { upper: 144000, rate: 0.10, deduction: 210 },
  { upper: 300000, rate: 0.20, deduction: 1410 },
  { upper: 420000, rate: 0.25, deduction: 2660 },
  { upper: 660000, rate: 0.30, deduction: 4410 },
  { upper: 960000, rate: 0.35, deduction: 7160 },
  { upper: Infinity, rate: 0.45, deduction: 15160 },
];

export const LABOR_TAX_BRACKETS = [
  { upper: 20000, rate: 0.20, deduction: 0 },
  { upper: 50000, rate: 0.30, deduction: 2000 },
  { upper: Infinity, rate: 0.40, deduction: 7000 },
];

export const TAX_THRESHOLD = 5000; // 月起征点
export const ANNUAL_THRESHOLD = 60000; // 年起征点

export const SPECIAL_DEDUCTION_STANDARDS = {
  childrenEducation: { label: '子女教育', monthly: 2000 },
  continuingEducation: { label: '继续教育', monthly: 400 },
  seriousIllness: { label: '大病医疗', monthly: 0 },
  housingLoan: { label: '住房贷款利息', monthly: 1000 },
  housingRent: { label: '住房租金', monthly: 1500 },
  elderlyCare: { label: '赡养老人', monthly: 3000 },
  infantCare: { label: '3岁以下婴幼儿照护', monthly: 2000 },
};

interface Bracket { upper: number; rate: number; deduction: number }

function findBracket(income: number, brackets: Bracket[]): Bracket {
  for (const b of brackets) if (income <= b.upper) return b;
  return brackets[brackets.length - 1];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 累计应纳税额（按年度综合所得7级） */
export function calcCumulativeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const b = findBracket(taxableIncome, COMPREHENSIVE_TAX_BRACKETS);
  return taxableIncome * b.rate - b.deduction;
}

export interface MonthlyTaxResult {
  month: number;
  monthlyTaxableIncome: number;
  cumulativeTaxableIncome: number;
  cumulativeTax: number;
  currentMonthTax: number;
  afterTaxIncome: number;
  marginalRate: number;
  nextPrevTaxableIncome: number;
  nextPrevTaxPaid: number;
}

/** 单月累计预扣 */
export function calcMonthlySalaryTax(params: {
  monthlySalary: number;
  socialInsurance?: number;
  specialDeduction?: number;
  monthIndex?: number;
  prevTaxableIncome?: number;
  prevTaxPaid?: number;
}): MonthlyTaxResult {
  const { monthlySalary, socialInsurance = 0, specialDeduction = 0, monthIndex = 1, prevTaxableIncome = 0, prevTaxPaid = 0 } = params;
  const monthlyTaxableIncome = Math.max(0, monthlySalary - socialInsurance - specialDeduction - TAX_THRESHOLD);
  const cumulativeTaxableIncome = prevTaxableIncome + monthlyTaxableIncome;
  const cumulativeTax = calcCumulativeTax(cumulativeTaxableIncome);
  const currentMonthTax = Math.max(0, cumulativeTax - prevTaxPaid);
  const afterTaxIncome = monthlySalary - socialInsurance - currentMonthTax;
  const b = findBracket(cumulativeTaxableIncome, COMPREHENSIVE_TAX_BRACKETS);
  return {
    month: monthIndex,
    monthlyTaxableIncome: round2(monthlyTaxableIncome),
    cumulativeTaxableIncome: round2(cumulativeTaxableIncome),
    cumulativeTax: round2(cumulativeTax),
    currentMonthTax: round2(currentMonthTax),
    afterTaxIncome: round2(afterTaxIncome),
    marginalRate: b.rate,
    nextPrevTaxableIncome: cumulativeTaxableIncome,
    nextPrevTaxPaid: cumulativeTax,
  };
}

/** 年度累计预扣（12月），返回各月明细 + 年税 */
export function calcAnnualSalaryTax(params: { monthlySalary: number; socialInsurance?: number; specialDeduction?: number }) {
  const months: MonthlyTaxResult[] = [];
  let prevTaxable = 0, prevPaid = 0;
  for (let m = 1; m <= 12; m++) {
    const r = calcMonthlySalaryTax({ ...params, monthIndex: m, prevTaxableIncome: prevTaxable, prevTaxPaid: prevPaid });
    months.push(r);
    prevTaxable = r.nextPrevTaxableIncome;
    prevPaid = r.nextPrevTaxPaid;
  }
  const totalTax = months.reduce((s, r) => s + r.currentMonthTax, 0);
  const annualSalary = (params.monthlySalary || 0) * 12;
  return {
    months,
    annualTax: round2(totalTax),
    annualAfterTaxIncome: round2(months.reduce((s, r) => s + r.afterTaxIncome, 0)),
    annualSalary,
    effectiveRate: annualSalary > 0 ? totalTax / annualSalary : 0,
  };
}

/** 年终奖：单独计税 vs 并入综合所得 对比 + 推荐 */
export function calcBonusTax(bonusAmount: number, annualSalaryTotal: number, annualSocial: number, annualSpecial: number) {
  if (bonusAmount <= 0) {
    return { bonusAmount, separate: { tax: 0, afterTax: 0, rateLabel: '' }, merged: { tax: 0, afterTax: 0 }, recommendation: { plan: 'separate', planLabel: '单独计税', savings: 0, savingsText: '' } };
  }
  const monthlyBonus = bonusAmount / 12;
  const bSep = findBracket(monthlyBonus, BONUS_TAX_BRACKETS);
  const separateTax = bonusAmount * bSep.rate - bSep.deduction;

  const combinedTaxable = Math.max(0, annualSalaryTotal + bonusAmount - annualSocial - annualSpecial - ANNUAL_THRESHOLD);
  const combinedTax = calcCumulativeTax(combinedTaxable);
  const salaryOnlyTaxable = Math.max(0, annualSalaryTotal - annualSocial - annualSpecial - ANNUAL_THRESHOLD);
  const salaryOnlyTax = calcCumulativeTax(salaryOnlyTaxable);
  const mergedTax = combinedTax - salaryOnlyTax;

  const better: 'separate' | 'merged' = separateTax <= mergedTax ? 'separate' : 'merged';
  return {
    bonusAmount,
    separate: { tax: round2(separateTax), afterTax: round2(bonusAmount - separateTax), rateLabel: `${Math.round(bSep.rate * 100)}%` },
    merged: { tax: round2(mergedTax), afterTax: round2(bonusAmount - mergedTax) },
    recommendation: {
      plan: better,
      planLabel: better === 'separate' ? '单独计税' : '并入综合所得',
      savings: round2(Math.abs(separateTax - mergedTax)),
      savingsText: better === 'separate' ? '单独计税更划算' : '并入综合所得更划算',
    },
  };
}

/** 劳务报酬预扣（≤4000 扣800 / >4000 扣20% + 3级累进） */
export function calcLaborTax(income: number) {
  if (income <= 0) return { income, deduction: 0, taxableIncome: 0, rate: 0, tax: 0, afterTax: 0 };
  const deduction = income <= 4000 ? 800 : income * 0.2;
  const taxableIncome = income - deduction;
  const b = findBracket(taxableIncome, LABOR_TAX_BRACKETS);
  const tax = taxableIncome * b.rate - b.deduction;
  return { income, deduction, taxableIncome: round2(taxableIncome), rate: b.rate, tax: round2(tax), afterTax: round2(income - tax) };
}
