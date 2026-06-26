import { calcAnnualSalaryTax } from './tax';

/**
 * 到手反推税前 — 移植自老版 salaryReverseCalc.js（纯函数，平台无关）。
 * 二分迭代：gross - social - tax = net，精度 0.01。
 * 默认社保比例 0.225（养老8% + 医疗2% + 失业0.5% + 公积金12%，工资条口径）。
 */
export function reverseGrossFromNet(net: number, personalRateTotal = 0.225): number {
  if (!net || net <= 0) return 0;
  let lo = net;
  let hi = net * 2.5;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const social = mid * personalRateTotal;
    const annualTax = calcAnnualSalaryTax({ monthlySalary: mid, socialInsurance: social, specialDeduction: 0 }).annualTax;
    const monthlyTax = annualTax / 12;
    const netCalc = mid - social - monthlyTax;
    if (Math.abs(netCalc - net) < 0.01) return Math.round(mid);
    if (netCalc < net) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}
