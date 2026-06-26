export interface UserProfile {
  city: string;
  monthlyNetSalary: number; // 到手薪资
  age: number;
  retireAge: number;
  hasHouse: boolean;
  hasCar: boolean;
  socialInsuranceSelf: number; // 每月社保个人扣款
}

export interface PropertyEntity {
  buyingPrice: number;
  currentValue: number;
  loanBalance: number;
  loanRate: number;
  monthlyPayment: number;
  payDay: number;
  isRented: boolean;
  rentIncome: number;
  address: string;
  isFullyPaid: boolean;
  totalLoanTerms?: number;
  remainingTerms?: number;
}

export interface VehicleEntity {
  name: string;
  purchasePrice: number;
  age: number;
  depreciationRate: number; // 默认 10%
  insuranceMonth: number;
  loanBalance: number;
  monthlyPayment: number;
  isFullyPaid: boolean;
  loanRate?: number;
  totalLoanTerms?: number;
  remainingTerms?: number;
}

export interface CryptoEntity {
  id: string;
  coin: string;
  amount: number;
  price: number;
}

export interface SavingEntity {
  id: string;
  name: string;
  amount: number;
  annualRate: number;
}

export interface FinanceAppState {
  profile: UserProfile;
  property: PropertyEntity | null;
  vehicle: VehicleEntity | null;
  cryptos: CryptoEntity[];
  savings: SavingEntity[];
  insuranceCashValue: number;
  otherLiabilities: number;
  budgetGoal: number; // 预算目标
}

export const INITIAL_STATE: FinanceAppState = {
  profile: {
    city: '深圳',
    monthlyNetSalary: 12000,
    age: 30,
    retireAge: 60,
    hasHouse: true,
    hasCar: true,
    socialInsuranceSelf: 2000,
  },
  property: {
    buyingPrice: 1800000,
    currentValue: 1650000,
    loanBalance: 900000,
    loanRate: 4.2,
    monthlyPayment: 4800,
    payDay: 15,
    isRented: false,
    rentIncome: 0,
    address: '深圳市宝安区精品房产',
    isFullyPaid: false,
    totalLoanTerms: 360,
    remainingTerms: 240
  },
  vehicle: {
    name: '我的爱车',
    purchasePrice: 250000,
    age: 2,
    depreciationRate: 12,
    insuranceMonth: 11,
    loanBalance: 110000,
    monthlyPayment: 3200,
    isFullyPaid: false,
    loanRate: 4.8,
    totalLoanTerms: 60,
    remainingTerms: 36
  },
  cryptos: [
    { id: '1', coin: 'BTC', amount: 0.15, price: 470000 }
  ],
  savings: [
    { id: '1', name: '招行定期', amount: 80000, annualRate: 2.2 }
  ],
  insuranceCashValue: 12000,
  otherLiabilities: 5000,
  budgetGoal: 3000,
};

// 反推算法已迁移到 logic/calc/（完整版：0.225 口径 + 累计预扣 + 23城），此处 re-export 保持使用点兼容
export { reverseGrossFromNet as reverseNetSalaryToGross } from '../logic/calc/salary';
export { reverseSocialSecurityBase } from '../logic/calc/social';

// Calculate onboarding completeness percentage (out of 100%)
export function calculateProfileCompleteness(state: FinanceAppState, transactionCount: number): {
  percent: number;
  checks: { name: string; completed: boolean; action: string; key: string; desc: string }[];
} {
  const checks = [
    { key: 'city', name: '设定生活常驻城市', completed: !!state.profile.city, action: '设置城市', desc: '用于计算精确的社平福利' },
    { key: 'salary', name: '完善个人薪酬档案', completed: state.profile.monthlyNetSalary > 0, action: '补充到手工资', desc: '用于个税与可支配预算反推' },
    { key: 'age', name: '配置年龄及退休规划', completed: state.profile.age > 0 && state.profile.retireAge > 0, action: '补充年龄数据', desc: '预测养老金与FIRE目标' },
    { key: 'savings', name: '添加第一笔存款或理财', completed: state.savings.length > 0, action: '添加存款理财', desc: '测算被动现金回报' },
    { key: 'property', name: '录入名下房产实体 (选填)', completed: !!state.property, action: '添加首套房产', desc: '自动联动月供与还款提醒' },
    { key: 'vehicle', name: '录入名下车产实体 (选填)', completed: !!state.vehicle, action: '添加爱车参数', desc: '车险续保期与车辆年贬值统计' },
    { key: 'trans', name: '完成一次日常记账打卡', completed: transactionCount > 0, action: '记一笔账', desc: '激活财气日常连续积分' },
    { key: 'budget', name: '确立本月理财储蓄目标', completed: state.budgetGoal > 0, action: '设定记账预算', desc: '自律生活的起点' },
  ];
  
  const completedCount = checks.filter(c => c.completed).length;
  const percent = Math.round((completedCount / checks.length) * 100);
  
  return { percent, checks };
}

// 游戏化（等级/经验/财气/徽章/打卡/补签卡）已迁移到 src/logic/domain/gamification.ts（独立 fin_growth）。
