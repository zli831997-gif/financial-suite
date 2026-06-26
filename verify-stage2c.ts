// 阶段2c templates domain 逻辑验证（临时，跑完可删）
import {
  ensureTemplates, getTemplates, checkAutoRecords, logExecution,
  addTemplate, isAutoLoggedToday,
} from './src/logic/domain/templates';
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
function tplName(id: string): string {
  return getTemplates().find(t => t.id === id)?.name ?? '';
}

const today = new Date();
const todayDay = today.getDate();
const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const tomorrow = todayDay >= 28 ? 1 : todayDay + 1;

console.log('\n[1] ensureTemplates 默认模板');
reset();
const t1 = ensureTemplates();
check('首次写默认 4 个', t1.length === 4, t1.length, 4);
const t2 = ensureTemplates();
check('二次不覆盖（仍 4 个）', t2.length === 4);

console.log('\n[2] checkAutoRecords 按 day 判断（今日模板执行）');
reset();
ensureTemplates();
addTemplate({ name: '今日测试', type: 'expense', amount: 100, category: '其他', cycle: 'monthly', day: todayDay, accountId: 'acc_debit', accountName: '储蓄卡', note: '今日', enabled: true });
const auto1 = checkAutoRecords();
check('今日模板被执行', auto1.some(a => tplName(a.templateId) === '今日测试'), auto1.map(a => tplName(a.templateId)));

console.log('\n[3] enabled=false 不执行');
reset();
ensureTemplates();
addTemplate({ name: '禁用模板', type: 'expense', amount: 50, category: '其他', cycle: 'monthly', day: todayDay, accountId: 'acc_debit', note: '禁用', enabled: false });
const auto2 = checkAutoRecords();
check('禁用模板不执行', !auto2.some(a => tplName(a.templateId) === '禁用模板'));

console.log('\n[4] day≠今天 不执行');
reset();
ensureTemplates();
addTemplate({ name: '明日模板', type: 'expense', amount: 60, category: '其他', cycle: 'monthly', day: tomorrow, accountId: 'acc_debit', note: '明日', enabled: true });
const auto3 = checkAutoRecords();
check('明日模板不执行', !auto3.some(a => tplName(a.templateId) === '明日模板'));

console.log('\n[5] 幂等：logExecution 后同日不重复');
reset();
ensureTemplates();
addTemplate({ name: '幂等测试', type: 'expense', amount: 80, category: '其他', cycle: 'monthly', day: todayDay, accountId: 'acc_debit', note: '幂等', enabled: true });
const auto4 = checkAutoRecords();
const targetId = auto4.find(a => tplName(a.templateId) === '幂等测试')!.templateId;
logExecution(auto4.map(a => a.templateId));
const auto5 = checkAutoRecords();
check('logExecution 后不重复', !auto5.some(a => tplName(a.templateId) === '幂等测试'));
check('isAutoLoggedToday 标记', isAutoLoggedToday(targetId));

console.log('\n[6] logExecution 清理 30 天前日志');
reset();
ensureTemplates();
// 手动塞 31 天前 + 今天的日志
const d = new Date(); d.setDate(d.getDate() - 31);
const oldDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
mem[KEYS.AUTO_LOG] = JSON.stringify({ [oldDate]: ['old_tpl'], [todayDate]: [] });
logExecution(['new_tpl']);
const log = JSON.parse(mem[KEYS.AUTO_LOG]);
check('31 天前日志被清理', !log[oldDate], log[oldDate]);
check('今天日志保留', (log[todayDate] || []).includes('new_tpl'), log[todayDate]);

console.log(`\n${fail === 0 ? '🎉 全部通过' : `⚠️ ${fail} 项失败`}（${pass}✓ / ${fail}✗）`);
process.exit(fail === 0 ? 0 : 1);
