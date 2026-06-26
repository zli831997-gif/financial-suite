// 阶段2d 老数据导入验证（临时，跑完可删）
import { importFromLegacy } from './src/utils/legacyImport';
import { storage } from './src/storage';
import { KEYS } from './src/storage/keys';

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
function reset() { Object.keys(mem).forEach(k => delete mem[k]); }

const legacy = {
  _meta: { app: '财务通', version: '2.14.0', exportDate: '2026-06-01' },
  fin_records: [
    { id: 101, type: 'expense', amount: 50, categoryName: '餐饮', accountId: 1, accountName: '现金', date: '2026-05-20', time: '12:00', note: '午餐' },
    { id: 102, type: 'income', amount: 8000, categoryName: '工资', accountId: 4, accountName: '银行卡', date: '2026-05-10', note: '工资' },
  ],
  fin_accounts: [
    { id: 1, name: '现金', icon: '💵', type: 'cash', balance: 5000, sort: 1 },
    { id: 4, name: '银行卡', icon: '🏦', type: 'debit', balance: 20000, sort: 4 },
  ],
  fin_growth: { points: 300, exp: 500, level: 3, streak: 5, lastCheckinDate: '2026-05-20' },
  fin_templates: [{ id: 201, name: '房贷', type: 'expense', amount: 5000, categoryName: '住房', cycle: 'monthly', day: 20, accountId: 4, enabled: true }],
  fin_reminders: [{ id: 301, type: 'loan', name: '房贷还款', icon: '🏠', amount: 5000, day: 20 }],
  fin_auto_log: { '2026-05-20': [201] },
  fin_user_profile: { city: '北京', monthlySalary: 10000, currentAge: 30, retireAge: 60 },
  fin_assets: [
    { type: 'house', name: '我家', currentValue: 2000000, purchasePrice: 1800000, loanBalance: 500000, loanMonthly: 5000, loanRepayDay: 20 },
    { type: 'car', name: '我的车', purchasePrice: 200000, purchaseYear: 2022, depreciationRate: 15, loanBalance: 50000, loanMonthly: 3000 },
    { type: 'crypto', currency: 'BTC', holdings: 0.1, unitPrice: 400000 },
    { type: 'cash', name: '定期', amount: 100000, interestRate: 2.5 },
    { type: 'insurance', cashValue: 20000 },
    { type: 'debt', amount: 8000 },
  ],
};

console.log('\n[1] 校验 _meta.app');
check('非财务通 → ok:false', importFromLegacy({ _meta: { app: '别的' }, fin_records: [] }).ok === false);
check('非对象 → ok:false', importFromLegacy('hello').ok === false);

console.log('\n[2] 导入');
reset();
const res = importFromLegacy(legacy);
check('导入 ok', res.ok === true, res.msg);
check('records 2', res.counts.records === 2, res.counts.records, 2);
check('accounts 2', res.counts.accounts === 2);
check('assets 6', res.counts.assets === 6);

console.log('\n[3] records 转换');
const records = storage.get<any[]>(KEYS.RECORDS)!;
check('categoryName → category', records[0].category === '餐饮', records[0].category);
check('id 转 string', records[0].id === '101' && typeof records[0].id === 'string');
check('accountId 转 string', records[0].accountId === '1');

console.log('\n[4] accounts/templates/reminders/auto_log');
check('account id 转 string', storage.get<any[]>(KEYS.ACCOUNTS)![0].id === '1');
const tpls = storage.get<any[]>(KEYS.TEMPLATES)!;
check('template categoryName → category', tpls[0].category === '住房');
check('template id string', tpls[0].id === '201');
check('reminder id string', storage.get<any[]>(KEYS.REMINDERS)![0].id === '301');
check('auto_log tplId string', storage.get<any>(KEYS.AUTO_LOG)!['2026-05-20'][0] === '201');

console.log('\n[5] growth');
const growth = storage.get<any>(KEYS.GROWTH)!;
check('growth points 300', growth.points === 300);
check('growth level 3', growth.level === 3);

console.log('\n[6] profile + assets → financeState');
const fs = storage.get<any>(KEYS.APP_STATE)!;
check('profile.monthlyNetSalary = 10000', fs.profile.monthlyNetSalary === 10000, fs.profile.monthlyNetSalary);
check('profile.city = 北京', fs.profile.city === '北京');
check('property.currentValue = 2000000', fs.property.currentValue === 2000000);
check('property.monthlyPayment = 5000', fs.property.monthlyPayment === 5000);
check('property.payDay = 20', fs.property.payDay === 20);
check('vehicle.purchasePrice = 200000', fs.vehicle.purchasePrice === 200000);
check('cryptos[0].amount = 0.1', fs.cryptos.length === 1 && fs.cryptos[0].amount === 0.1);
check('savings[0].amount = 100000', fs.savings.length === 1 && fs.savings[0].amount === 100000);
check('insuranceCashValue = 20000（求和）', fs.insuranceCashValue === 20000);
check('otherLiabilities = 8000（求和）', fs.otherLiabilities === 8000);

console.log(`\n${fail === 0 ? '🎉 全部通过' : `⚠️ ${fail} 项失败`}（${pass}✓ / ${fail}✗）`);
process.exit(fail === 0 ? 0 : 1);
