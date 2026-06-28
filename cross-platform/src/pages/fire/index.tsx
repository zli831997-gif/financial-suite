import { useState, useMemo } from 'react';
import { View, Text, Input } from '@tarojs/components';
import { FinanceAppState, reverseNetSalaryToGross } from '@finance/utils/financeState';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import { calcFIRE } from '@finance/logic/calc/pension';
import { calcNetAssets } from '@finance/logic/calc/netAssets';
import { getAccountsNetBalance } from '@finance/logic/domain/accounts';
import { getRecords } from '@finance/logic/domain/records';
import { calcEmployeePension } from '@finance/logic/calc/pension';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import { MiniTrend } from '../../components/MiniChart';
import './index.css';

/**
 * FIRE 财务自由测算。
 * 回答"什么时候能靠被动收入生活"——基于4%法则 + 用户真实数据。
 * 复用现有 calcFIRE（纯函数，从未接入 UI，这里启用）。
 *
 * 数据接入（真实化）：
 * - 月支出：从记账取近3个月支出均值（无数据则用档案薪资估）
 * - 当前净资产：calcNetAssets（资产-负债）
 * - 养老金：从档案算退休后月领
 */

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

/** 从记账数据算近3个月月均支出 */
function getRecentMonthlyExpense(): number {
  const records = getRecords();
  const now = new Date();
  const months: Record<string, number> = {};
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
  }
  let hasData = false;
  for (const r of records) {
    const ym = r.date.slice(0, 7);
    if (ym in months && r.type === 'expense') {
      months[ym] += r.amount;
      hasData = true;
    }
  }
  if (!hasData) return 0;
  const total = Object.values(months).reduce((s, v) => s + v, 0);
  const validMonths = Object.values(months).filter((v) => v > 0).length || 1;
  return Math.round(total / validMonths);
}

