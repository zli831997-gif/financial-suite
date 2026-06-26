/**
 * 养老金计算引擎 — 移植自老版 pensionCalculator.js（纯函数，平台无关）。
 * 城镇职工 / 城乡居民 / 个人养老金 / FIRE 四模块 + 30省数据 + 31档计发月数。
 */

// 计发月数表（退休年龄 → 月数，40-70岁 31档）
export const PENSION_MONTHS: Record<number, number> = {
  40: 233, 41: 230, 42: 226, 43: 223, 44: 220,
  45: 216, 46: 212, 47: 208, 48: 204, 49: 199,
  50: 195, 51: 190, 52: 185, 53: 180, 54: 175,
  55: 170, 56: 164, 57: 158, 58: 152, 59: 145,
  60: 139, 61: 132, 62: 125, 63: 117, 64: 109,
  65: 101, 66: 93, 67: 84, 68: 75, 69: 65, 70: 56,
};

// 30省城镇职工养老金计发基数（2025年度，元/月）
export const PROVINCE_PENSION_BASE: Record<string, number> = {
  '上海': 12434, '北京': 12049, '西藏': 11777, '深圳': 11293,
  '广东': 9493, '天津': 9417, '江苏': 8917, '青海': 9056,
  '新疆': 8448, '浙江': 8433, '宁夏': 8366, '云南': 8265,
  '重庆': 8240, '海南': 8188, '内蒙古': 8179, '安徽': 7999,
  '福建': 7932, '陕西': 7881, '山东': 7831, '黑龙江': 7570,
  '河北': 7410, '辽宁': 7346, '贵州': 7324, '吉林': 7322,
  '江西': 7054, '广西': 6983, '山西': 7253, '河南': 6738,
  '四川': 8312,
  'default': 8000,
};

// 30省城乡居民基础养老金标准（2025，元/月）
export const PROVINCE_RESIDENT_PENSION: Record<string, number> = {
  '上海': 1490, '北京': 971, '天津': 337, '西藏': 265,
  '广东': 220, '江苏': 208, '浙江': 350, '青海': 235,
  '宁夏': 230, '重庆': 155, '山东': 168, '福建': 160,
  '陕西': 156, '河南': 128, '河北': 133, '四川': 133,
  '安徽': 145, '湖北': 140, '湖南': 136, '辽宁': 129,
  '广西': 136, '贵州': 128, '云南': 133, '黑龙江': 128,
  '吉林': 128, '江西': 145, '山西': 143, '海南': 199,
  'default': 143,
};

