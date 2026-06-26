// 阶段4 entitySync 验证（临时，跑完可删）
import { syncEntityAll } from './src/utils/entitySync';
import { getByLinkedEntity as getTplsByEntity } from './src/logic/domain/templates';
import { getByLinkedEntity as getRemsByEntity } from './src/logic/domain/reminders';
import type { PropertyEntity, VehicleEntity } from './src/utils/financeState';

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

const loanProp: PropertyEntity = {
  buyingPrice: 1800000, currentValue: 2000000, loanBalance: 500000, loanRate: 4,
  monthlyPayment: 5000, payDay: 20, isRented: false, rentIncome: 0,
  address: '测试房', isFullyPaid: false,
};
const rentProp: PropertyEntity = {
  ...loanProp, isFullyPaid: true, monthlyPayment: 0, loanBalance: 0,
  isRented: true, rentIncome: 3000,
};
const car: VehicleEntity = {
  name: '测试车', purchasePrice: 200000, age: 2, depreciationRate: 10,
  insuranceMonth: 0, loanBalance: 100000, monthlyPayment: 3000, isFullyPaid: false,
};

console.log('\n[1] 房贷 → 月供模板 + 还款提醒');
reset();
syncEntityAll(loanProp, null);
const loanTpls = getTplsByEntity('property-loan');
check('月供模板 1 条', loanTpls.length === 1, loanTpls.length, 1);
check('月供金额 5000', loanTpls[0].amount === 5000, loanTpls[0].amount, 5000);
check('day = 20', loanTpls[0].day === 20, loanTpls[0].day, 20);
check('还款提醒 1 条', getRemsByEntity('property-loan').length === 1, getRemsByEntity('property-loan').length, 1);

console.log('\n[2] 出租 → 租金收入模板');
reset();
syncEntityAll(rentProp, null);
const rentTpls = getTplsByEntity('property-rent');
check('租金模板 1 条', rentTpls.length === 1, rentTpls.length, 1);
check('类型 income', rentTpls[0].type === 'income', rentTpls[0].type);
check('租金 3000', rentTpls[0].amount === 3000, rentTpls[0].amount, 3000);
check('已还清 → 无月供模板', getTplsByEntity('property-loan').length === 0);

console.log('\n[3] 已还清 → 移除月供模板/提醒');
reset();
syncEntityAll(loanProp, null);
syncEntityAll({ ...loanProp, isFullyPaid: true, monthlyPayment: 0 }, null);
check('还清后无月供模板', getTplsByEntity('property-loan').length === 0);
check('还清后无提醒', getRemsByEntity('property-loan').length === 0);

console.log('\n[4] upsert 幂等（id 不变）');
reset();
syncEntityAll(loanProp, null);
const id1 = getTplsByEntity('property-loan')[0].id;
syncEntityAll(loanProp, null);
const id2 = getTplsByEntity('property-loan')[0].id;
check('二次 sync 模板 id 不变', id1 === id2, id2, id1);
check('仍 1 条（不新增）', getTplsByEntity('property-loan').length === 1);

console.log('\n[5] 车贷 → 月供模板 + 提醒');
reset();
syncEntityAll(null, car);
const carTpls = getTplsByEntity('vehicle-loan');
check('车贷模板 1 条', carTpls.length === 1, carTpls.length, 1);
check('车贷金额 3000', carTpls[0].amount === 3000, carTpls[0].amount, 3000);
check('车贷提醒 1 条', getRemsByEntity('vehicle-loan').length === 1);

console.log('\n[6] 同时房 + 车');
reset();
syncEntityAll(loanProp, car);
check('房产月供模板', getTplsByEntity('property-loan').length === 1);
check('车贷月供模板', getTplsByEntity('vehicle-loan').length === 1);

console.log(`\n${fail === 0 ? '🎉 全部通过' : `⚠️ ${fail} 项失败`}（${pass}✓ / ${fail}✗）`);
process.exit(fail === 0 ? 0 : 1);
