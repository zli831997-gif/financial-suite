import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import { FinanceAppState, reverseNetSalaryToGross } from '@finance/utils/financeState';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import './index.css';

/**
 * 跨端年金页（移植自上游 AnnuityView）。
 * 改造点：lucide→Icon；div/input/button→View/Input/Motion；financeState 从 storage 自取。
 * 复利 + 税差计算逻辑原样保留（纯前端公式）。
 */
export default function Annuity() {
  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);

  // 从档案带入税前工资和工作年限
  const profile = financeState.profile;
  const initSalary = profile ? Math.round(reverseNetSalaryToGross(profile.monthlyNetSalary || 12000)).toString() : '12000';
  const initYears = profile ? Math.max(15, profile.retireAge - profile.age).toString() : '25';

  const [activeTab, setActiveTab] = useState<'compounding' | 'tax_payout'>('compounding');
  const [salary, setSalary] = useState(initSalary);
  const [personalRate, setPersonalRate] = useState('4');
  const [companyRate, setCompanyRate] = useState('8');
  const [years, setYears] = useState(initYears);
  const [interestRate, setInterestRate] = useState('4.5');

  const calcAnnuity = () => {
    const s = parseFloat(salary) || 0;
    const pr = (parseFloat(personalRate) || 0) / 100;
    const cr = (parseFloat(companyRate) || 0) / 100;
    const y = parseInt(years) || 0;
    const r = (parseFloat(interestRate) || 0) / 100;
    const monthlyContribution = s * (pr + cr);
    const annualContribution = monthlyContribution * 12;
    let futureValue = 0;
    if (r === 0) futureValue = annualContribution * y;
    else futureValue = annualContribution * ((Math.pow(1 + r, y) - 1) / r);
    const monthlyPayout = futureValue / 180;
    return { monthlyContribution, totalContributions: annualContribution * y, futureValue, monthlyPayout };
  };

  const res = calcAnnuity();

  const calcTaxPayoutComparison = () => {
    const fv = res.futureValue;
    const lumpSumTax = fv * 0.1;
    const lumpSumNet = fv - lumpSumTax;
    const monthlyAmt = res.monthlyPayout;
    const installTaxMonthly = monthlyAmt * 0.03;
    const installNetMonthly = monthlyAmt - installTaxMonthly;
    const installTotalNet = installNetMonthly * 180;
    const savedTax = Math.max(0, lumpSumTax - installTaxMonthly * 180);
    return {
      lumpSumNet: Math.round(lumpSumNet),
      installTaxMonthly: Math.round(installTaxMonthly),
      installNetMonthly: Math.round(installNetMonthly),
      installTotalNet: Math.round(installTotalNet),
      savedTax: Math.round(savedTax),
    };
  };

  const payoutRep = calcTaxPayoutComparison();

  return (
    <View className='p-4 space-y-4 max-w-sm mx-auto w-full text-left min-h-screen bg-slate-50 pb-6'>
      {/* 档案联动提示 */}
      <View className='p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-2'>
        <Icon name='sparkles' size={16} className='text-indigo-600 shrink-0' />
        <Text className='text-[10px] text-indigo-900 leading-tight font-medium'>
          已对接您的理财生命档案。已预装预计可滚存积累工期 <Text className='font-bold'>{years}年</Text> 等参数。
        </Text>
      </View>

      {/* Tab 切换 */}
      <View className='flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100'>
        <Motion
          tapScale={0.95}
          onClick={() => setActiveTab('compounding')}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl text-center ${activeTab === 'compounding' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          复利增值追踪
        </Motion>
        <Motion
          tapScale={0.95}
          onClick={() => setActiveTab('tax_payout')}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl text-center ${activeTab === 'tax_payout' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          领取税差比对
        </Motion>
      </View>

      {activeTab === 'compounding' && (
        <View className='space-y-4 text-xs'>
          <Card className='border border-slate-100 bg-white'>
            <CardContent className='p-4 space-y-3'>
              <View>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>每月年金申报缴存基数 (元/月)</Text>
                <Input
                  type='digit'
                  value={salary}
                  onInput={(e) => setSalary(e.detail.value)}
                  className='w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold'
                />
              </View>
              <View className='grid grid-cols-2 gap-3'>
                <View>
                  <Text className='block text-[9px] font-bold text-slate-500 mb-1'>个人缴存比 (%)</Text>
                  <Input
                    type='digit'
                    value={personalRate}
                    onInput={(e) => setPersonalRate(e.detail.value)}
                    className='w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold'
                  />
                </View>
                <View>
                  <Text className='block text-[9px] font-bold text-slate-500 mb-1'>企业匹配比 (%)</Text>
                  <Input
                    type='digit'
                    value={companyRate}
                    onInput={(e) => setCompanyRate(e.detail.value)}
                    className='w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold'
                  />
                </View>
              </View>
              <View className='grid grid-cols-2 gap-3'>
                <View>
                  <Text className='block text-[9px] font-bold text-slate-500 mb-1'>连续共积累 (年)</Text>
                  <Input
                    type='digit'
                    value={years}
                    onInput={(e) => setYears(e.detail.value)}
                    className='w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold'
                  />
                </View>
                <View>
                  <Text className='block text-[9px] font-bold text-slate-500 mb-1'>历史投资年复合收益率 (%)</Text>
                  <Input
                    type='digit'
                    value={interestRate}
                    onInput={(e) => setInterestRate(e.detail.value)}
                    className='w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold'
                  />
                </View>
              </View>
            </CardContent>
          </Card>

          <Card className='bg-indigo-50/50 border border-indigo-100 bg-white'>
            <CardContent className='p-4 space-y-3.5 text-left'>
              <View className='flex items-center gap-1.5 text-indigo-800 font-bold text-xs'>
                <Icon name='target' size={15} />
                <Text>补充企业年金本金利息最终滚存值</Text>
              </View>
              <View className='text-center bg-white py-3 rounded-2xl border border-dashed border-indigo-300'>
                <Text className='text-[10px] text-slate-400 font-semibold mb-0.5 block'>预计退休时一次性累计滚存本息</Text>
                <Text className='text-2xl font-black text-indigo-600 font-mono block'>
                  ¥{res.futureValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </Text>
              </View>
              <View className='space-y-1.5 text-[10px] text-slate-600 bg-slate-50/50 p-2.5 rounded-xl font-medium'>
                <View className='flex justify-between'>
                  <Text>每月合计总缴存 (双边):</Text>
                  <Text className='font-bold text-slate-800 font-mono'>¥{Math.round(res.monthlyContribution).toLocaleString()} / 月</Text>
                </View>
                <View className='flex justify-between'>
                  <Text>双方投入本金总和:</Text>
                  <Text className='font-bold text-slate-800 font-mono'>¥{Math.round(res.totalContributions).toLocaleString()}</Text>
                </View>
                <View className='flex justify-between pt-1 text-indigo-600 font-bold border-t border-slate-200'>
                  <Text>退休分配预估每月增发 (分期):</Text>
                  <Text className='font-mono'>¥{res.monthlyPayout.toFixed(1)} / 月</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>
      )}

      {activeTab === 'tax_payout' && (
        <View className='space-y-4 text-xs'>
          <Card className='border border-slate-150 bg-white'>
            <CardContent className='p-4 space-y-3.5'>
              <View className='flex gap-2 items-center text-indigo-900 font-bold text-xs'>
                <Icon name='scale' size={15} className='text-indigo-600 shrink-0' />
                <Text>年金税费差额对比：一次性 vs 按月分期</Text>
              </View>
              <Text className='text-[9px] text-slate-400 leading-normal block'>
                企业/职业年金在退休发放时需补缴所得税。税法对分期按月和一次性领取有不同计税优惠规则：
              </Text>

              <View className='p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2'>
                <Text className='font-extrabold text-[10px] text-indigo-950 block'>💡 【分期按月领取】极其推荐！</Text>
                <Text className='text-[9px] text-indigo-900 leading-normal block'>
                  分期领取年金可单独享受 <Text className='font-bold'>3% 优惠档</Text>，相比一次性套现，分期计划能为您省税总计高达
                  <Text className='font-bold text-red-600'> ¥{payoutRep.savedTax.toLocaleString()} 元</Text>！
                </Text>
              </View>

              <View className='space-y-2.5'>
                <Text className='text-[10px] font-bold text-slate-500 uppercase tracking-wide block'>税费明细对账折算:</Text>
                <View className='grid grid-cols-2 gap-2'>
                  <View className='p-3 bg-rose-50/20 border border-rose-100/40 rounded-xl space-y-1'>
                    <Text className='text-[9px] text-red-700 font-bold block'>方案 A：一次套现</Text>
                    <Text className='text-xs font-bold text-slate-800 font-mono block'>到手: ¥{payoutRep.lumpSumNet.toLocaleString()}</Text>
                    <Text className='text-[8px] text-slate-400 block font-medium'>按 10% 优惠代扣所得税</Text>
                  </View>
                  <View className='p-3 bg-emerald-50/20 border border-emerald-100/40 rounded-xl space-y-1'>
                    <Text className='text-[9px] text-emerald-700 font-bold block'>方案 B：按月分领</Text>
                    <Text className='text-xs font-bold text-indigo-950 font-mono block'>到手: ¥{payoutRep.installNetMonthly.toLocaleString()} /月</Text>
                    <Text className='text-[8px] text-slate-400 block font-medium'>总得: ¥{payoutRep.installTotalNet.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>
      )}

      <View className='p-3 bg-slate-100 border border-slate-200 text-[10px] text-slate-405 rounded-2xl flex gap-1.5 items-start'>
        <Icon name='help' size={14} className='text-slate-400 shrink-0 mt-0.5' />
        <Text className='text-[9px] text-slate-400 leading-normal block'>
          年金是由优质企事业单位设立的延迟补充福利。年投资收益率设在 4% 左右为稳健估值，具有递延福利滚存效果。
        </Text>
      </View>
    </View>
  );
}