export const PERSONAL_PENSION_LIMIT = 12000;
export const PERSONAL_PENSION_TAX_BRACKETS = [
  { upper: 36000, rate: 0.03 },
  { upper: 144000, rate: 0.10 },
  { upper: 300000, rate: 0.20 },
  { upper: 420000, rate: 0.25 },
  { upper: 660000, rate: 0.30 },
  { upper: 960000, rate: 0.35 },
  { upper: Infinity, rate: 0.45 },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getMonthsByAge(age: number): number {
  return PENSION_MONTHS[age] || 139;
}
export function getProvincePensionBase(province: string): number {
  return PROVINCE_PENSION_BASE[province] || PROVINCE_PENSION_BASE['default'];
}
export function getProvinceResidentPension(province: string): number {
  return PROVINCE_RESIDENT_PENSION[province] || PROVINCE_RESIDENT_PENSION['default'];
}

// ========== 城镇职工养老金 ==========
export interface EmployeePensionParams {
  avgSocialSalary?: number;
  province?: string;
  personalSalary?: number;
  salaryIndex?: number;
  contributionYears?: number;
  personalAccountBalance?: number;
  retireAge?: number;
}
export function calcEmployeePension(params: EmployeePensionParams) {
  const { avgSocialSalary, province = '', personalSalary = 8000, salaryIndex = 1.0, contributionYears = 15, personalAccountBalance = 0, retireAge = 60 } = params;
  let actualAvg = avgSocialSalary;
  if (!actualAvg && province) actualAvg = getProvincePensionBase(province);
  actualAvg = actualAvg || 8000;
  const indexedSalary = actualAvg * salaryIndex;
  const basePension = (actualAvg + indexedSalary) / 2 * contributionYears * 0.01;
  const months = getMonthsByAge(retireAge);
  const accountPension = personalAccountBalance / months;
  const monthlyPension = basePension + accountPension;
  const annualPension = monthlyPension * 12;
  return {
    avgSocialSalary: actualAvg, province, personalSalary, salaryIndex,
    contributionYears, personalAccountBalance, retireAge,
    pensionMonths: months,
    basePension: round2(basePension),
    accountPension: round2(accountPension),
    monthlyPension: round2(monthlyPension),
    annualPension: round2(annualPension),
    replacementRate: personalSalary > 0 ? monthlyPension / personalSalary : 0,
  };
}

// ========== 城乡居民养老金 ==========
export interface ResidentPensionParams {
  basePension?: number;
  province?: string;
  annualPayment?: number;
  years?: number;
  govSubsidy?: number;
  interestRate?: number;
  retireAge?: number;
}
export function calcResidentPension(params: ResidentPensionParams) {
  const { basePension, province = '', annualPayment = 500, years = 15, govSubsidy = 50, interestRate = 0.025, retireAge = 60 } = params;
  let actualBase = basePension;
  if (!actualBase && province) actualBase = getProvinceResidentPension(province);
  actualBase = actualBase || 143;
  let accountBalance = 0;
  for (let i = 0; i < years; i++) {
    accountBalance += annualPayment + govSubsidy;
    accountBalance *= (1 + interestRate);
  }
  const months = getMonthsByAge(retireAge);
  const accountPension = accountBalance / months;
  const monthlyPension = actualBase + accountPension;
  return {
    basePension: actualBase, province,
    accountBalance: round2(accountBalance),
    accountPension: round2(accountPension),
    monthlyPension: round2(monthlyPension),
    annualPension: round2(monthlyPension * 12),
    totalContribution: annualPayment * years,
    totalSubsidy: govSubsidy * years,
  };
}

// ========== 个人养老金（第三支柱） ==========
export interface PersonalPensionParams {
  annualContribution?: number;
  marginalTaxRate?: number;
  years?: number;
  returnRate?: number;
}
export function calcPersonalPension(params: PersonalPensionParams) {
  const { annualContribution = 12000, marginalTaxRate = 0.20, years = 30, returnRate = 0.05 } = params;
  const actualContribution = Math.min(annualContribution, PERSONAL_PENSION_LIMIT);
  const annualTaxSaving = actualContribution * marginalTaxRate;
  const totalTaxSaving = annualTaxSaving * years;
  let accountBalance = 0;
  for (let i = 0; i < years; i++) {
    accountBalance += actualContribution;
    accountBalance *= (1 + returnRate);
  }
  const totalContribution = actualContribution * years;
  const investmentReturn = accountBalance - totalContribution;
  const withdrawalTax = accountBalance * 0.03; // 领取时 3% 单独计税
  const afterTaxBalance = accountBalance - withdrawalTax;
  return {
    annualContribution: actualContribution, marginalTaxRate, years, returnRate,
    totalContribution: round2(totalContribution),
    accountBalance: round2(accountBalance),
    investmentReturn: round2(investmentReturn),
    totalTaxSaving: round2(totalTaxSaving),
    annualTaxSaving: round2(annualTaxSaving),
    withdrawalTax: round2(withdrawalTax),
    afterTaxBalance: round2(afterTaxBalance),
  };
}

// ========== FIRE（4%法则 + 逐年消耗） ==========
export interface FireParams {
  monthlyExpense: number;
  savings?: number;
  annualReturnRate?: number;
  inflationRate?: number;
  retireYears?: number;
  pensionIncome?: number;
  pensionStartAge?: number;
  currentAge?: number;
}
export interface FireYearRow {
  year: number; age: number; expense: number; pensionIncome: number; netExpense: number; balance: number; hasPension: boolean;
}
export function calcFIRE(params: FireParams) {
  const { monthlyExpense, savings = 0, annualReturnRate = 0.04, inflationRate = 0.03, retireYears = 40, pensionIncome = 0, pensionStartAge = 60, currentAge = 35 } = params;
  const realReturnRate = (1 + annualReturnRate) / (1 + inflationRate) - 1;
  const fireNumber = monthlyExpense * 12 / 0.04;
  const yearlyProjection: FireYearRow[] = [];
  let balance = savings;
  let currentExpense = monthlyExpense * 12;
  for (let year = 0; year < retireYears; year++) {
    const age = currentAge + year;
    const hasPension = age >= pensionStartAge;
    const pensionAnnual = hasPension ? pensionIncome * 12 : 0;
    const netExpense = Math.max(0, currentExpense - pensionAnnual);
    balance = balance * (1 + annualReturnRate) - netExpense;
    yearlyProjection.push({
      year: year + 1, age,
      expense: Math.round(currentExpense),
      pensionIncome: Math.round(pensionAnnual),
      netExpense: Math.round(netExpense),
      balance: Math.round(balance),
      hasPension,
    });
    currentExpense *= (1 + inflationRate);
    if (balance <= 0) break;
  }
  const sustainableYears = yearlyProjection.filter(y => y.balance > 0).length;
  const shortfall = Math.max(0, fireNumber - savings);
  return {
    fireNumber: round2(fireNumber),
    realReturnRate,
    yearlyProjection,
    sustainableYears,
    isSustainable: sustainableYears >= retireYears,
    shortfall: round2(shortfall),
  };
}
