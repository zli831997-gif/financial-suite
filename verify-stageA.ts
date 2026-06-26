/**
 * 阶段A 验证：用 DEMO_RECORDS 跑利润表 + 现金流量表，核对数值。
 * 运行：npx tsx verify-stageA.ts
 */
import {
  buildIncomeStatement,
  buildCashFlowStatement,
  buildMonthlyTrend,
} from './src/logic/calc/report';
import { DEMO_RECORDS } from './src/logic/domain/records';

const records = DEMO_RECORDS;

console.log('═══════ 阶段A 验证：报表计算引擎 ═══════\n');

// 1. 月度利润表（2026-06）
const is = buildIncomeStatement(records, '2026-06');
console.log('【利润表 2026-06】');
console.log(`  总收入: ¥${is.totalIncome}  总支出: ¥${is.totalExpense}`);
console.log(`  结余: ¥${is.surplus}  储蓄率: ${(is.surplusRate * 100).toFixed(1)}%`);
console.log(`  收入分类: ${JSON.stringify(is.incomeByCategory)}`);
console.log(`  支出分类: ${JSON.stringify(is.expenseByCategory)}`);

// 校验：工资 15000 收入，餐饮 35 支出
const ok1 = is.totalIncome === 15000 && is.totalExpense === 35 && is.surplus === 14965;
console.log(`  ${ok1 ? '✅ 利润表数值正确' : '❌ 利润表数值错误'}\n`);

// 2. 现金流量表
const cf = buildCashFlowStatement(records, '2026-06');
console.log('【现金流量表 2026-06】');
cf.lines.forEach(l => {
  const name = { operating: '经营', investing: '投资', financing: '筹资' }[l.activity];
  console.log(`  ${name}: 流入¥${l.inflow} 流出¥${l.outflow} 净额¥${l.net}`);
});
console.log(`  现金净增减: ¥${cf.netChange}`);

// 校验：工资归经营流入 15000，餐饮归经营流出 35，净增 14965
const operLine = cf.lines.find(l => l.activity === 'operating')!;
const ok2 = operLine.inflow === 15000 && operLine.outflow === 35 && cf.netChange === 14965;
console.log(`  ${ok2 ? '✅ 现金流量表数值正确' : '❌ 现金流量表数值错误'}\n`);

// 3. 月度走势
const trend = buildMonthlyTrend(records, 6);
console.log('【近6月走势】');
trend.forEach(t => console.log(`  ${t.period}: 收¥${t.income} 支¥${t.expense} 余¥${t.surplus}`));
const ok3 = trend.some(t => t.period === '2026-06');
console.log(`  ${ok3 ? '✅ 走势含当前月' : '❌ 走势缺当前月'}\n`);

console.log('═══════ 阶段A 结论：', (ok1 && ok2 && ok3) ? '✅ 全部通过' : '❌ 有失败', '═══════');
process.exit(ok1 && ok2 && ok3 ? 0 : 1);
