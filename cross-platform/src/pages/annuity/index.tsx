import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import { FinanceAppState, reverseNetSalaryToGross } from '@finance/utils/financeState';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import { calcAnnuity, getVestingRatio } from '@finance/logic/calc/annuity';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import './index.css';

/**
 * 跨端企业年金页。
 * 回答用户最关心的：
 * 1. 退休每月能领多少（计发月数 + 退休后生息）
 * 2. 现在离职/跳槽能带走多少（企业缴费归属期）
 * 3. 一次性 vs 分期税差
 *
 * 复用 calc/annuity.ts（纯函数，已手算验证）。
 */
function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

export default function Annuity() {
  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);

  const profile = financeState.profile;
  const initSalary = profile ? Math.round(reverseNetSalaryToGross(profile.monthlyNetSalary || 12000)).toString() : '15000';
  const initWorked = profile ? Math.max(0, profile.retireAge - profile.age - 25).toString() : '5';
  const initRetire = profile ? profile.retireAge.toString() : '60';

  const [activeTab, setActiveTab] = useState<'payout' | 'resign'>('payout');
  const [salary, setSalary] = useState(initSalary);
  const [personalRate, setPersonalRate] = useState('4');
  const [companyRate, setCompanyRate] = useState('8');
  const [workedYears, setWorkedYears] = useState(initWorked);
  const [retireAge, setRetireAge] = useState(initRetire);
  const [returnRate, setReturnRate] = useState('4.5');

  const res = calcAnnuity({
    monthlyBase: parseFloat(salary) || 0,
    personalRate: (parseFloat(personalRate) || 0) / 100,
    companyRate: (parseFloat(companyRate) || 0) / 100,
    workedYears: parseInt(workedYears) || 0,
    remainingYears: Math.max(0, (parseInt(retireAge) || 60) - (profile?.age || 30)),
    returnRate: (parseFloat(returnRate) || 0) / 100,
    retireAge: parseInt(retireAge) || 60,
  });

  // 税差对比（分期3% vs 一次性10%）
  const installTotal = res.totalPayoutAfterTax;
  const lumpTotal = res.lumpSumAfterTax;
  const taxSaving = installTotal - lumpTotal;

  return (
    <View className='p-4 space-y-4 max-w-md mx-auto w-full min-h-screen bg-slate-50 pb-6'>
      <View className='pb-1 border-b border-slate-100'>
        <Text className='text-base font-black text-slate-900 flex items-center gap-1.5'>
          <Icon name='piggyBank' size={18} className='text-indigo-600' /> 企业年金精算
        </Text>
        <Text className='text-[10px] text-slate-400 block'>退休每月领多少 · 离职能带走多少</Text>
      </View>

      {/* 参数输入 */}
      <Card>
        <CardContent className='p-4 space-y-3'>
          <View className='grid grid-cols-2 gap-3'>
            <Field label='月缴存基数' value={salary} onChange={setSalary} suffix='元' />
            <Field label='已工作年限' value={workedYears} onChange={setWorkedYears} suffix='年' />
          </View>
          <View className='grid grid-cols-2 gap-3'>
            <Field label='个人缴存比' value={personalRate} onChange={setPersonalRate} suffix='%' />
            <Field label='企业匹配比' value={companyRate} onChange={setCompanyRate} suffix='%' />
          </View>
          <View className='grid grid-cols-2 gap-3'>
            <Field label='退休年龄' value={retireAge} onChange={setRetireAge} suffix='岁' />
            <Field label='年化收益率' value={returnRate} onChange={setReturnRate} suffix='%' />
          </View>
          <View className='flex justify-between text-[10px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2'>
            <Text>每月缴存：个人¥{fmt(res.personalMonthly)} + 企业¥{fmt(res.companyMonthly)}</Text>
            <Text className='font-bold text-indigo-600'>合计¥{fmt(res.totalMonthly)}/月</Text>
          </View>
        </CardContent>
      </Card>

      {/* Tab */}
      <View className='flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100 gap-0.5'>
        <Motion tapScale={0.95} onClick={() => setActiveTab('payout')} className={`flex-1 py-1.5 text-[11px] font-bold rounded-xl text-center ${activeTab === 'payout' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          退休领取
        </Motion>
        <Motion tapScale={0.95} onClick={() => setActiveTab('resign')} className={`flex-1 py-1.5 text-[11px] font-bold rounded-xl text-center ${activeTab === 'resign' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          离职归属
        </Motion>
      </View>

      {/* Tab1：退休领取（突出每月领多少）*/}
      {activeTab === 'payout' && (
        <View className='space-y-3'>
          {/* 核心：每月到手 */}
          <Card className='bg-gradient-to-br from-indigo-600 to-blue-600 border-0 text-white'>
            <CardContent className='p-5 pt-5 text-center'>
              <Text className='text-[11px] text-indigo-100 font-bold block mb-1'>
                退休后每月到手（按{retireAge}岁·{res.payoutMonths}个月计发）
              </Text>
              <Text className='text-4xl font-black font-mono block'>¥{fmt(res.monthlyPayoutAfterTax)}</Text>
              <Text className='text-[10px] text-indigo-200 mt-1 block'>
                税前¥{fmt(res.monthlyPayout)} · 已扣3%分期优惠税
              </Text>
            </CardContent>
          </Card>

          {/* 滚存构成 */}
          <Card>
            <CardContent className='p-4 space-y-2'>
              <Text className='text-[10px] font-bold text-slate-500 block'>退休时账户滚存</Text>
              <View className='flex justify-between items-center'>
                <Text className='text-sm font-black text-slate-900 font-mono'>¥{fmt(res.futureValue)}</Text>
                <Text className='text-[10px] text-emerald-600 font-bold'>收益 ¥{fmt(res.earnings)}</Text>
              </View>
              <View className='border-t border-slate-100 pt-2 space-y-1'>
                <Row label='个人累计缴存本金' value={res.personalTotalContribution} />
                <Row label='企业累计缴存本金' value={res.companyTotalContribution} />
                <Row label='投资收益' value={res.earnings} accent='emerald' />
              </View>
            </CardContent>
          </Card>

          {/* 领取方式对比 */}
          <Card>
            <CardContent className='p-4 space-y-3'>
              <Text className='text-[10px] font-bold text-slate-500 block'>领取方式对比</Text>
              <View className='grid grid-cols-2 gap-2'>
                <View className='p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center'>
                  <Text className='text-[9px] text-emerald-700 font-bold block'>分期按月（推荐）</Text>
                  <Text className='text-sm font-black text-emerald-600 font-mono block'>¥{fmt(res.monthlyPayoutAfterTax)}/月</Text>
                  <Text className='text-[8px] text-slate-400 block mt-0.5'>累计到手 ¥{fmt(installTotal)}</Text>
                  <Text className='text-[8px] text-emerald-600 font-bold bg-emerald-100 rounded px-1 mt-1 inline-block'>3%优惠税</Text>
                </View>
                <View className='p-3 bg-slate-50 border border-slate-150 rounded-xl text-center'>
                  <Text className='text-[9px] text-slate-500 font-bold block'>一次性领取</Text>
                  <Text className='text-sm font-black text-slate-700 font-mono block'>¥{fmt(res.lumpSumAfterTax)}</Text>
                  <Text className='text-[8px] text-slate-400 block mt-0.5'>一次性到手</Text>
                  <Text className='text-[8px] text-rose-500 font-bold bg-rose-50 rounded px-1 mt-1 inline-block'>10%税</Text>
                </View>
              </View>
              {taxSaving > 0 && (
                <View className='bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-[10px] text-emerald-800 font-semibold flex items-center gap-1'>
                  <Icon name='coins' size={12} />
                  分期比一次性多到手 ¥{fmt(taxSaving)}（差额来自分期个税优惠 + 未领部分生息）
                </View>
              )}
            </CardContent>
          </Card>

          <View className='p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl text-[10px] text-indigo-900 leading-relaxed flex gap-1.5'>
            <Icon name='info' size={13} className='shrink-0 mt-0.5 text-indigo-600' />
            <View>
              <Text className='font-bold block'>每月到手怎么算的</Text>
              <Text className='block'>按退休年龄{retireAge}岁的法定计发月数（{res.payoutMonths}个月）分摊账户余额，未领取部分在领取期内继续按{returnRate}%年化生息，因此每月到手略高于简单均分。分期领取享3%优惠个税。</Text>
            </View>
          </View>
        </View>
      )}

      {/* Tab2：离职归属（离职能带走多少）*/}
      {activeTab === 'resign' && (
        <View className='space-y-3'>
          <Card className={res.vestingRatio >= 1 ? 'border-emerald-200' : 'border-amber-200'}>
            <CardContent className={`p-5 text-center ${res.vestingRatio >= 1 ? 'bg-emerald-50/50' : 'bg-amber-50/50'}`}>
              <Text className={`text-[11px] font-bold block mb-1 ${res.vestingRatio >= 1 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {res.vestingRatio >= 1 ? '✅ 企业部分已100%归属' : '⚠️ 企业部分尚未全部归属'}
              </Text>
              <Text className='text-[10px] text-slate-500 block mb-2'>工作{workedYears}年 · 企业缴费归属{Math.round(res.vestingRatio * 100)}%</Text>
              <Text className='text-3xl font-black font-mono text-slate-900 block'>¥{fmt(res.vestedTotal)}</Text>
              <Text className='text-[10px] text-slate-400 mt-1 block'>离职可全部带走</Text>
            </CardContent>
          </Card>

          {/* 归属明细 */}
          <Card>
            <CardContent className='p-4 space-y-2'>
              <Text className='text-[10px] font-bold text-slate-500 block'>归属明细</Text>
              <Row label='个人缴存部分（100%归属）' value={res.vestedPersonal} accent='emerald' />
              <Row label={`企业缴存部分（归属${Math.round(res.vestingRatio * 100)}%）`} value={res.vestedCompany} />
              {res.unvestedLost > 0 && (
                <Row label='❌ 因未满归属期损失' value={res.unvestedLost} accent='rose' />
              )}
              <View className='border-t border-slate-100 pt-2'>
                <Row label='离职共能带走' value={res.vestedTotal} bold />
              </View>
            </CardContent>
          </Card>

          {/* 归属进度 */}
          <Card>
            <CardContent className='p-4 space-y-2'>
              <Text className='text-[10px] font-bold text-slate-500 block'>归属进度（满8年100%）</Text>
              <View className='flex items-center gap-2'>
                <View className='flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden'>
                  <View className='h-full bg-indigo-600 rounded-full' style={{ width: `${Math.min(100, res.vestingRatio * 100)}%` }} />
                </View>
                <Text className='text-[10px] font-bold text-slate-700 font-mono'>{Math.round(res.vestingRatio * 100)}%</Text>
              </View>
              {res.vestingRatio < 1 && (
                <Text className='text-[10px] text-amber-600 font-medium block mt-1'>
                  还需工作 <Text className='font-bold'>{8 - (parseInt(workedYears) || 0)}</Text> 年，企业部分才100%归属。
                  此前离职会损失企业缴存的 ¥{fmt(res.unvestedLost)}。
                </Text>
              )}
            </CardContent>
          </Card>

          {/* 跳槽决策提示 */}
          <View className='p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-[10px] text-amber-900 leading-relaxed flex gap-1.5'>
            <Icon name='sparkles' size={13} className='shrink-0 mt-0.5 text-amber-600' />
            <View>
              <Text className='font-bold block'>跳槽参考</Text>
              <Text className='block'>
                {res.vestingRatio < 1
                  ? `若现在跳槽到无年金的单位，将损失企业缴存 ¥${fmt(res.unvestedLost)}。新单位的薪资涨幅需覆盖这部分损失才划算。`
                  : '企业部分已100%归属，跳槽不会损失年金，可放心比较新机会。'}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* 通用小组件 */
function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <View>
      <Text className='block text-[9px] font-bold text-slate-500 mb-1'>{label}</Text>
      <View className='flex items-center bg-slate-100 rounded-lg px-3 py-2'>
        <Input type='digit' value={value} onInput={(e) => onChange(e.detail.value)} className='flex-1 bg-transparent text-xs font-bold text-slate-800' />
        {suffix && <Text className='text-[9px] text-slate-400 ml-1 shrink-0'>{suffix}</Text>}
      </View>
    </View>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: number; bold?: boolean; accent?: 'emerald' | 'rose' }) {
  const color = accent === 'emerald' ? 'text-emerald-600' : accent === 'rose' ? 'text-rose-500' : 'text-slate-700';
  return (
    <View className='flex justify-between items-center text-[11px]'>
      <Text className={bold ? 'text-slate-700 font-bold' : 'text-slate-400'}>{label}</Text>
      <Text className={`font-mono ${bold ? 'font-black ' + color : 'font-semibold ' + color}`}>¥{fmt(value)}</Text>
    </View>
  );
}
