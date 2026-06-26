import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import { FinanceAppState, reverseNetSalaryToGross } from '@finance/utils/financeState';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import {
  calcEmployeePension as calcEmpPension,
  calcResidentPension as calcResPension,
  calcPersonalPension as calcPerPension,
  PERSONAL_PENSION_TAX_BRACKETS,
  getProvincePensionBase,
} from '@finance/logic/calc/pension';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import './index.css';

/**
 * 跨端养老金页（移植自上游 PensionView）。
 * 改造点：lucide→Icon；div/input/select→View/Input/按钮组；financeState 从 storage 自取。
 * 复用 calcEmployeePension/calcResidentPension/calcPersonalPension + 寿命对比分析。
 */
export default function Pension() {
  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);

  const [activeTab, setActiveTab] = useState<'employee' | 'resident' | 'tax_incentive'>('employee');

  const profile = financeState.profile;
  const initAge = profile?.age?.toString() || '30';
  const initRetire = profile?.retireAge?.toString() || '60';
  const initSalary = profile ? Math.round(reverseNetSalaryToGross(profile.monthlyNetSalary || 12000)).toString() : '12000';
  const initLocal = profile ? String(getProvincePensionBase(profile.city)) : '9307';
  const initYears = profile ? Math.max(15, profile.retireAge - profile.age).toString() : '25';

  const [currentAge, setCurrentAge] = useState(initAge);
  const [retireAge, setRetireAge] = useState(initRetire);
  const [salary, setSalary] = useState(initSalary);
  const [localSalary, setLocalSalary] = useState(initLocal);
  const [years, setYears] = useState(initYears);

  const [parentContrib, setParentContrib] = useState('2000');
  const [parentYears, setParentYears] = useState('15');
  const [residentCity, setResidentCity] = useState('粤');
  const [annualThirdPillar, setAnnualThirdPillar] = useState('12000');

  const calcEmployeePension = () => {
    const retAge = parseInt(retireAge) || 60;
    const baseSpl = parseFloat(salary) || 0;
    const contribYears = parseInt(years) || 15;
    const accumAccount = baseSpl * 0.08 * 12 * contribYears;
    const r = calcEmpPension({
      avgSocialSalary: parseFloat(localSalary) || undefined,
      province: profile?.city,
      personalSalary: baseSpl,
      contributionYears: contribYears,
      personalAccountBalance: accumAccount,
      retireAge: retAge,
    });
    return { basicPension: r.basePension, personalPension: r.accountPension, total: r.monthlyPension, accumAccount };
  };

  const calcResidentPension = () => {
    const annualPay = parseFloat(parentContrib) || 2000;
    const payYears = parseInt(parentYears) || 15;
    const provinceMap: Record<string, string> = { 京: '北京', 沪: '上海', 粤: '广东' };
    const govMap: Record<string, number> = { 京: 150, 沪: 200, 粤: 120 };
    const prov = provinceMap[residentCity] || '';
    const gov = govMap[residentCity] ?? 80;
    const r = calcResPension({ province: prov, annualPayment: annualPay, years: payYears, govSubsidy: gov, interestRate: 0.025, retireAge: 60 });
    return { basePension: Math.round(r.basePension), personalPension: Math.round(r.accountPension), total: Math.round(r.monthlyPension) };
  };

  const calcThirdPillar = () => {
    const rawVal = parseFloat(annualThirdPillar) || 0;
    const s = parseFloat(salary) || 0;
    const annualEstTaxable = Math.max(0, s * 12 - 60000);
    let rate = 0.03;
    for (const b of PERSONAL_PENSION_TAX_BRACKETS) {
      if (annualEstTaxable <= b.upper) { rate = b.rate; break; }
    }
    const contribYears = Math.max(5, (parseInt(retireAge) || 60) - (parseInt(currentAge) || 30));
    const r = calcPerPension({ annualContribution: rawVal, marginalTaxRate: rate, years: contribYears, returnRate: 0.038 });
    return { taxSaved: Math.round(r.annualTaxSaving), bracketRate: Math.round(rate * 100), futureBalance: Math.round(r.accountBalance), yearsOfCompounding: contribYears };
  };

  const empRes = calcEmployeePension();
  const resRes = calcResidentPension();
  const tpRes = calcThirdPillar();

  // 寿命分析
  const averageLifespan = 82;
  const normalRetireAge = parseInt(retireAge) || 60;
  const earlyRetireYearsLimit = Math.max(15, (parseInt(years) || 25) - 5);
  const earlyBasic = ((parseFloat(localSalary) + parseFloat(salary)) / 2) * earlyRetireYearsLimit * 0.01;
  const earlyPersonal = (parseFloat(salary) * 0.08 * 12 * earlyRetireYearsLimit) / 170;
  const earlyTotal = earlyBasic + earlyPersonal;
  const normalMonths = (averageLifespan - normalRetireAge) * 12;
  const earlyMonths = (averageLifespan - (normalRetireAge - 5)) * 12;
  const totalNormalEarnings = empRes.total * normalMonths;
  const totalEarlyEarnings = earlyTotal * earlyMonths;
  const earningsDelta = totalNormalEarnings - totalEarlyEarnings;

  return (
    <View className='p-4 space-y-4 max-w-sm mx-auto w-full text-left min-h-screen bg-slate-50 pb-6'>
      <View className='pb-1 border-b border-slate-100'>
        <Text className='text-base font-black text-slate-900 flex items-center gap-1.5'>
          <Icon name='landmark' size={18} className='text-amber-600' /> 养老金估算
        </Text>
      </View>

      {/* Tab */}
      <View className='flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100 gap-0.5'>
        {[
          { id: 'employee' as const, label: '城镇职工' },
          { id: 'resident' as const, label: '居民(爸妈)' },
          { id: 'tax_incentive' as const, label: '第3支柱' },
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

      {/* 城镇职工 */}
      {activeTab === 'employee' && (
        <View className='space-y-4'>
          <Card>
            <CardContent className='p-4 space-y-3'>
              <View className='grid grid-cols-2 gap-3'>
                <View>
                  <Text className='block text-[9px] font-bold text-slate-500 mb-1'>当前年龄</Text>
                  <Input type='digit' value={currentAge} onInput={(e) => setCurrentAge(e.detail.value)} className='w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold' />
                </View>
                <View>
                  <Text className='block text-[9px] font-bold text-slate-500 mb-1'>退休年龄</Text>
                  <Input type='digit' value={retireAge} onInput={(e) => setRetireAge(e.detail.value)} className='w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold' />
                </View>
              </View>
              <View>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>月缴存基数 (元)</Text>
                <Input type='digit' value={salary} onInput={(e) => setSalary(e.detail.value)} className='w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold' />
              </View>
              <View className='grid grid-cols-2 gap-3'>
                <View>
                  <Text className='block text-[9px] font-bold text-slate-500 mb-1'>本地社平工资</Text>
                  <Input type='digit' value={localSalary} onInput={(e) => setLocalSalary(e.detail.value)} className='w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold' />
                </View>
                <View>
                  <Text className='block text-[9px] font-bold text-slate-500 mb-1'>缴存年数</Text>
                  <Input type='digit' value={years} onInput={(e) => setYears(e.detail.value)} className='w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold' />
                </View>
              </View>
            </CardContent>
          </Card>

          <Card className='bg-emerald-50/40 border border-emerald-100 bg-white'>
            <CardContent className='p-4 space-y-3.5'>
              <View className='flex items-center gap-1.5 text-emerald-800 font-bold text-xs'>
                <Icon name='landmark' size={15} />
                <Text>预计月领退休金</Text>
              </View>
              <View className='text-center bg-white py-3 rounded-2xl border border-dashed border-emerald-200'>
                <Text className='text-[10px] text-slate-400 font-semibold block'>每月养老金 (元/月)</Text>
                <Text className='text-2xl font-black text-emerald-600 font-mono block'>¥{empRes.total.toLocaleString(undefined, { maximumFractionDigits: 1 })}</Text>
              </View>
              <View className='space-y-1.5 text-[10px] text-slate-600 bg-slate-50/50 p-2.5 rounded-xl font-medium'>
                <View className='flex justify-between'><Text>基础养老金(统筹):</Text><Text className='font-bold text-slate-800'>¥{Math.round(empRes.basicPension).toLocaleString()}/月</Text></View>
                <View className='flex justify-between'><Text>个人账户返还:</Text><Text className='font-bold text-slate-800'>¥{Math.round(empRes.personalPension).toLocaleString()}/月</Text></View>
                <View className='flex justify-between pt-1 border-t border-slate-100'><Text>个人账户本息和:</Text><Text className='font-bold text-slate-800 font-mono'>¥{Math.round(empRes.accumAccount).toLocaleString()}</Text></View>
              </View>
            </CardContent>
          </Card>

          {/* 寿命对比 */}
          <Card>
            <CardContent className='p-4 space-y-3 text-xs'>
              <Text className='font-extrabold text-slate-800 flex items-center gap-1 block'>
                <Icon name='scale' size={14} /> 正常 vs 提前退休终身领取
              </Text>
              <Text className='text-[10px] text-slate-400 block'>假定长寿至 <Text className='font-bold'>{averageLifespan}岁</Text>，相比提前5年退休：</Text>
              <View className='p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2'>
                <View className='flex justify-between'><Text>正常退休(领{normalMonths}月):</Text><Text className='font-semibold text-indigo-950 font-mono text-xs'>¥{Math.round(totalNormalEarnings).toLocaleString()}</Text></View>
                <View className='flex justify-between'><Text>提前退休(领{earlyMonths}月):</Text><Text className='font-semibold text-slate-600 font-mono text-xs'>¥{Math.round(totalEarlyEarnings).toLocaleString()}</Text></View>
                <View className='flex justify-between pt-1.5 border-t border-indigo-200 font-bold text-slate-900'><Text>累计少领:</Text><Text className='text-red-600 font-mono text-xs'>-¥{Math.round(Math.abs(earningsDelta)).toLocaleString()}</Text></View>
              </View>
            </CardContent>
          </Card>
        </View>
      )}

      {/* 城乡居民 */}
      {activeTab === 'resident' && (
        <Card>
          <CardContent className='p-4 space-y-3.5'>
            <View>
              <Text className='font-extrabold text-slate-800 text-xs block'>城乡居民养老金（父母辈）</Text>
              <Text className='text-[9px] text-slate-400 mt-0.5 block'>新农保/城乡居民养老金测算。</Text>
            </View>
            <View className='bg-slate-50 p-2.5 rounded-xl border border-slate-150 grid grid-cols-2 gap-2'>
              <View>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>地区</Text>
                <View className='flex gap-1 flex-wrap'>
                  {[
                    { k: '京', l: '北京' }, { k: '沪', l: '上海' }, { k: '粤', l: '广东' }, { k: '中', l: '中西部' },
                  ].map((r) => (
                    <Motion key={r.k} tapScale={0.95} onClick={() => setResidentCity(r.k)} className={`px-2 py-1 text-[10px] font-bold rounded-lg ${residentCity === r.k ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                      {r.l}
                    </Motion>
                  ))}
                </View>
              </View>
              <View>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>年参存 (元/年)</Text>
                <Input type='digit' value={parentContrib} onInput={(e) => setParentContrib(e.detail.value)} className='w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold' />
              </View>
              <View className='col-span-2'>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>累计定投年限</Text>
                <Input type='digit' value={parentYears} onInput={(e) => setParentYears(e.detail.value)} className='w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold' />
              </View>
            </View>
            <View className='bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/60 text-center'>
              <Text className='text-[9px] font-bold text-emerald-800 block'>60岁月领养老金</Text>
              <Text className='text-xl font-black text-emerald-600 font-mono block'>¥{resRes.total}<Text className='text-[10px] font-medium text-slate-400'> 元/月</Text></Text>
              <Text className='text-[8px] text-slate-400 block mt-1'>基础普惠: ¥{resRes.basePension} + 自参滚存: ¥{resRes.personalPension}</Text>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 第3支柱 */}
      {activeTab === 'tax_incentive' && (
        <Card>
          <CardContent className='p-4 space-y-3.5'>
            <View>
              <Text className='font-extrabold text-slate-800 text-xs block'>第3支柱个人养老金（节税理财）</Text>
              <Text className='text-[9px] text-slate-400 mt-0.5 block'>每年最高1.2万申报抵税！</Text>
            </View>
            <View className='bg-slate-50 p-3 rounded-2xl border border-slate-100'>
              <Text className='block text-[10px] text-slate-500 font-bold mb-1'>🛠️ 年缴额度 (上限¥12,000)</Text>
              <Input type='digit' value={annualThirdPillar} onInput={(e) => setAnnualThirdPillar(e.detail.value)} className='w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold' />
            </View>
            <View className='p-3 bg-indigo-50/50 rounded-xl space-y-2 border border-indigo-100/60 font-semibold text-[11px] leading-relaxed'>
              <View className='flex justify-between'><Text>个税阶位:</Text><Text className='font-bold text-indigo-700 font-mono'>{tpRes.bracketRate}% 档</Text></View>
              <View className='flex justify-between'><Text>年减免个税:</Text><Text className='text-red-600 font-mono font-extrabold'>¥{tpRes.taxSaved}</Text></View>
              <View className='flex justify-between pt-1.5 border-t border-indigo-200 text-slate-900 font-bold'>
                <Text>退休滚存({tpRes.yearsOfCompounding}年3.8%):</Text>
                <Text className='text-emerald-600 font-mono font-extrabold'>¥{tpRes.futureBalance.toLocaleString()}</Text>
              </View>
            </View>
          </CardContent>
        </Card>
      )}
    </View>
  );
}
