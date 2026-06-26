/**
 * 阶段B 验证：资产负债表恒等式 + 与 calcNetAssets 口径一致。
 * 运行：npx tsx verify-stageB.ts
 */
import { buildBalanceSheet, calcNetAssets } from './src/logic/calc/netAssets';
import { INITIAL_STATE } from './src/utils/financeState';
import { DEFAULT_ACCOUNTS } from './src/logic/domain/accounts';

// 用一个带信用卡欠款和活期余额的场景，全面测分组
const accounts = [
  ...DEFAULT_ACCOUNTS,
  // 给储蓄卡和信用卡造个非零余额
].map(a => {
  if (a.id === 'acc_debit') return { ...a, balance: 50000 };
  if (a.id === 'acc_credit') return { ...a, balance: 8000 }; // 信用卡欠款 8000
  return a;
});

console.log('═══════ 阶段B 验证：资产负债表 ═══════\n');

const bs = buildBalanceSheet(INITIAL_STATE, accounts);
const ref = calcNetAssets(INITIAL_STATE, 50000 - 8000); // 活期5万 - 信用卡欠款8千

console.log('【流动资产】');
bs.currentAssets.items.forEach(it => console.log(`  ${it.name}: ¥${it.amount.toLocaleString()}  ${it.detail || ''}`));
console.log(`  小计: ¥${bs.currentAssets.subtotal.toLocaleString()}\n`);

console.log('【非流动资产】');
bs.nonCurrentAssets.items.forEach(it => console.log(`  ${it.name}: ¥${it.amount.toLocaleString()}  ${it.detail || ''}`));
console.log(`  小计: ¥${bs.nonCurrentAssets.subtotal.toLocaleString()}\n`);

console.log('【流动负债】');
bs.currentLiabilities.items.forEach(it => console.log(`  ${it.name}: ¥${it.amount.toLocaleString()}`));
console.log(`  小计: ¥${bs.currentLiabilities.subtotal.toLocaleString()}\n`);

console.log('【非流动负债】');
bs.nonCurrentLiabilities.items.forEach(it => console.log(`  ${it.name}: ¥${it.amount.toLocaleString()}`));
console.log(`  小计: ¥${bs.nonCurrentLiabilities.subtotal.toLocaleString()}\n`);

console.log('──────────────────────────');
console.log(`总资产: ¥${bs.totalAssets.toLocaleString()}`);
console.log(`总负债: ¥${bs.totalLiabilities.toLocaleString()}`);
console.log(`净资产: ¥${bs.netAssets.toLocaleString()}  (calcNetAssets.net = ¥${ref.net.toLocaleString()})`);
console.log(`资产负债率: ${(bs.debtRatio * 100).toFixed(1)}%`);

// 恒等校验：净资产与权威口径一致
const ok1 = Math.abs(bs.netAssets - ref.net) < 0.01;
console.log(`\n  ${ok1 ? '✅ 净资产口径一致（与 calcNetAssets 相符）' : '❌ 净资产口径不一致'}（差 ${Math.abs(bs.netAssets - ref.net)}）`);

// 恒等校验：总资产 - 总负债 应等于 净资产（房/车用净值口径，不重复计贷款）
const diff = Math.abs(bs.totalAssets - bs.totalLiabilities - bs.netAssets);
const ok2 = diff < 0.01;
console.log(`  ${ok2 ? '✅ 会计恒等式成立（资产 - 负债 = 净资产）' : '❌ 恒等式偏差 ¥' + diff}`);

console.log('\n═══════ 阶段B 结论：', ok1 && ok2 ? '✅ 全部通过' : '❌ 有失败', '═══════');
process.exit(ok1 && ok2 ? 0 : 1);
