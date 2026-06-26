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
 * 跨端个税页（移植自上游 TaxView）。
 * 改造点：lucide→Icon；div/input/button/select→View/Input/Motion；financeState 从 storage 自取。
 * 计税公式（综合所得/年终奖/劳务稿酬/期权）原样保留。
 */
export default function Tax() {
  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);

  const [activeTab, setActiveTab] = useState<'salary_bonus' | 'part_time_labor' | 'options_equity'>('salary_bonus');
  const [inputMode, setInputMode] = useState<'gross' | 'net'>('net');
  const [salaryVal, setSalaryVal] = useState<string>(
    financeState.profile?.monthlyNetSalary?.toString() || '12000',
  );
  const [bonus, setBonus] = useState('30000');
  const [monthlyDeduction, setMonthlyDeduction] = useState('2000');
  const [laborAmount, setLaborAmount] = useState('8000');
  const [royaltyAmount, setRoyaltyAmount] = useState('5000');
  const [equityValue, setEquityValue] = useState('150000');
  const [grantPrice, setGrantPrice] = useState('50000');

  // 综合所得税计算
  const calcComprehensiveTax = (amount: number) => {
    let tax = 0;
    let rate = 0;
    if (amount <= 36000) { tax = amount * 0.03; rate = 3; }
    else if (amount <= 144000) { tax = amount * 0.1 - 2520; rate = 10; }
    else if (amount <= 300000) { tax = amount * 0.2 - 16920; rate = 20; }
    else if (amount <= 420000) { tax = amount * 0.25 - 31920; rate = 25; }
    else if (amount <= 660500) { tax = amount * 0.3 - 52920; rate = 30; }
    else { tax = amount * 0.35 - 85920; rate = 35; }
    return { tax: Math.max(0, tax), rate };
  };

  const calculateSalaryAndBonus = () => {
    const rawVal = parseFloat(salaryVal) || 0;
    const b = parseFloat(bonus) || 0;
    const specDeduct = parseFloat(monthlyDeduction) || 0;
    let grossSalary = inputMode === 'net' ? reverseNetSalaryToGross(rawVal) : rawVal;
    const socialDeduction = Math.min(grossSalary * 0.105, 3000);
    const annualGross = grossSalary * 12;
    const salaryTaxable = annualGross - 60000 - socialDeduction * 12 - specDeduct * 12;
    const salaryTaxResult = calcComprehensiveTax(salaryTaxable);
    const monthlyBonus = b / 12;
    let bonusTax = 0;
    if (b > 0) {
      if (monthlyBonus <= 3000) bonusTax = b * 0.03;
      else if (monthlyBonus <= 12000) bonusTax = b * 0.1 - 210;
      else if (monthlyBonus <= 25000) bonusTax = b * 0.2 - 1410;
      else if (monthlyBonus <= 35000) bonusTax = b * 0.25 - 2660;
      else bonusTax = b * 0.3 - 4410;
    }
    const totalTaxSeparate = salaryTaxResult.tax + bonusTax;
    const mergedTaxResult = calcComprehensiveTax(salaryTaxable + b);
    const totalTaxMerged = mergedTaxResult.tax;
    return {
      totalTaxSeparate,
      totalTaxMerged,
      salaryTax: salaryTaxResult.tax,
      bonusTax,
      isSeparateBetter: totalTaxSeparate <= totalTaxMerged,
      savedAmount: Math.abs(totalTaxMerged - totalTaxSeparate),
      bracketRate: salaryTaxResult.rate,
    };
  };

  const calculateLaborRemuneration = () => {
    const rawLabor = parseFloat(laborAmount) || 0;
    const rawRoyalty = parseFloat(royaltyAmount) || 0;
    const laborTaxable = rawLabor <= 4000 ? Math.max(0, rawLabor - 800) : rawLabor * 0.8;
    let laborTax = laborTaxable <= 20000 ? laborTaxable * 0.2 : laborTaxable <= 50000 ? laborTaxable * 0.3 - 2000 : laborTaxable * 0.4 - 7000;
    const royaltyTaxable = rawRoyalty <= 4000 ? Math.max(0, rawRoyalty - 800) * 0.7 : rawRoyalty * 0.8 * 0.7;
    const royaltyTax = royaltyTaxable * 0.2;
    return { laborTax, laborNet: rawLabor - laborTax, royaltyTax, royaltyNet: rawRoyalty - royaltyTax };
  };

  const calculateEquityTax = () => {
    const gain = Math.max(0, (parseFloat(equityValue) || 0) - (parseFloat(grantPrice) || 0));
    const r = calcComprehensiveTax(gain);
    return { gain, tax: r.tax, netValue: (parseFloat(equityValue) || 0) - r.tax, bracketRate: r.rate };
  };

  const salRep = calculateSalaryAndBonus();
  const laborRep = calculateLaborRemuneration();
  const eqRep = calculateEquityTax();

  return (
    <View className='p-4 space-y-4 max-w-sm mx-auto w-full text-left min-h-screen bg-slate-50 pb-6'>
      <View className='pb-1 border-b border-slate-100'>
        <Text className='text-base font-black text-slate-900 flex items-center gap-1.5'>
          <Icon name='receipt' size={18} className='text-blue-600' /> 个税反向算费
        </Text>
      </View>

      {/* Tab */}
      <View className='flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100'>
        {[
          { id: 'salary_bonus' as const, label: '月薪/年终奖' },
          { id: 'part_time_labor' as const, label: '劳务稿酬' },
          { id: 'options_equity' as const, label: '股权期权' },
        ].map((t) => (
          <Motion
            key={t.id}
            tapScale={0.95}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl text-center ${activeTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {t.label}
          </Motion>
        ))}
      </View>

      {/* 月薪年终奖 */}
      {activeTab === 'salary_bonus' && (
        <View className='space-y-4'>
          <Card>
            <CardContent className='p-4 space-y-3.5'>
              <View className='flex justify-between items-center'>
                <Text className='text-xs font-bold text-slate-800'>计税输入</Text>
                <Motion
                  tapScale={0.95}
                  onClick={() => setInputMode((p) => (p === 'net' ? 'gross' : 'net'))}
                  className='text-[9px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg'
                >
                  切换: {inputMode === 'net' ? '税前' : '到手'}
                </Motion>
              </View>

              <View className='bg-slate-50 p-3 rounded-2xl border border-slate-200/50 space-y-3'>
                <View>
                  <Text className='block text-[10px] font-bold text-slate-500 mb-1'>
                    {inputMode === 'net' ? '💰 每月实收到手薪资 (元)' : '💼 每月税前薪资 (元)'}
                  </Text>
                  <Input
                    type='digit'
                    value={salaryVal}
                    onInput={(e) => setSalaryVal(e.detail.value)}
                    placeholder='如 12000'
                    className='w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold'
                  />
                </View>
                <View className='grid grid-cols-2 gap-2'>
                  <View>
                    <Text className='block text-[9px] font-bold text-slate-500 mb-1'>🎁 年终奖 (元)</Text>
                    <Input type='digit' value={bonus} onInput={(e) => setBonus(e.detail.value)} className='w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold' />
                  </View>
                  <View>
                    <Text className='block text-[9px] font-bold text-slate-500 mb-1'>🛡️ 专项附加扣除 (元)</Text>
                    <Input type='digit' value={monthlyDeduction} onInput={(e) => setMonthlyDeduction(e.detail.value)} className='w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold' />
                  </View>
                </View>
              </View>

              {/* 决策建议 */}
              <View className='p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-1.5'>
                <View className='flex gap-1.5 items-center text-indigo-900 font-bold text-xs'>
                  <Icon name='sparkles' size={14} className='text-indigo-600 shrink-0' />
                  <Text>年终奖最优规划决策</Text>
                </View>
                <Text className='text-[10px] text-indigo-950 leading-relaxed font-semibold block'>
                  {salRep.isSeparateBetter
                    ? `💡 【单独计税更划算】可省个税 `
                    : `💡 【合并报税更划算】可多保留 `}
                  <Text className={salRep.isSeparateBetter ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                    ¥{Math.round(salRep.savedAmount).toLocaleString()}
                  </Text>
                </Text>
              </View>

              {/* 两方案对比 */}
              <View className='grid grid-cols-2 gap-2'>
                <View className='p-3.5 bg-indigo-50/20 border border-indigo-100 rounded-xl text-center'>
                  <Text className='text-[9px] text-indigo-600 font-bold block'>方案一：单独计税</Text>
                  <Text className='text-sm font-black text-indigo-950 font-mono block'>¥{Math.round(salRep.totalTaxSeparate).toLocaleString()}</Text>
                  <Text className='text-[8px] text-slate-400 block font-medium'>月薪: ¥{Math.round(salRep.salaryTax)} + 奖: ¥{Math.round(salRep.bonusTax)}</Text>
                </View>
                <View className='p-3.5 bg-slate-50 border border-slate-150 rounded-xl text-center'>
                  <Text className='text-[9px] text-slate-500 font-medium block'>方案二：合并所得</Text>
                  <Text className='text-sm font-black text-slate-700 font-mono block'>¥{Math.round(salRep.totalTaxMerged).toLocaleString()}</Text>
                  <Text className='text-[8px] text-slate-400 block font-medium'>阶梯挡位: {salRep.bracketRate}%</Text>
                </View>
              </View>
            </CardContent>
          </Card>

          <View className='p-3.5 bg-amber-50/60 border border-amber-100 text-[10px] text-amber-900 rounded-2xl space-y-1'>
            <Text className='font-extrabold flex items-center gap-1 block'><Icon name='info' size={11} /> 年度汇算清缴加分项：</Text>
            <Text className='leading-relaxed block'>次年3-6月开放汇算。除子女教育、赡养老人、房贷利息外，记得在【个税APP】申报大病医疗和个人养老金账户，获取额外大额返税！</Text>
          </View>
        </View>
      )}

      {/* 劳务稿酬 */}
      {activeTab === 'part_time_labor' && (
        <Card>
          <CardContent className='p-4 space-y-4 text-xs'>
            <Text className='font-bold text-slate-800 block'>劳务与稿酬个税估算</Text>
            <View className='bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-3'>
              <View>
                <Text className='block text-[10px] font-bold text-slate-500 mb-1'>💼 劳务报酬 (副业接单、咨询)</Text>
                <Input type='digit' value={laborAmount} onInput={(e) => setLaborAmount(e.detail.value)} className='w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold' />
                <Text className='text-[9px] text-slate-400 mt-1 block'>适用 20%-40% 比例税率。超4000扣减20%费用。</Text>
              </View>
              <View>
                <Text className='block text-[10px] font-bold text-slate-500 mb-1'>✍️ 稿酬 (写书、自媒体)</Text>
                <Input type='digit' value={royaltyAmount} onInput={(e) => setRoyaltyAmount(e.detail.value)} className='w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold' />
                <Text className='text-[9px] text-slate-400 mt-1 block'>80%计税基础再减30%，相当于5.6折税扣。</Text>
              </View>
            </View>
            <View className='bg-slate-100 p-3.5 rounded-2xl space-y-2 text-[11px] text-slate-700'>
              <View className='flex justify-between'><Text>劳务预缴个税</Text><Text className='font-bold font-mono text-rose-600'>¥{Math.round(laborRep.laborTax).toLocaleString()}</Text></View>
              <View className='flex justify-between'><Text>副业到手净收入</Text><Text className='font-bold font-mono text-emerald-600'>¥{Math.round(laborRep.laborNet).toLocaleString()}</Text></View>
              <View className='flex justify-between pt-1.5 border-t border-slate-200'><Text>稿费纳税额</Text><Text className='font-bold font-mono text-rose-600'>¥{Math.round(laborRep.royaltyTax).toLocaleString()}</Text></View>
              <View className='flex justify-between'><Text>稿酬税后收益</Text><Text className='font-bold font-mono text-slate-800'>¥{Math.round(laborRep.royaltyNet).toLocaleString()}</Text></View>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 期权 */}
      {activeTab === 'options_equity' && (
        <Card>
          <CardContent className='p-4 space-y-4 text-xs'>
            <View>
              <Text className='font-extrabold text-slate-800 block'>期权 (Options) 与股票 (RSU) 个税</Text>
              <Text className='text-[9px] text-slate-400 mt-0.5 block'>股权激励单独适用综合阶梯计税，不与月度工资累加。</Text>
            </View>
            <View className='grid grid-cols-2 gap-2'>
              <View>
                <Text className='block text-[9px] text-slate-500 font-bold mb-1'>🎁 行权市价 (元)</Text>
                <Input type='digit' value={equityValue} onInput={(e) => setEquityValue(e.detail.value)} className='w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold' />
              </View>
              <View>
                <Text className='block text-[9px] text-slate-500 font-bold mb-1'>💸 协议买入价 (元)</Text>
                <Input type='digit' value={grantPrice} onInput={(e) => setGrantPrice(e.detail.value)} className='w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold' />
              </View>
            </View>
            <View className='p-3 bg-indigo-50/50 rounded-xl space-y-2 text-[10px]'>
              <View className='flex justify-between'><Text>期权套现差利</Text><Text className='font-bold font-mono text-slate-800'>¥{Math.round(eqRep.gain).toLocaleString()}</Text></View>
              <View className='flex justify-between'><Text>综合税率档</Text><Text className='bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-extrabold font-mono'>{eqRep.bracketRate}%</Text></View>
              <View className='flex justify-between'><Text>应扣个税</Text><Text className='font-bold font-mono text-red-600'>¥{Math.round(eqRep.tax).toLocaleString()}</Text></View>
              <View className='flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900'><Text>变现实得净值</Text><Text className='text-emerald-600 font-mono'>¥{Math.round(eqRep.netValue).toLocaleString()}</Text></View>
            </View>
          </CardContent>
        </Card>
      )}
    </View>
  );
}
