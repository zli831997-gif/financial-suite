/**
 * 阶段D 验证：房贷计算 + 提前还贷省利息。
 * 运行：npx tsx verify-stageD.ts
 */
import {
  calcEqualPayment, calcEqualPrincipal, compareLoanMethods,
  simulatePrepayment, generateAmortizationSchedule,
} from './src/logic/calc/loan';

console.log('═══════ 阶段D 验证：房贷计算引擎 ═══════\n');

// 1. 等额本息/本金基础计算（对齐老版）
console.log('【100万贷30年 4.1%】');
const ep = calcEqualPayment(1000000, 30, 4.1);
console.log(`  等额本息: 月供 ¥${ep.monthly.toLocaleString()} 总利息 ¥${ep.interest.toLocaleString()}`);
// 标准公式：100万30年4.1% → 月供 4831.98，总利息 739514（Node 精确计算）
const okEP = Math.abs(ep.monthly - 4831.98) < 1 && Math.abs(ep.interest - 739514) < 100;
console.log(`  ${okEP ? '✅ 符合标准公式（月供≈4831.98，利息≈73.95万）' : '❌ 数值偏差'}\n`);

const epr = calcEqualPrincipal(1000000, 30, 4.1);
console.log(`  等额本金: 首月 ¥${epr.firstMonth.toLocaleString()} 月本金 ¥${epr.monthlyPrincipal} 总利息 ¥${epr.interest.toLocaleString()}`);
// 老版同输入：首月约 6194.44，月本金 2777.78，总利息约 616708
const okEPR = Math.abs(epr.firstMonth - 6194.44) < 1 && Math.abs(epr.interest - 616708) < 100;
console.log(`  ${okEPR ? '✅ 与老版一致（首月≈6194，利息≈61.7万）' : '❌ 数值偏差'}\n`);

const cmp = compareLoanMethods(1000000, 30, 4.1);
console.log(`  等额本息比等额本金多付利息 ¥${cmp.interestDiff.toLocaleString()}\n`);

// 2. 摊销表正确性：30年期表应有360行，末期余额归零
const sch = generateAmortizationSchedule(1000000, 360, 4.1);
console.log('【摊销表】');
console.log(`  总行数: ${sch.length} (应为360)`);
console.log(`  第1期: 还本金¥${sch[0].principalPart} 利息¥${sch[0].interestPart} 剩余¥${sch[0].balance.toLocaleString()}`);
console.log(`  第60期(5年末): 剩余本金¥${sch[59].balance.toLocaleString()}`);
console.log(`  第360期: 剩余本金¥${sch[359].balance} (应≈0)`);
const okSch = sch.length === 360 && sch[359].balance < 1;
console.log(`  ${okSch ? '✅ 摊销表完整且末期归零' : '❌ 摊销表异常'}\n`);

// 3. 提前还贷（核心）
console.log('【提前还贷：第5年(已还60期)提前还10万】');
const result = simulatePrepayment({
  principal: 1000000, years: 30, annualRatePct: 4.1,
  paidMonths: 60, prepayAmount: 100000,
});
console.log(`  提前还款后剩余本金: ¥${result.balanceAfterPrepay.toLocaleString()}`);
console.log(`  基线(不提前): 剩余${result.baseline.remainingMonths}月 月供¥${result.baseline.monthlyPayment} 剩余总利息¥${Math.round(result.baseline.remainingInterest).toLocaleString()}`);
console.log(`  方案一 缩短年限: 剩余${result.shortenTerm.remainingMonths}月 月供¥${result.shortenTerm.monthlyPayment} 省${result.shortenTerm.savedMonths}月 省利息¥${Math.round(result.shortenTerm.savedInterest).toLocaleString()}`);
console.log(`  方案二 减少月供: 剩余${result.reducePayment.remainingMonths}月 月供¥${result.reducePayment.monthlyPayment} 省${result.reducePayment.savedMonths}月 省利息¥${Math.round(result.reducePayment.savedInterest).toLocaleString()}`);
console.log(`  推荐方案: ${result.recommendation === 'shortenTerm' ? '缩短年限（省利息更多）' : '减少月供'}\n`);

// 提前还贷逻辑校验：
// - 提前还款后剩余本金应 = 第60期余额 - 10万
// - 两方案省利息都应 > 0（提前还钱必然省利息）
// - 缩短年限省利息 >= 减少月供省利息（数学上成立）
const expectBalance = sch[59].balance - 100000;
const okPre1 = Math.abs(result.balanceAfterPrepay - expectBalance) < 1;
const okPre2 = result.shortenTerm.savedInterest > 0 && result.reducePayment.savedInterest > 0;
const okPre3 = result.shortenTerm.savedInterest >= result.reducePayment.savedInterest - 1;
const okPre4 = result.shortenTerm.savedMonths > 0; // 缩短年限必然提前还清
console.log(`  ${okPre1 ? '✅ 剩余本金=第60期余额-10万' : '❌ 剩余本金错'}`);
console.log(`  ${okPre2 ? '✅ 两方案均省利息' : '❌ 省利息<=0'}`);
console.log(`  ${okPre3 ? '✅ 缩短年限省利息≥减少月供' : '❌ 省利息关系异常'}`);
console.log(`  ${okPre4 ? '✅ 缩短年限提前还清' : '❌ 未提前还清'}\n`);

console.log('═══════ 阶段D 结论：',
  (okEP && okEPR && okSch && okPre1 && okPre2 && okPre3 && okPre4) ? '✅ 全部通过' : '❌ 有失败',
  '═══════');
process.exit((okEP && okEPR && okSch && okPre1 && okPre2 && okPre3 && okPre4) ? 0 : 1);