export default function Fire() {
  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);
  const profile = financeState.profile;

  // 真实数据预填
  const realExpense = getRecentMonthlyExpense();
  const realNetAssets = calcNetAssets(financeState, getAccountsNetBalance()).net;
  const realPension = profile
    ? calcEmployeePension({
        province: profile.city,
        personalSalary: reverseNetSalaryToGross(profile.monthlyNetSalary || 12000),
        contributionYears: Math.max(15, profile.retireAge - profile.age),
        personalAccountBalance:
          reverseNetSalaryToGross(profile.monthlyNetSalary || 12000) * 0.08 * 12 *
          Math.max(15, profile.retireAge - profile.age),
        retireAge: profile.retireAge,
      }).monthlyPension
    : 0;

  const [monthlyExpense, setMonthlyExpense] = useState(
    realExpense > 0 ? realExpense.toString() : Math.round((profile?.monthlyNetSalary || 12000) * 0.6).toString(),
  );
  const [savings, setSavings] = useState(Math.round(realNetAssets).toString());
  const [returnRate, setReturnRate] = useState('4');
  const [currentAge, setCurrentAge] = useState((profile?.age || 30).toString());

  const result = useMemo(() => calcFIRE({
    monthlyExpense: parseFloat(monthlyExpense) || 0,
    savings: parseFloat(savings) || 0,
    annualReturnRate: (parseFloat(returnRate) || 0) / 100,
    inflationRate: 0.03,
    retireYears: 60,
    pensionIncome: Math.round(realPension),
    pensionStartAge: profile?.retireAge || 60,
    currentAge: parseInt(currentAge) || 30,
  }), [monthlyExpense, savings, returnRate, currentAge, realPension, profile]);

  const fireNumber = result.fireNumber;
  const progress = realNetAssets > 0 && fireNumber > 0 ? Math.min(100, (realNetAssets / fireNumber) * 100) : 0;
  const yearsToFire = result.isSustainable
    ? 0
    : result.sustainableYears > 0
      ? 0
      : 0;

  // 还需攒多少
  const remaining = Math.max(0, fireNumber - (parseFloat(savings) || 0));
  // 按当前储蓄能力（月收入-月支出）算还需几年
  const monthlySurplus = Math.max(0, (profile?.monthlyNetSalary || 0) - (parseFloat(monthlyExpense) || 0));
  const yearsIfSaving = monthlySurplus > 0 ? remaining / (monthlySurplus * 12) : Infinity;

  return (
    <View className='p-4 space-y-4 max-w-md mx-auto w-full min-h-screen bg-slate-50 pb-6'>
      <View className='pb-1 border-b border-slate-100'>
        <Text className='text-base font-black text-slate-900 flex items-center gap-1.5'>
          <Icon name='sparkles' size={18} className='text-emerald-600' /> FIRE 财务自由测算
        </Text>
        <Text className='text-[10px] text-slate-400 block'>什么时候能靠被动收入覆盖生活开支</Text>
      </View>

      {/* 4%法则说明 */}
      <View className='p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex gap-2'>
        <Icon name='info' size={14} className='text-emerald-600 shrink-0 mt-0.5' />
        <View>
          <Text className='text-[10px] font-bold text-emerald-900 block'>什么是 FIRE？</Text>
          <Text className='text-[9px] text-emerald-800 leading-relaxed block'>
            4%法则：攒够年支出的25倍（即每年靠4%投资收益生活），即可财务自由。
            下方数据已自动带入你的真实记账与档案。
          </Text>
        </View>
      </View>

      {/* 输入 */}
      <Card>
        <CardContent className='p-4 space-y-3'>
          <Field label='月生活支出' value={monthlyExpense} onChange={setMonthlyExpense} suffix='元/月' hint={realExpense > 0 ? '已带入近3月均值' : '预估'} />
          <Field label='当前可投资净资产' value={savings} onChange={setSavings} suffix='元' hint={realNetAssets > 0 ? '已带入实际净资产' : ''} />
          <View className='grid grid-cols-2 gap-3'>
            <Field label='当前年龄' value={currentAge} onChange={setCurrentAge} suffix='岁' />
            <Field label='投资年化收益' value={returnRate} onChange={setReturnRate} suffix='%' />
          </View>
        </CardContent>
      </Card>

      {/* 核心：自由数字 */}
      <Card className='bg-gradient-to-br from-emerald-600 to-teal-600 border-0 text-white'>
        <CardContent className='p-5 pt-5 text-center'>
          <Text className='text-[11px] text-emerald-100 font-bold block mb-1'>你的财务自由数字（FIRE Number）</Text>
          <Text className='text-3xl font-black font-mono block'>¥{fmt(fireNumber)}</Text>
          <Text className='text-[10px] text-emerald-200 mt-1 block'>
            = 月支出¥{fmt(parseFloat(monthlyExpense) || 0)} × 12 × 25
          </Text>
        </CardContent>
      </Card>

      {/* 进度 */}
      <Card>
        <CardContent className='p-4 space-y-3'>
          <View className='flex justify-between items-center'>
            <Text className='text-xs font-bold text-slate-600'>距离财务自由</Text>
            <Text className='text-sm font-black text-emerald-600 font-mono'>{progress.toFixed(1)}%</Text>
          </View>
          <View className='h-3 bg-slate-100 rounded-full overflow-hidden'>
            <View className='h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full' style={{ width: `${progress}%` }} />
          </View>
          <View className='flex justify-between text-[10px] text-slate-400'>
            <Text>当前 ¥{fmt(parseFloat(savings) || 0)}</Text>
            <Text>目标 ¥{fmt(fireNumber)}</Text>
          </View>
          {remaining > 0 && (
            <View className='bg-amber-50 border border-amber-100 rounded-lg p-2 text-[10px] text-amber-800 font-semibold'>
              还需攒 <Text className='font-bold'>¥{fmt(remaining)}</Text>
              {isFinite(yearsIfSaving) && monthlySurplus > 0
                ? `，按每月结余¥${fmt(monthlySurplus)}，约需 ${Math.ceil(yearsIfSaving)} 年`
                : '（月支出≥月收入，需先增加结余）'}
            </View>
          )}
        </CardContent>
      </Card>

      {/* 退休后能否撑住 */}
      <Card>
        <CardContent className='p-4 space-y-3'>
          <Text className='text-xs font-bold text-slate-600 block'>现在就退休，能撑多久？</Text>
          <View className={`p-3 rounded-xl text-center ${result.sustainableYears >= 60 ? 'bg-emerald-50' : result.sustainableYears >= 30 ? 'bg-amber-50' : 'bg-rose-50'}`}>
            <Text className={`text-2xl font-black font-mono block ${result.sustainableYears >= 60 ? 'text-emerald-600' : result.sustainableYears >= 30 ? 'text-amber-600' : 'text-rose-600'}`}>
              {result.sustainableYears >= 60 ? '✓ 终身够用' : `${result.sustainableYears} 年`}
            </Text>
            <Text className='text-[10px] text-slate-400 block mt-0.5'>
              {result.sustainableYears >= 60
                ? '按当前净资产和支出，投资收益足以覆盖终身（含通胀+养老金补充）'
                : `按当前净资产退休，资金约在${result.sustainableYears}年后耗尽`}
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* 逐年资产推演（前12年趋势）*/}
      {result.yearlyProjection.length > 0 && (
        <Card>
          <CardContent className='p-4 space-y-2'>
            <Text className='text-xs font-bold text-slate-500 block'>资产逐年推演（前12年）</Text>
            <MiniTrend data={result.yearlyProjection.slice(0, 12).map((y) => Math.max(0, y.balance))} height={100} color='#10b981' />
            <View className='flex justify-between text-[8px] text-slate-400'>
              {result.yearlyProjection.slice(0, 12).map((y) => (
                <Text key={y.year}>{y.age}岁</Text>
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      <View className='p-3 bg-slate-100 rounded-xl text-[10px] text-slate-400 leading-relaxed'>
        <Text className='font-bold text-slate-500 block mb-1'>测算假设</Text>
        <Text className='block'>
          · 4%法则：年支出×25{'\n'}
          · 通胀率 3%（支出逐年增长）{'\n'}
          · 投资{returnRate}%年化收益{'\n'}
          · {profile?.retireAge || 60}岁起领养老金 ¥{fmt(realPension)}/月（已计入）
        </Text>
      </View>
    </View>
  );
}

function Field({ label, value, onChange, suffix, hint }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; hint?: string }) {
  return (
    <View>
      <View className='flex justify-between items-center mb-1'>
        <Text className='text-[9px] font-bold text-slate-500'>{label}</Text>
        {hint && <Text className='text-[9px] text-emerald-500 font-semibold'>{hint}</Text>}
      </View>
      <View className='flex items-center bg-slate-100 rounded-lg px-3 py-2'>
        <Text className='text-slate-400 mr-1 text-xs'>¥</Text>
        <Input type='digit' value={value} onInput={(e) => onChange(e.detail.value)} className='flex-1 bg-transparent text-sm font-mono font-bold text-slate-800' />
        {suffix && <Text className='text-[9px] text-slate-400 ml-1 shrink-0'>{suffix}</Text>}
      </View>
    </View>
  );
}
