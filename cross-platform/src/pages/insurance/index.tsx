import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import type { FinanceAppState } from '@finance/utils/financeState';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import { getCityRates, getCities, reverseBaseFromDeduction } from '@finance/logic/calc/social';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import './index.css';

/**
 * 跨端社保页（移植自上游 InsuranceView）。
 * 改造点：lucide→Icon；div/input/select/button→View/Input/按钮组/Motion；financeState 从 storage 自取。
 * 复用 getCityRates/getCities/reverseBaseFromDeduction（23城真实比例）。
 */

function buildCityParam(city: string) {
  const r = getCityRates(city);
  return {
    pensionP: r.pension.personal, pensionC: r.pension.company,
    medicalP: r.medical.personal, medicalC: r.medical.company,
    housingP: r.housingFund.personal, housingC: r.housingFund.company,
    workInjuryC: r.workInjury.company,
    medThreshold: 1000, medRate: 0.75,
  };
}

export default function Insurance() {
  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);

  const [activeSubTab, setActiveSubTab] = useState<'calculator' | 'balance' | 'medical'>('calculator');
  const [selectedCity, setSelectedCity] = useState<string>(financeState.profile?.city || '深圳');
  const [calcMode, setCalcMode] = useState<'base' | 'deduct'>('deduct');
  const [inputValue, setInputValue] = useState<string>(
    (financeState.profile?.socialInsuranceSelf?.toString()) || '2400',
  );
  const [workingYears, setWorkingYears] = useState('6');
  const [currentBase, setCurrentBase] = useState('15000');
  const [medicalBill, setMedicalBill] = useState('4500');
  const [showCityPicker, setShowCityPicker] = useState(false);

  const baseValue =
    calcMode === 'deduct'
      ? reverseBaseFromDeduction(selectedCity, parseFloat(inputValue) || 0).base
      : parseFloat(inputValue) || 0;

  const param = buildCityParam(selectedCity);
  const pPension = baseValue * param.pensionP;
  const pMedical = baseValue * param.medicalP;
  const pHousing = baseValue * param.housingP;
  const pTotal = pPension + pMedical + pHousing;
  const cPension = baseValue * param.pensionC;
  const cMedical = baseValue * param.medicalC;
  const cHousing = baseValue * param.housingC;
  const cTotal = cPension + cMedical + cHousing + baseValue * param.workInjuryC;

  const calcBalances = () => {
    const years = parseFloat(workingYears) || 0;
    const base = parseFloat(currentBase) || 12000;
    const accumHousing = 2 * base * param.housingP * 12 * years;
    const accumPension = base * 0.08 * 12 * years;
    return {
      housingBalance: Math.round(accumHousing * 1.12),
      pensionBalance: Math.round(accumPension * 1.12),
    };
  };
  const balances = calcBalances();

  const calcMedicalClaim = () => {
    const bill = parseFloat(medicalBill) || 0;
    const claimAmount = bill > param.medThreshold ? (bill - param.medThreshold) * param.medRate : 0;
    return { claimAmount: Math.round(claimAmount), selfPay: Math.round(bill - claimAmount) };
  };
  const medRep = calcMedicalClaim();

  return (
    <View className='p-4 space-y-4 max-w-sm mx-auto w-full text-left min-h-screen bg-slate-50 pb-6'>
      <View className='pb-1 border-b border-slate-100'>
        <Text className='text-base font-black text-slate-900 flex items-center gap-1.5'>
          <Icon name='briefcaseMedical' size={18} className='text-emerald-600' /> 五险一金精算
        </Text>
      </View>

      {/* 子 Tab */}
      <View className='flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100 gap-0.5'>
        {[
          { id: 'calculator' as const, label: '比例测算' },
          { id: 'balance' as const, label: '余额估算' },
          { id: 'medical' as const, label: '医保报销' },
        ].map((t) => (
          <Motion
            key={t.id}
            tapScale={0.95}
            onClick={() => setActiveSubTab(t.id)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl text-center ${activeSubTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {t.label}
          </Motion>
        ))}
      </View>

      {/* 比例测算 */}
      {activeSubTab === 'calculator' && (
        <Card>
          <CardContent className='p-4 space-y-3.5'>
            {/* 城市选择 */}
            <View className='flex justify-between items-center bg-slate-50 p-2.5 rounded-2xl border border-slate-100'>
              <View className='flex items-center gap-1.5 text-xs font-bold text-slate-700'>
                <Icon name='info' size={14} className='text-emerald-600' />
                <Text>城市</Text>
              </View>
              <Motion
                tapScale={0.95}
                onClick={() => setShowCityPicker(!showCityPicker)}
                className='bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800'
              >
                {selectedCity} ▾
              </Motion>
            </View>
            {showCityPicker && (
              <View className='flex flex-wrap gap-1 bg-slate-50 p-2 rounded-xl'>
                {getCities().map((c) => (
                  <Motion
                    key={c}
                    tapScale={0.95}
                    onClick={() => {
                      setSelectedCity(c);
                      setShowCityPicker(false);
                    }}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg ${selectedCity === c ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                  >
                    {c}
                  </Motion>
                ))}
              </View>
            )}

            {/* 模式切换 */}
            <View className='flex justify-between items-center'>
              <Text className='text-xs font-bold text-slate-800'>计算口径</Text>
              <Motion
                tapScale={0.95}
                onClick={() => setCalcMode((p) => (p === 'base' ? 'deduct' : 'base'))}
                className='text-[9px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg'
              >
                切换: {calcMode === 'deduct' ? '填基数' : '扣款倒推'}
              </Motion>
            </View>

            <View className='bg-slate-50 p-3 rounded-2xl border border-slate-100'>
              <Text className='block text-[10px] font-bold text-slate-500 mb-1'>
                {calcMode === 'deduct' ? '🛡️ 每月扣减五险一金合计 (元)' : '💼 每月申报基数 (元)'}
              </Text>
              <Input
                type='digit'
                value={inputValue}
                onInput={(e) => setInputValue(e.detail.value)}
                className='w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold'
              />
            </View>

            <View className='p-3 bg-slate-100/50 rounded-xl border border-slate-100 text-center'>
              <Text className='text-[9px] text-slate-400 font-bold uppercase tracking-wider block'>反推申报基数</Text>
              <Text className='text-lg font-black text-slate-800 font-mono block'>¥{Math.round(baseValue).toLocaleString()}</Text>
            </View>

            {/* 双方明细 */}
            <View className='grid grid-cols-2 gap-2.5'>
              <View className='bg-rose-50/20 p-2.5 border border-rose-100/40 rounded-xl'>
                <Text className='text-[10px] font-extrabold text-red-700 block'>👤 员工 (合计 ¥{Math.round(pTotal)})</Text>
                <View className='space-y-1 text-[9px] text-slate-600 font-mono mt-1'>
                  <View className='flex justify-between'><Text>养老(8%)</Text><Text>¥{Math.round(pPension)}</Text></View>
                  <View className='flex justify-between'><Text>医疗(2%)</Text><Text>¥{Math.round(pMedical)}</Text></View>
                  <View className='flex justify-between'><Text>公积({(param.housingP * 100).toFixed(0)}%)</Text><Text>¥{Math.round(pHousing)}</Text></View>
                </View>
              </View>
              <View className='bg-blue-50/20 p-2.5 border border-blue-100/40 rounded-xl'>
                <Text className='text-[10px] font-extrabold text-blue-700 block'>🏢 企业 (合计 ¥{Math.round(cTotal)})</Text>
                <View className='space-y-1 text-[9px] text-slate-600 font-mono mt-1'>
                  <View className='flex justify-between'><Text>养老({(param.pensionC * 100).toFixed(0)}%)</Text><Text>¥{Math.round(cPension)}</Text></View>
                  <View className='flex justify-between'><Text>医疗({(param.medicalC * 100).toFixed(1)}%)</Text><Text>¥{Math.round(cMedical)}</Text></View>
                  <View className='flex justify-between'><Text>公积({(param.housingC * 100).toFixed(0)}%)</Text><Text>¥{Math.round(cHousing)}</Text></View>
                </View>
              </View>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 余额估算 */}
      {activeSubTab === 'balance' && (
        <Card>
          <CardContent className='p-4 space-y-3.5 text-xs'>
            <View>
              <Text className='font-extrabold text-slate-800 text-xs flex items-center gap-1.5'>
                <Icon name='landmark' size={15} className='text-emerald-600' /> 公积金与养老金账户滚存
              </Text>
              <Text className='text-[9px] text-slate-400 mt-0.5 block'>评估国家统筹内已积累的隐性资产。</Text>
            </View>
            <View className='grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl'>
              <View>
                <Text className='block text-[9px] text-slate-500 font-bold mb-1'>工龄 (年)</Text>
                <Input type='digit' value={workingYears} onInput={(e) => setWorkingYears(e.detail.value)} className='w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold' />
              </View>
              <View>
                <Text className='block text-[9px] text-slate-500 font-bold mb-1'>缴费基数 (元/月)</Text>
                <Input type='digit' value={currentBase} onInput={(e) => setCurrentBase(e.detail.value)} className='w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold' />
              </View>
            </View>
            <View className='grid grid-cols-2 gap-2'>
              <View className='p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50'>
                <Text className='text-[9px] font-bold text-indigo-600 block'>住房公积金</Text>
                <Text className='text-sm font-black font-mono text-indigo-950 block'>¥{balances.housingBalance.toLocaleString()}</Text>
                <Text className='text-[8px] text-slate-400 block'>双边缴存</Text>
              </View>
              <View className='p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50'>
                <Text className='text-[9px] font-bold text-emerald-600 block'>养老个人账户</Text>
                <Text className='text-sm font-black font-mono text-emerald-950 block'>¥{balances.pensionBalance.toLocaleString()}</Text>
                <Text className='text-[8px] text-slate-400 block'>随利息滚存</Text>
              </View>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 医保报销 */}
      {activeSubTab === 'medical' && (
        <Card>
          <CardContent className='p-4 space-y-3.5 text-xs'>
            <View>
              <Text className='font-extrabold text-slate-800 text-xs flex items-center gap-1.5'>
                <Icon name='info' size={15} className='text-rose-600' /> 医保报销模拟
              </Text>
              <Text className='text-[9px] text-slate-400 mt-0.5 block'>输入医疗费用，核算报销金额。</Text>
            </View>
            <View className='bg-slate-50 p-3 rounded-2xl border border-slate-150'>
              <Text className='block text-[10px] text-slate-500 font-bold mb-1'>🏥 门诊/住院总费用 (元)</Text>
              <Input type='digit' value={medicalBill} onInput={(e) => setMedicalBill(e.detail.value)} className='w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold' />
              <View className='grid grid-cols-2 gap-2 text-[10px] text-slate-500 mt-2'>
                <View><Text>{selectedCity}起付线:</Text><Text className='text-slate-800 font-bold block'>¥{param.medThreshold}/年</Text></View>
                <View><Text>报销比例:</Text><Text className='text-slate-800 font-bold block'>{(param.medRate * 100).toFixed(0)}%</Text></View>
              </View>
            </View>
            <View className='p-3 bg-rose-50/50 border border-rose-100 rounded-xl space-y-1.5'>
              <View className='flex justify-between'>
                <Text className='text-[10px] font-bold text-slate-600'>🏥 统筹报销:</Text>
                <Text className='font-mono text-emerald-600 font-extrabold'>¥{medRep.claimAmount.toLocaleString()}</Text>
              </View>
              <View className='flex justify-between pt-1 border-t border-rose-100/60 text-slate-800 font-bold'>
                <Text>个人自付:</Text>
                <Text className='font-mono text-rose-600'>¥{medRep.selfPay.toLocaleString()}</Text>
              </View>
            </View>
          </CardContent>
        </Card>
      )}

      <View className='p-3 bg-indigo-50/40 border border-indigo-100 text-[10px] text-slate-500 rounded-2xl flex gap-1.5 items-start'>
        <Icon name='shield' size={14} className='text-indigo-600 shrink-0 mt-0.5' />
        <View>
          <Text className='font-bold text-slate-800 block'>保障与档案核验</Text>
          <Text className='leading-relaxed block'>基数参数已与养老金预测、个税算费跨页联通，方便全景演算。</Text>
        </View>
      </View>
    </View>
  );
}
