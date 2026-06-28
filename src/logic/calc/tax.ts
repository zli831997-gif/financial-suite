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

/* ════════════════════════════════════════════════════════════════
 * 退税模拟：年度综合所得汇算 + 专项附加扣除完整版
 *
 * 与上面的"月薪累计预扣"区别：汇算清缴是把全年各项收入汇总后
 * 按综合所得7级税率一次性算全年应纳税，再对比已预扣，多退少补。
 * ════════════════════════════════════════════════════════════════ */

/** 租金按城市分档：直辖市1500 / 省会1100 / 其他1000（元/月） */
export type RentCityTier = 'municipality' | 'capital' | 'other';
export const RENT_STANDARDS: Record<RentCityTier, { label: string; monthly: number }> = {
  municipality: { label: '直辖市/计划单列市', monthly: 1500 },
  capital: { label: '省会城市', monthly: 1100 },
  other: { label: '其他城市', monthly: 1000 },
};
export function calcRentDeduction(tier: RentCityTier): number {
  return RENT_STANDARDS[tier].monthly * 12;
}

/**
 * 专项附加扣除完整版（年度合计）。
 * 严格按现行《个人所得税法》专项附加扣除暂行办法。
 * @returns 各项年度扣除额 + 合计 + 明细
 */
export interface SpecialDeductionInput {
  childrenEducationCount?: number;    // 子女教育：受教育的子女数（2000/月/人）
  infantCareCount?: number;           // 3岁以下婴幼儿照护人数（2000/月/人）
  continuingEducationType?: 'degree' | 'vocational' | 'none'; // 继续教育：学历400/月 或 职业3600/年
  seriousIllnessExpense?: number;     // 大病医疗：医保目录内自付金额（据实，超1.5万部分，上限8万）
  housingLoan?: boolean;              // 住房贷款利息（1000/月，与租金互斥）
  housingRent?: { tier: RentCityTier } | null; // 住房租金（与贷款互斥）
  elderlyCare?: {
    onlyChild: boolean;               // 是否独生子女
    sharePercent?: number;            // 非独生：本人分摊比例（0-100，独生按100）。非独生上限1500/月
  } | null;
}
export interface SpecialDeductionItem {
  key: string;
  label: string;
  amount: number;
  note?: string;
}
export interface SpecialDeductionResult {
  items: SpecialDeductionItem[];
  total: number; // 年度合计
}

export function calcSpecialDeductions(input: SpecialDeductionInput): SpecialDeductionResult {
  const items: SpecialDeductionItem[] = [];

  // 1. 子女教育 2000/月/人
  const childN = Math.max(0, input.childrenEducationCount || 0);
  if (childN > 0) {
    items.push({ key: 'childrenEducation', label: '子女教育', amount: 2000 * childN * 12, note: `${childN}子女 × 2000/月` });
  }

  // 2. 3岁以下婴幼儿照护 2000/月/人
  const infantN = Math.max(0, input.infantCareCount || 0);
  if (infantN > 0) {
    items.push({ key: 'infantCare', label: '3岁以下婴幼儿照护', amount: 2000 * infantN * 12, note: `${infantN}子女 × 2000/月` });
  }

  // 3. 继续教育：学历 400/月（最长48个月，这里按全年算），职业证书 3600/年（按年）
  if (input.continuingEducationType === 'degree') {
    items.push({ key: 'continuingEducation', label: '继续教育(学历)', amount: 400 * 12, note: '400/月' });
  } else if (input.continuingEducationType === 'vocational') {
    items.push({ key: 'continuingEducation', label: '继续教育(职业证书)', amount: 3600, note: '3600/年(取证当年)' });
  }

  // 4. 大病医疗：自付超1.5万部分，上限8万（据实）
  if (input.seriousIllnessExpense && input.seriousIllnessExpense > 0) {
    const deductible = Math.min(80000, Math.max(0, input.seriousIllnessExpense - 15000));
    if (deductible > 0) {
      items.push({ key: 'seriousIllness', label: '大病医疗', amount: deductible, note: `自付${input.seriousIllnessExpense}，超1.5万部分` });
    }
  }

  // 5 & 6. 住房贷款利息 vs 住房租金（互斥，贷款优先）
  if (input.housingLoan) {
    items.push({ key: 'housingLoan', label: '住房贷款利息', amount: 1000 * 12, note: '1000/月（与租金互斥）' });
  } else if (input.housingRent) {
    const rent = RENT_STANDARDS[input.housingRent.tier].monthly;
    items.push({ key: 'housingRent', label: '住房租金', amount: rent * 12, note: `${RENT_STANDARDS[input.housingRent.tier].label} ${rent}/月` });
  }

  // 7. 赡养老人：独生子女 3000/月全额；非独生上限 1500/月（按分摊比例）
  if (input.elderlyCare) {
    if (input.elderlyCare.onlyChild) {
      items.push({ key: 'elderlyCare', label: '赡养老人', amount: 3000 * 12, note: '独生子女 3000/月全额' });
    } else {
      const pct = Math.min(100, Math.max(0, input.elderlyCare.sharePercent || 0)) / 100;
      // 非独生子女每人分摊上限1500/月
      const monthly = Math.min(1500, 3000 * pct);
      items.push({ key: 'elderlyCare', label: '赡养老人', amount: monthly * 12, note: `非独生 分摊${Math.round(pct * 100)}%，封顶1500/月` });
    }
  }

  const total = items.reduce((s, it) => s + it.amount, 0);
  return { items, total: round2(total) };
}

