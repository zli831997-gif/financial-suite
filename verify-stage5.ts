// 阶段5 养老金/FIRE 验证（纯函数）
import {
  calcEmployeePension, calcResidentPension, calcPersonalPension, calcFIRE,
  getMonthsByAge, getProvincePensionBase, PROVINCE_PENSION_BASE,
} from './src/logic/calc/pension';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, got?: any, want?: any) {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name}  got=${got} want=${want}`); fail++; }
}

console.log('\n[1] getMonthsByAge（31档计发月数）');
check('60岁 → 139', getMonthsByAge(60) === 139, getMonthsByAge(60));
check('50岁 → 195', getMonthsByAge(50) === 195);
check('55岁 → 170', getMonthsByAge(55) === 170);
check('65岁 → 101', getMonthsByAge(65) === 101);
check('70岁 → 56', getMonthsByAge(70) === 56);

console.log('\n[2] calcEmployeePension（城镇职工 + 30省）');
const emp = calcEmployeePension({ province: '深圳', personalSalary: 12000, contributionYears: 25, personalAccountBalance: 12000 * 0.08 * 12 * 25, retireAge: 60 });
check('深圳/60/25年 月养老金 > 0', emp.monthlyPension > 0, emp.monthlyPension);
check('有基础养老金', emp.basePension > 0);
check('有个人账户养老金', emp.accountPension > 0);
const empSH = calcEmployeePension({ province: '上海', personalSalary: 12000, contributionYears: 25, personalAccountBalance: 100000, retireAge: 60 });
const empHN = calcEmployeePension({ province: '河南', personalSalary: 12000, contributionYears: 25, personalAccountBalance: 100000, retireAge: 60 });
check('上海计发基数 > 河南', getProvincePensionBase('上海') > getProvincePensionBase('河南'), `${getProvincePensionBase('上海')} vs ${getProvincePensionBase('河南')}`);

console.log('\n[3] calcResidentPension（城乡居民 + 复利）');
const res = calcResidentPension({ province: '北京', annualPayment: 2000, years: 15, govSubsidy: 150, interestRate: 0.025, retireAge: 60 });
check('北京居民月养老金 > 0', res.monthlyPension > 0, res.monthlyPension);
check('复利：accountBalance > 年缴×年限', res.accountBalance > 2000 * 15, res.accountBalance);

console.log('\n[4] calcPersonalPension（个人养老金 + 节税 + 领取3%税）');
const pp = calcPersonalPension({ annualContribution: 12000, marginalTaxRate: 0.20, years: 30, returnRate: 0.05 });
check('总缴存 = 12000×30', pp.totalContribution === 360000, pp.totalContribution);
check('复利 accountBalance > 总缴存', pp.accountBalance > pp.totalContribution);
check('年节税 > 0', pp.annualTaxSaving > 0);
check('领取3%税 > 0', pp.withdrawalTax > 0);
check('税后余额 < 账户余额', pp.afterTaxBalance < pp.accountBalance);

console.log('\n[5] calcFIRE（4%法则 + 逐年消耗）');
const fire = calcFIRE({ monthlyExpense: 10000, savings: 3000000, annualReturnRate: 0.04, inflationRate: 0.03, retireYears: 40, currentAge: 35 });
check('FIRE数字 = 月支出×12/0.04 = 300万', fire.fireNumber === 3000000, fire.fireNumber);
check('有逐年预测', fire.yearlyProjection.length > 0);
check('300万存款可支撑 > 0 年', fire.sustainableYears > 0, fire.sustainableYears);

console.log('\n[6] 30省数据');
check('计发基数 >= 29省+default', Object.keys(PROVINCE_PENSION_BASE).length >= 30, Object.keys(PROVINCE_PENSION_BASE).length);

console.log(`\n${fail === 0 ? '🎉 全部通过' : `⚠️ ${fail} 项失败`}（${pass}✓ / ${fail}✗）`);
process.exit(fail === 0 ? 0 : 1);
