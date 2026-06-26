import { useState, useMemo } from 'react';
import { View, Text, Input, Slider } from '@tarojs/components';
import type { FinanceAppState } from '@finance/utils/financeState';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import { compareLoanMethods, simulatePrepayment } from '@finance/logic/calc/loan';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import './index.css';

/**
 * 跨端房贷页（移植自上游 LoanView）。
 * 改造点：
 * - <input type="range"> → Taro <Slider>
 * - lucide→Icon；div/input/span→View/Input/Text；button→View
 * - financeState 从 storage 自取（useEffect 带入房产档案改为初始化时带入）
 * - 复用 compareLoanMethods / simulatePrepayment（纯函数）
 */

function fmt(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

export default function Loan() {
  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);

  // 从房产档案带入贷款参数
  const prop = financeState.property;
  const initPrincipal = prop && prop.loanBalance > 0
    ? String(Math.round(prop.loanBalance + (prop.remainingTerms ? prop.monthlyPayment * 6 : 0)))
    : '1000000';
  const initRate = prop ? String(prop.loanRate || 4.1) : '4.1';
  const initYears = prop?.totalLoanTerms ? String(Math.round(prop.totalLoanTerms / 12)) : '30';
  const initPaid = prop?.remainingTerms && prop?.totalLoanTerms
    ? String(Math.round(prop.totalLoanTerms - prop.remainingTerms))
    : '60';

  const [principal, setPrincipal] = useState(initPrincipal);
  const [years, setYears] = useState(initYears);
  const [rate, setRate] = useState(initRate);
  const [paidMonths, setPaidMonths] = useState(initPaid);
  const [prepayAmount, setPrepayAmount] = useState('100000');

  const P = parseFloat(principal) || 0;
  const Y = parseFloat(years) || 0;
  const R = parseFloat(rate) || 0;
  const paidM = Math.min(parseInt(paidMonths) || 0, Math.round(Y * 12));
  const prepay = Math.min(parseFloat(prepayAmount) || 0, P);

  const compare = useMemo(
    () => (P > 0 && Y > 0 ? compareLoanMethods(P, Y, R) : null),
    [P, Y, R],
  );
  const prepayResult = useMemo(
    () =>
      P > 0 && Y > 0 && prepay > 0
        ? simulatePrepayment({ principal: P, years: Y, annualRatePct: R, paidMonths: paidM, prepayAmount: prepay })
        : null,
    [P, Y, R, paidM, prepay],
  );

  return (
    <View className='p-4 space-y-4 pb-6 min-h-screen bg-slate-50 max-w-md mx-auto w-full'>
      {/* 贷款参数 */}
      <Card>
        <CardContent className='p-4 space-y-3'>
          <View className='flex items-center gap-1.5 text-xs font-bold text-slate-500'>
            <Icon name='home' size={13} /> 贷款参数
            {prop && (
              <Text className='ml-auto text-[10px] text-indigo-500 font-semibold'>已从房产档案带入</Text>
            )}
          </View>
          <View className='grid grid-cols-2 gap-2'>
            <Field label='贷款本金' value={principal} onChange={setPrincipal} suffix='元' />
            <Field label='贷款年限' value={years} onChange={setYears} suffix='年' />
            <Field label='年利率' value={rate} onChange={setRate} suffix='%' />
            <Field label='已还月数' value={paidMonths} onChange={setPaidMonths} suffix='月' />
          </View>
        </CardContent>
      </Card>

      {/* 还款方式对比 */}
      {compare && (
        <Card>
          <CardContent className='p-4 space-y-3'>
            <View className='flex items-center gap-1.5 text-xs font-bold text-slate-500'>
              <Icon name='scale' size={13} /> 还款方式对比
            </View>
            <View className='grid grid-cols-2 gap-2'>
              <MethodCard
                title='等额本息'
                highlight={`月供 ${fmt(compare.equalPayment.monthly)}`}
                rows={[
                  ['总利息', fmt(compare.equalPayment.interest)],
                  ['总还款', fmt(compare.equalPayment.total)],
                ]}
                color='blue'
              />
              <MethodCard
                title='等额本金'
                highlight={`首月 ${fmt(compare.equalPrincipal.firstMonth)}`}
                rows={[
                  ['总利息', fmt(compare.equalPrincipal.interest)],
                  ['末月', fmt(compare.equalPrincipal.lastMonth)],
                ]}
                color='emerald'
              />
            </View>
            {compare.interestDiff > 0 && (
              <View className='bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-[11px] text-amber-700 font-semibold'>
                💡 等额本息比等额本金多付利息 <Text className='font-bold'>{fmt(compare.interestDiff)}</Text>，
                但月供固定、前期压力小；等额本金总利息少但前期月供高。
              </View>
            )}
          </CardContent>
        </Card>
      )}

      {/* 提前还贷模拟器 */}
      <Card className='border-indigo-100'>
        <CardContent className='p-4 space-y-4'>
          <View className='flex items-center gap-1.5 text-xs font-bold text-indigo-600'>
            <Icon name='sparkles' size={13} /> 提前还贷模拟器
          </View>

          <View>
            <View className='flex items-center justify-between mb-1.5'>
              <Text className='text-xs font-semibold text-slate-600'>一次性提前还款</Text>
              <Text className='text-lg font-black text-indigo-600 font-mono'>{fmt(prepay)}</Text>
            </View>
            <Slider
              min={0}
              max={Math.round(P * 0.5)}
              step={10000}
              value={prepay}
              onChanging={(e) => setPrepayAmount(String(e.detail.value))}
              activeColor='#6366f1'
              blockColor='#6366f1'
              blockSize={20}
            />
            <View className='flex justify-between text-[10px] text-slate-400 mt-1'>
              <Text>0</Text>
              <Text>¥{(P * 0.5 / 10000).toFixed(0)}万（滑动调整）</Text>
            </View>
            <Input
              type='digit'
              value={prepayAmount}
              onInput={(e) => setPrepayAmount(e.detail.value)}
              className='w-full mt-2 px-3 py-1.5 bg-slate-50 rounded-lg text-sm font-mono text-slate-700'
              placeholder='输入提前还款金额'
            />
          </View>

          {prepayResult ? (
            <>
              <View className='bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-500 flex items-center justify-between'>
                <Text>已还 {paidM} 月，剩余本金</Text>
                <Text className='font-mono font-bold text-slate-700'>
                  {fmt(prepayResult.balanceAfterPrepay + prepay)}
                </Text>
              </View>

              <View className='space-y-2'>
                <SchemeCard
                  title='方案一：缩短年限'
                  subtitle='月供不变，提前还清'
                  icon='clock'
                  color='rose'
                  savedInterest={prepayResult.shortenTerm.savedInterest}
                  badge={prepayResult.shortenTerm.savedMonths > 0 ? `省 ${prepayResult.shortenTerm.savedMonths} 个月` : ''}
                  rows={[
                    ['月供（不变）', fmt(prepayResult.shortenTerm.monthlyPayment)],
                    ['剩余期数', `${prepayResult.shortenTerm.remainingMonths} 月`],
                    ['剩余总利息', fmt(prepayResult.shortenTerm.remainingInterest)],
                  ]}
                  recommended={prepayResult.recommendation === 'shortenTerm'}
                />
                <SchemeCard
                  title='方案二：减少月供'
                  subtitle='年限不变，月供降低'
                  icon='wallet'
                  color='blue'
                  savedInterest={prepayResult.reducePayment.savedInterest}
                  rows={[
                    ['月供（降低）', fmt(prepayResult.reducePayment.monthlyPayment)],
                    ['每月少还', fmt(prepayResult.baseline.monthlyPayment - prepayResult.reducePayment.monthlyPayment)],
                    ['剩余总利息', fmt(prepayResult.reducePayment.remainingInterest)],
                  ]}
                  recommended={prepayResult.recommendation === 'reducePayment'}
                />
              </View>

              <View className='flex items-center justify-between text-[11px] text-slate-400 px-1'>
                <Text>若不提前还款</Text>
                <Text>剩余利息 {fmt(prepayResult.baseline.remainingInterest)} / {prepayResult.baseline.remainingMonths}月</Text>
              </View>

              <View className='bg-indigo-50 rounded-xl p-3 text-[11px] text-indigo-800 leading-relaxed'>
                <View className='flex items-start gap-1.5'>
                  <Icon name='info' size={13} className='mt-0.5 shrink-0' />
                  <Text>
                    提前还款 <Text className='font-bold'>{fmt(prepay)}</Text>，选择
                    <Text className='font-bold'>{prepayResult.recommendation === 'shortenTerm' ? '缩短年限' : '减少月供'}</Text>
                    可省利息 <Text className='font-bold text-rose-600'>{fmt(prepayResult[prepayResult.recommendation].savedInterest)}</Text>。
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View className='text-xs text-slate-400 text-center py-4'>
              <Text>输入提前还款金额查看省利息方案</Text>
            </View>
          )}
        </CardContent>
      </Card>
    </View>
  );
}

