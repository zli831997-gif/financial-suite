// 阶段2b gamification domain 逻辑验证（临时，跑完可删）
// 平台无关 domain 不碰浏览器，Node 里 mock storage 直接验证游戏化算法
import {
  ensureGrowth, getGrowth, onRecordCreated, redeemMakeupCard,
  getLevelInfo, BADGE_DEFS,
} from './src/logic/domain/gamification';

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
function resetGrowth() {
  Object.keys(mem).forEach(k => delete mem[k]);
  ensureGrowth();
}
function yesterdayStr(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

console.log('\n[1] 初始化');
resetGrowth();
check('默认 level 1', getGrowth().level === 1);
check('默认 1 张补签卡', getGrowth().makeupCards === 1);

console.log('\n[2] 记一笔 → 打卡 + 基础分 + 徽章');
const ev1 = onRecordCreated({ type: 'expense', amount: 100, date: '2026-06-20' }, { recordCount: 1, net: 5000, liabilities: 0 });
check('首次打卡', ev1.checkedIn === true);
check('streak=1', ev1.streak === 1);
check('有积分', ev1.pointsGained > 0, ev1.pointsGained);
check('解锁 first_checkin', getGrowth().badges.includes('first_checkin'));
check('解锁 first_record', getGrowth().badges.includes('first_record'));

console.log('\n[3] 同日再记 → 不重复打卡（幂等）');
const ev2 = onRecordCreated({ type: 'expense', amount: 50, date: '2026-06-20' }, { recordCount: 2, net: 5000, liabilities: 0 });
check('不重复打卡', ev2.checkedIn === false);
check('streak 仍=1', ev2.streak === 1);

console.log('\n[4] 连续 7 天 → streak=7 + 第7天送补签卡');
resetGrowth();
let gotCard = false;
for (let i = 0; i < 7; i++) {
  const d = `2026-06-${20 + i}`;
  const ev = onRecordCreated({ type: 'expense', amount: 10, date: d }, { recordCount: i + 1, net: 1000, liabilities: 0 });
  if (ev.gotMakeupCard) gotCard = true;
}
check('streak=7', getGrowth().streak === 7, getGrowth().streak, 7);
check('第7天送补签卡', gotCard === true);
check('补签卡≥2（初始1+送1）', getGrowth().makeupCards >= 2, getGrowth().makeupCards, 2);
check('解锁 streak_7 徽章', getGrowth().badges.includes('streak_7'));

console.log('\n[5] 净资产徽章');
resetGrowth();
onRecordCreated({ type: 'income', amount: 100, date: '2026-06-20' }, { recordCount: 1, net: 50000, liabilities: 0 });
check('net_10k 解锁（5万>1万）', getGrowth().badges.includes('net_10k'));
check('net_100k 未解锁（5万<10万）', !getGrowth().badges.includes('net_100k'));

console.log('\n[6] exp 只增、points 可消费（补签扣 points 不扣 exp）');
resetGrowth();
onRecordCreated({ type: 'income', amount: 100, date: '2026-06-20' }, { recordCount: 1, net: 0, liabilities: 0 });
const ptsBefore = getGrowth().points;
const expBefore = getGrowth().exp;
const res = redeemMakeupCard(yesterdayStr());
check('补签成功（有卡有分）', res.ok === true, res.ok);
check('补签扣 50 points', getGrowth().points === ptsBefore - 50, getGrowth().points, ptsBefore - 50);
check('exp 不减（只增）', getGrowth().exp === expBefore, getGrowth().exp, expBefore);

console.log('\n[7] getLevelInfo 等级表');
check('exp 0 → Lv1', getLevelInfo(0).level === 1);
check('exp 80 → Lv2', getLevelInfo(80).level === 2);
check('exp 25000 → Lv10', getLevelInfo(25000).level === 10);

console.log('\n[8] 徽章定义');
check('共 20 个徽章', BADGE_DEFS.length === 20, BADGE_DEFS.length, 20);

console.log(`\n${fail === 0 ? '🎉 全部通过' : `⚠️ ${fail} 项失败`}（${pass}✓ / ${fail}✗）`);
process.exit(fail === 0 ? 0 : 1);
