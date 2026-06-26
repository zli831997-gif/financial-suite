// 阶段3 税务/社保反推验证（纯函数，无需 mock storage）
import { calcAnnualSalaryTax, calcBonusTax, calcLaborTax } from './src/logic/calc/tax';
import { reverseGrossFromNet } from './src/logic/calc/salary';
import { reverseBaseFromDeduction, calcSocialInsurance, getCities, BASE_LIMITS } from './src/logic/calc/social';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, got?: any, want?: any) {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name}  got=${got} want=${want}`); fail++; }
}

console.log('\n[1] reverseGrossFromNet（到手反推税前，0.225 口径）');
const gross = reverseGrossFromNet(10000);
check('到手 10000 → 税前 > 10000', gross > 10000, gross);
check('反推稳定（二次一致）', reverseGrossFromNet(10000) === gross);
check('到手 0 → 0', reverseGrossFromNet(0) === 0);

console.log('\n[2] reverseBaseFromDeduction（扣款反推基数 + clamp）');
const r = reverseBaseFromDeduction('深圳', 2000);
check('扣款 2000 深圳反推基数 > 0', r.base > 0, r.base);
const r2 = reverseBaseFromDeduction('深圳', 999999);
check('超上限 → clamp 到 max', r2.clamped === true && r2.base === BASE_LIMITS['深圳'].max, r2.base);
const r3 = reverseBaseFromDeduction('深圳', 1);
check('低于下限 → clamp 到 min', r3.clamped === true && r3.base === BASE_LIMITS['深圳'].min, r3.base);

console.log('\n[3] calcAnnualSalaryTax（累计预扣 12 月）');
const tax = calcAnnualSalaryTax({ monthlySalary: 15000, socialInsurance: 2000, specialDeduction: 0 });
check('月薪 15000 年税 > 0', tax.annualTax > 0, tax.annualTax);
check('12 个月明细', tax.months.length === 12);
check('有有效税率', tax.effectiveRate > 0 && tax.effectiveRate < 1);

console.log('\n[4] calcBonusTax（年终奖 单独 vs 合并）');
const bonus = calcBonusTax(30000, 180000, 24000, 0);
check('年终奖 30000 单独税 >= 0', bonus.separate.tax >= 0);
check('年终奖 30000 合并税 >= 0', bonus.merged.tax >= 0);
check('有推荐方案', bonus.recommendation.plan === 'separate' || bonus.recommendation.plan === 'merged');

console.log('\n[5] calcLaborTax（劳务报酬）');
const labor = calcLaborTax(5000);
check('劳务 5000 扣 20% (1000)', labor.deduction === 1000, labor.deduction);
check('劳务税 > 0', labor.tax > 0);
const labor2 = calcLaborTax(3000);
check('劳务 3000 扣 800', labor2.deduction === 800, labor2.deduction);

console.log('\n[6] 23 城数据');
check('城市数 >= 22', getCities().length >= 22, getCities().length);
check('含 default 基数', !!BASE_LIMITS['default']);

console.log('\n[7] calcSocialInsurance（正向明细）');
const si = calcSocialInsurance('北京', 20000);
check('北京基数 20000 个人总 > 0', si.personalTotal > 0, si.personalTotal);
check('北京基数 20000 公司总 > 个人总', si.companyTotal > si.personalTotal);
check('有险种明细', si.items.length >= 5);

console.log(`\n${fail === 0 ? '🎉 全部通过' : `⚠️ ${fail} 项失败`}（${pass}✓ / ${fail}✗）`);
process.exit(fail === 0 ? 0 : 1);