/* ───────────── 子组件 ───────────── */

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <View>
      <Text className='text-[10px] font-bold text-slate-400 block mb-1'>{label}</Text>
      <View className='flex items-center bg-slate-50 rounded-lg px-2.5 py-1.5'>
        <Input
          type='digit'
          value={value}
          onInput={(e) => onChange(e.detail.value)}
          className='flex-1 bg-transparent text-sm font-mono font-bold text-slate-700'
        />
        {suffix && <Text className='text-[10px] text-slate-400 ml-1 shrink-0'>{suffix}</Text>}
      </View>
    </View>
  );
}

function MethodCard({
  title,
  highlight,
  rows,
  color,
}: {
  title: string;
  highlight: string;
  rows: [string, string][];
  color: 'blue' | 'emerald';
}) {
  const accent = color === 'blue' ? 'text-blue-600' : 'text-emerald-600';
  const bg = color === 'blue' ? 'bg-blue-50' : 'bg-emerald-50';
  return (
    <View className={`${bg} rounded-xl p-3`}>
      <Text className='text-xs font-bold text-slate-600 mb-0.5 block'>{title}</Text>
      <Text className={`text-sm font-black font-mono ${accent} mb-2 block`}>{highlight}</Text>
      {rows.map(([k, v]) => (
        <View key={k} className='flex items-center justify-between text-[10px] text-slate-500'>
          <Text>{k}</Text>
          <Text className='font-mono font-bold text-slate-700'>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function SchemeCard({
  title,
  subtitle,
  icon,
  color,
  savedInterest,
  badge,
  rows,
  recommended,
}: {
  title: string;
  subtitle: string;
  icon: string;
  color: 'rose' | 'blue';
  savedInterest: number;
  badge?: string;
  rows: [string, string][];
  recommended?: boolean;
}) {
  const accent = color === 'rose' ? 'text-rose-600 bg-rose-50' : 'text-blue-600 bg-blue-50';
  return (
    <View className={`rounded-2xl p-3 border ${recommended ? 'border-indigo-200 bg-white' : 'border-slate-100 bg-white'}`}>
      <View className='flex items-start justify-between mb-2'>
        <View className='flex items-center gap-1.5'>
          <View className={`w-7 h-7 rounded-lg ${accent} flex items-center justify-center`}>
            <Icon name={icon} size={14} />
          </View>
          <View>
            <Text className='text-xs font-bold text-slate-800 flex items-center gap-1'>
              {title}
              {recommended && (
                <Text className='text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full'>推荐</Text>
              )}
            </Text>
            <Text className='text-[10px] text-slate-400 block'>{subtitle}</Text>
          </View>
        </View>
        {badge && (
          <View className='text-right'>
            <Text className='text-[9px] text-slate-400 block'>提前还清</Text>
            <Text className='text-[11px] font-bold text-rose-600 block'>{badge}</Text>
          </View>
        )}
      </View>
      <View className='flex items-center justify-between bg-emerald-50 rounded-lg px-2.5 py-1.5 mb-2'>
        <Text className='text-[10px] text-emerald-700 font-semibold flex items-center gap-1'>
          <Icon name='coins' size={11} /> 节省利息
        </Text>
        <Text className='text-sm font-black text-emerald-600 font-mono'>{fmt(savedInterest)}</Text>
      </View>
      <View className='space-y-1'>
        {rows.map(([k, v]) => (
          <View key={k} className='flex items-center justify-between text-[11px]'>
            <Text className='text-slate-400'>{k}</Text>
            <Text className='font-mono font-bold text-slate-700'>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