/**
 * 年度综合所得汇算计税（退税/补税核心）。
 *
 * 把全年各项收入汇总为"综合所得"，按统一7级税率计全年应纳税，
 * 再对比已预扣预缴，算出应退(正)/应补(负)。
 *
 * 计税基数：
 *  - 工资：全额计入综合所得
 *  - 劳务报酬：× 80% 计入（预扣时>4000扣20%/≤4000扣800，汇算统一按20%费用）
 *  - 稿酬：× 80% × 70% 计入（稿酬额外减征30%）
 *  - 特许权使用费：× 80% 计入（本表暂未单列，可并入劳务）
 *
 * 年终奖：默认单独计税（不并入），如 mergeBonus=true 则并入综合所得。
 */
export interface SettlementInput {
  annualSalary: number;            // 全年税前工资
  annualBonus?: number;            // 年终奖（默认单独计税）
  mergeBonus?: boolean;            // 年终奖是否并入综合所得计税
  laborIncome?: number;            // 全年劳务报酬（毛额）
  royaltyIncome?: number;          // 全年稿酬（毛额）
  socialInsurance: number;         // 全年社保公积金（专项扣除，按实际）
  specialDeductionsTotal: number;  // 专项附加扣除合计（calcSpecialDeductions().total）
  personalPension?: number;        // 个人养老金缴存（上限12000）
  alreadyWithheld: number;         // 已预扣预缴税额（工资预扣 + 劳务预扣 + ...）
  /** 年终奖单独计税时的税额（mergeBonus=false 时需传入，用 calcBonusTax 算） */
  bonusSeparateTax?: number;
}
export interface SettlementResult {
  comprehensiveIncome: number;     // 综合所得总额（各项计税基数之和）
  totalDeductions: number;         // 各项扣除合计（基本6万 + 社保 + 专项附加 + 个人养老金）
  taxableIncome: number;           // 应纳税所得额
  annualTax: number;               // 全年应纳税额（综合所得）
  bonusTax: number;                // 年终奖应纳税（单独计税时）
  totalTax: number;                // 全年总应纳税 = 综合所得应纳 + 年终奖应纳
  alreadyWithheld: number;         // 已预扣
  refundOrPay: number;             // 正=退税 / 负=补税
  marginalRate: number;            // 边际税率
  effectiveRate: number;           // 综合有效税率
  detail: {                        // 明细（用于 UI 展示）
    salaryBase: number;
    laborBase: number;
    royaltyBase: number;
    basicDeduction: number;        // 基本减除 6万
    socialDeduction: number;
    specialDeduction: number;
    pensionDeduction: number;
  };
}

export function calcAnnualSettlementTax(input: SettlementInput): SettlementResult {
  const {
    annualSalary = 0,
    annualBonus = 0,
    mergeBonus = false,
    laborIncome = 0,
    royaltyIncome = 0,
    socialInsurance = 0,
    specialDeductionsTotal = 0,
    personalPension = 0,
    alreadyWithheld = 0,
    bonusSeparateTax = 0,
  } = input;

  // 各项收入计税基数
  const salaryBase = Math.max(0, annualSalary);
  const laborBase = Math.max(0, laborIncome) * 0.8;        // 劳务 ×80%
  const royaltyBase = Math.max(0, royaltyIncome) * 0.8 * 0.7; // 稿酬 ×80%×70%
  const bonusBase = mergeBonus ? Math.max(0, annualBonus) : 0; // 年终奖是否并入

  // 综合所得（含并入的年终奖）
  const comprehensiveIncome = salaryBase + laborBase + royaltyBase + bonusBase;

  // 各项扣除
  const basicDeduction = ANNUAL_THRESHOLD; // 基本减除 6万/年
  const socialDeduction = Math.max(0, socialInsurance);
  const specialDeduction = Math.max(0, specialDeductionsTotal);
  const pensionDeduction = Math.min(12000, Math.max(0, personalPension)); // 个人养老金上限12000
  const totalDeductions = basicDeduction + socialDeduction + specialDeduction + pensionDeduction;

  // 应纳税所得额（不低于0）
  const taxableIncome = Math.max(0, comprehensiveIncome - totalDeductions);

  // 综合所得应纳税
  const annualTax = calcCumulativeTax(taxableIncome);

  // 年终奖应纳税（并入时已含在 annualTax，单独时用传入的 bonusSeparateTax）
  const bonusTax = mergeBonus ? 0 : Math.max(0, bonusSeparateTax);

  const totalTax = annualTax + bonusTax;
  const refundOrPay = round2(alreadyWithheld - totalTax); // 已交 - 应交：正=退，负=补

  const b = findBracket(taxableIncome, COMPREHENSIVE_TAX_BRACKETS);

  return {
    comprehensiveIncome: round2(comprehensiveIncome),
    totalDeductions: round2(totalDeductions),
    taxableIncome: round2(taxableIncome),
    annualTax: round2(annualTax),
    bonusTax: round2(bonusTax),
    totalTax: round2(totalTax),
    alreadyWithheld: round2(alreadyWithheld),
    refundOrPay,
    marginalRate: b.rate,
    effectiveRate: comprehensiveIncome > 0 ? annualTax / comprehensiveIncome : 0,
    detail: {
      salaryBase: round2(salaryBase),
      laborBase: round2(laborBase),
      royaltyBase: round2(royaltyBase),
      basicDeduction,
      socialDeduction: round2(socialDeduction),
      specialDeduction: round2(specialDeduction),
      pensionDeduction: round2(pensionDeduction),
    },
  };
}
