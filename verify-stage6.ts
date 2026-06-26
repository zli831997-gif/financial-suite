// 阶段6 PIN + 导出/恢复验证（mock storage）
import { setPin, hasPin, verifyPin, clearPin, hashPin, makeSalt } from './src/logic/domain/pinLock';
import { exportData, restoreData } from './src/utils/dataTransfer';
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

console.log('\n[1] pinLock（djb2+盐）');
reset();
check('初始无 PIN', hasPin() === false);
const saltA = makeSalt();
check('hashPin 同 pin+salt 一致', hashPin('1234', saltA) === hashPin('1234', saltA));
check('hashPin 不同 salt 不同', hashPin('1234', saltA) !== hashPin('1234', makeSalt()));
setPin('1234');
check('setPin → hasPin', hasPin() === true);
check('verifyPin 正确', verifyPin('1234') === true);
check('verifyPin 错误', verifyPin('0000') === false);
clearPin();
check('clearPin → 无 PIN', hasPin() === false);

console.log('\n[2] exportData（排除 fin_pin）');
reset();
mem[KEYS.RECORDS] = JSON.stringify([{ id: '1', type: 'expense', amount: 10, category: '测试', date: '2026-06-25', note: '' }]);
setPin('1234'); // 设 PIN，但导出应排除
const json = exportData();
const parsed = JSON.parse(json);
check('_meta.app = FinanceHub', parsed._meta?.app === 'FinanceHub', parsed._meta?.app);
check('含 fin_records', Array.isArray(parsed[KEYS.RECORDS]));
check('排除 fin_pin', parsed[KEYS.PIN] === undefined, parsed[KEYS.PIN]);

console.log('\n[3] restoreData（校验 + 写回）');
check('非 FinanceHub → ok:false', restoreData('{"_meta":{"app":"别的"}}').ok === false);
check('非法 JSON → ok:false', restoreData('not json').ok === false);
reset();
const r = restoreData(json);
check('恢复 ok', r.ok === true, r.msg);
check('恢复后 fin_records 回来', JSON.parse(mem[KEYS.RECORDS]).length === 1);
check('恢复不写 fin_pin', mem[KEYS.PIN] === undefined);

console.log(`\n${fail === 0 ? '🎉 全部通过' : `⚠️ ${fail} 项失败`}（${pass}✓ / ${fail}✗）`);
process.exit(fail === 0 ? 0 : 1);
