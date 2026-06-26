// A1 assets domain + 双写验证（mock storage）
import { syncAssetsFromFinanceState, calcValue, getSummary, getAssets } from './src/logic/domain/assets';
import { INITIAL_STATE } from './src/utils/financeState';
import type { FinanceAppState } from './src/utils/financeState';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in mem ? mem[k] : null),
  setItem: (k: string, v: string) => { mem[k] = String(v); },
  removeItem: (k: string) => { delete mem[k]; },
};

let pass = 0, fail = 0;
function check(name: string, cond: boolean, got?: any, want?: any) {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name}  got=${got} want=${want}`); fail++; }
}

console.log('\n[1] syncAssetsFromFinanceState（聚合 → 分散镜像）');
const state: FinanceAppState = JSON.parse(JSON.stringify(INITIAL_STATE));
syncAssetsFromFinanceState(state);
const assets = getAssets();
const types = assets.map(a => a.type);
check('生成 6 类资产', types.includes('house') && types.includes('car') && types.includes('crypto') && types.includes('cash') && types.includes('insurance') && types.includes('debt'), types.join(','));
check('资产数 >= 6', assets.length >= 6, assets.length);

console.log('\n[2] calcValue（6 类估值）');
const house = assets.find(a => a.type === 'house')!;
const car = assets.find(a => a.type === 'car')!;
const crypto = assets.find(a => a.type === 'crypto')!;
const cash = assets.find(a => a.type === 'cash')!;
const insurance = assets.find(a => a.type === 'insurance')!;
const debt = assets.find(a => a.type === 'debt')!;
check('house calcValue = currentValue', calcValue(house) === house.currentValue, calcValue(house));
check('crypto calcValue = holdings×price', calcValue(crypto) === Math.round((crypto.holdings || 0) * (crypto.unitPrice || 0) * 100) / 100, calcValue(crypto));
check('cash calcValue = amount', calcValue(cash) === cash.amount);
check('insurance calcValue = cashValue', calcValue(insurance) === insurance.cashValue);
check('debt calcValue = 负值', calcValue(debt) < 0, calcValue(debt));

console.log('\n[3] getSummary（汇总）');
const summary = getSummary();
check('totalAssets > 0', summary.totalAssets > 0, summary.totalAssets);
check('totalLiabilities >= 0', summary.totalLiabilities >= 0, summary.totalLiabilities);
check('net = assets - liabilities', summary.net === summary.totalAssets - summary.totalLiabilities, summary.net);
check('count >= 6', summary.count >= 6, summary.count);
check('byType 有 6 类', Object.keys(summary.byType).length === 6, Object.keys(summary.byType).length);

console.log('\n[4] 双写幂等（二次 sync 不重复）');
syncAssetsFromFinanceState(state);
const assets2 = getAssets();
check('二次 sync 资产数不变（覆盖）', assets2.length === assets.length, assets2.length);

console.log(`\n${fail === 0 ? '🎉 全部通过' : `⚠️ ${fail} 项失败`}（${pass}✓ / ${fail}✗）`);
process.exit(fail === 0 ? 0 : 1);
