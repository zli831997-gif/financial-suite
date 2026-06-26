// 阶段2 domain 逻辑验证脚本（临时，跑完可删）
// 平台无关 domain 层不碰浏览器，可在 Node 里 mock localStorage 直接验证业务逻辑
import { ensureAccounts, getAccounts, getAccountsNetBalance, getAccountById } from './src/logic/domain/accounts';
import { ensureRecords, getRecords, addRecord, deleteRecord, migrateLegacyTransactions } from './src/logic/domain/records';
import { KEYS } from './src/storage/keys';

// mock localStorage（domain 的 webStorage 依赖；import 时不调用，运行时才用）
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

console.log('\n[1] 账户初始化');
ensureAccounts();
check('默认 5 个账户', getAccounts().length === 5, getAccounts().length, 5);

console.log('\n[2] 演示数据 + 余额联动');
const r = ensureRecords();
check('演示数据 2 条', r.length === 2, r.length, 2);
check('微信 -35（演示支出扣微信）', getAccountById('acc_wechat')?.balance === -35, getAccountById('acc_wechat')?.balance, -35);
check('储蓄卡 +15000（演示收入加储蓄卡）', getAccountById('acc_debit')?.balance === 15000, getAccountById('acc_debit')?.balance, 15000);

console.log('\n[3] 账户净余额（资产 - 负债）');
check('净余额 = 14965（15000 - 35）', getAccountsNetBalance() === 14965, getAccountsNetBalance(), 14965);

console.log('\n[4] 记一笔支出（现金 100）');
const cashBefore = getAccountById('acc_cash')!.balance;
const u = addRecord({ id: '', type: 'expense', amount: 100, category: '餐饮', accountId: 'acc_cash', accountName: '现金', date: '2026-06-24', time: '10:00', note: '测试支出' });
check('现金 -100', getAccountById('acc_cash')?.balance === cashBefore - 100, getAccountById('acc_cash')?.balance, cashBefore - 100);
check('记录数变 3', u.length === 3, u.length, 3);

console.log('\n[5] 删除回退');
const newId = u[u.length - 1].id;
const d = deleteRecord(newId);
check('现金回退到原值', getAccountById('acc_cash')?.balance === cashBefore, getAccountById('acc_cash')?.balance, cashBefore);
check('记录数恢复 2', d.length === 2, d.length, 2);

console.log('\n[6] 记收入（支付宝 2000）');
const alipayBefore = getAccountById('acc_alipay')!.balance;
addRecord({ id: '', type: 'income', amount: 2000, category: '工资', accountId: 'acc_alipay', accountName: '支付宝', date: '2026-06-24', time: '11:00', note: '测试收入' });
check('支付宝 +2000', getAccountById('acc_alipay')?.balance === alipayBefore + 2000, getAccountById('acc_alipay')?.balance, alipayBefore + 2000);

console.log('\n[7] 旧数据迁移（finance_hub_transactions_v2 → fin_records，独立环境）');
Object.keys(mem).forEach(k => delete mem[k]); // 清空重置
ensureAccounts();
mem[KEYS.TRANSACTIONS] = JSON.stringify([{ id: 'old1', type: 'income', amount: 5000, category: '工资', date: '2026-06-01', note: '旧版工资' }]);
migrateLegacyTransactions();
check('旧数据迁到 fin_records', getRecords().length === 1, getRecords().length, 1);
check('迁移补默认账户', !!getRecords()[0]?.accountId, getRecords()[0]?.accountId);
check('迁移补默认账户名', getRecords()[0]?.accountName === '微信', getRecords()[0]?.accountName, '微信');
check('旧 key 已删除', !(KEYS.TRANSACTIONS in mem), KEYS.TRANSACTIONS in mem);

console.log(`\n${fail === 0 ? '🎉 全部通过' : `⚠️ ${fail} 项失败`}（${pass}✓ / ${fail}✗）`);
process.exit(fail === 0 ? 0 : 1);
