import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import type { FinanceAppState } from '@finance/utils/financeState';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import './index.css';

/**
 * 跨端理财页（移植自上游 DepositsView）。
 * 改造点：lucide→Icon；div/input→View/Input；financeState 从 storage 自取。
 * 计算逻辑（单利/复利）原样保留，纯前端公式。
 */
export default function Deposits() {
  const [principal, setPrincipal] = useState('100000');
  const [rate, setRate] = useState('3.5');
  const [years, setYears] = useState('1');

  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);
  const savedSavings = financeState.savings || [];

  const calculate = () => {
    const p = parseFloat(principal) || 0;
    const r = (parseFloat(rate) || 0) / 100;
    const y = parseFloat(years) || 0;
    return {
      simpleInterest: p * r * y,
      compoundInterest: p * Math.pow(1 + r, y) - p,
    };
  };

  const res = calculate();

  return (
    <View className='p-4 max-w-sm mx-auto space-y-4 pb-6 text-slate-800 min-h-screen bg-slate-50'>
      <View className='pb-1 border-b border-slate-100'>
        <Text className='text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5'>
          <Icon name='banknote' size={18} className='text-emerald-500' />
          理财与存款复利计算
        </Text>
        <Text className='text-[10px] text-slate-400 font-semibold uppercase tracking-wider block'>
          实体联动分析器 · 验证单复利复权回报
        </Text>
      </View>

      {/* 已登记理财快捷填入 */}
      {savedSavings.length > 0 && (
        <Card className='border border-emerald-100 bg-emerald-50/15 overflow-hidden'>
          <CardContent className='p-3 space-y-2'>
            <Text className='text-[9px] font-black text-emerald-800 flex items-center gap-1 uppercase tracking-wider block'>
              <Icon name='info' size={10} className='text-emerald-600' />
              我的已登记理财 (点击快捷填入)
            </Text>
            <View className='flex flex-wrap gap-1'>
              {savedSavings.map((save) => (
                <Motion
                  key={save.id}
                  tapScale={0.95}
                  onClick={() => {
                    setPrincipal(save.amount.toString());
                    setRate(save.annualRate.toString());
                  }}
                  className='px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 flex items-center gap-1'
                >
                  <Icon name='sparkles' size={8} className='text-emerald-500' />
                  <Text>{save.name} (¥{(save.amount / 1000).toFixed(0)}k @ {save.annualRate}%)</Text>
                </Motion>
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      <Card className='border border-slate-200/80'>
        <CardContent className='p-4 space-y-4'>
          <View className='space-y-3.5'>
            <View>
              <Text className='block text-[10px] font-extrabold text-slate-500 mb-1'>测算本金金额 (元)</Text>
              <View className='relative'>
                <Input
                  type='digit'
                  value={principal}
                  onInput={(e) => setPrincipal(e.detail.value)}
                  className='w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800'
                />
              </View>
            </View>
            <View>
              <Text className='block text-[10px] font-extrabold text-slate-500 mb-1'>测算预期年化收益率 (%)</Text>
              <Input
                type='digit'
                value={rate}
                onInput={(e) => setRate(e.detail.value)}
                className='w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800'
              />
            </View>
            <View>
              <Text className='block text-[10px] font-extrabold text-slate-500 mb-1'>测算定存投资期限 (年)</Text>
              <Input
                type='digit'
                value={years}
                onInput={(e) => setYears(e.detail.value)}
                className='w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800'
              />
            </View>
          </View>

          <View className='p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col gap-3'>
            <Text className='text-xs font-black text-slate-800 flex items-center gap-1.5'>
              <Icon name='banknote' size={16} className='text-emerald-500' /> 预估到期收益分析
            </Text>
            <View className='grid grid-cols-2 gap-2 text-center'>
              <View className='p-2.5 bg-white rounded-xl border border-emerald-100/50'>
                <Text className='text-[8px] text-slate-400 font-extrabold mb-1 block'>单利模式 (定期存款)</Text>
                <Text className='text-sm font-black text-emerald-600 font-mono block'>
                  ¥{res.simpleInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text className='text-[7.5px] text-slate-400 font-bold mt-1.5 bg-slate-50 px-1 py-0.5 rounded block'>
                  到期: ¥{Math.round(parseFloat(principal) + res.simpleInterest).toLocaleString()}
                </Text>
              </View>
              <View className='p-2.5 bg-white rounded-xl border border-emerald-100/50'>
                <Text className='text-[8px] text-slate-400 font-extrabold mb-1 block'>复利模式 (理财滚投)</Text>
                <Text className='text-sm font-black text-emerald-700 font-mono block'>
                  ¥{res.compoundInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text className='text-[7.5px] text-slate-400 font-bold mt-1.5 bg-slate-50 px-1 py-0.5 rounded block'>
                  到期: ¥{Math.round(parseFloat(principal) + res.compoundInterest).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      <Text className='text-[8.5px] font-medium text-slate-400 leading-normal bg-slate-50 p-2.5 rounded-xl border border-slate-200/50 block'>
        📌 资产估值提示：实际存款及理财产品的计息、付息时间点存在细微差异，结果仅作为预测决策参考。
      </Text>
    </View>
  );
}
