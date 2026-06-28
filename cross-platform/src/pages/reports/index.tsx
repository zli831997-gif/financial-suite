import { useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import type { FinanceAppState } from '@finance/utils/financeState';
import type { Transaction } from '@finance/types';
import {
  buildBalanceSheet,
  type BalanceSheetGroup,
} from '@finance/logic/calc/netAssets';
import {
  buildIncomeStatement,
  buildCashFlowStatement,
  buildMonthlyTrend,
  listMonthPeriods,
  type CashFlowActivity,
  type IncomeStatement,
} from '@finance/logic/calc/report';
import { getRecords, ensureRecords } from '@finance/logic/domain/records';
import { getAccounts, ensureAccounts } from '@finance/logic/domain/accounts';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import { MiniTrend } from '../../components/MiniChart';
import { EChart } from '../../components/EChart';
import './index.css';

/**
 * 跨端报表页（移植自上游 ReportsView）。
 * 改造点：
 * - 数据从 domain 层自取（上游从 props 拿）
 * - recharts BarChart/LineChart → 横向柱条 + MiniTrend（纯 View，跨端稳定）
 * - div/span/h3 → View/Text；button → Motion；lucide → Icon
 * - 复用 buildBalanceSheet / buildIncomeStatement / buildCashFlowStatement / buildMonthlyTrend
 */

type Tab = 'balance' | 'income' | 'cashflow';

const ACTIVITY_LABEL: Record<CashFlowActivity, string> = {
  operating: '经营活动',
  investing: '投资活动',
  financing: '筹资活动',
};
const ACTIVITY_COLOR: Record<CashFlowActivity, string> = {
  operating: '#3b82f6',
  investing: '#10b981',
  financing: '#f59e0b',
};

function fmt(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}
function fmtPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function fmtWan(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${Math.round(n)}`;
}

export default function Reports() {
  ensureAccounts();
  ensureRecords();

  const [tab, setTab] = useState<Tab>('balance');

  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);
  const transactions: Transaction[] = getRecords();
  // 净资产需要账户净余额，传 accounts 给 buildBalanceSheet 汇总
  const accounts = getAccounts();

  const monthPeriods = useMemo(() => listMonthPeriods(transactions), [transactions]);
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return monthPeriods.includes(ym) ? ym : monthPeriods[0] || ym;
  });

  const balance = useMemo(
    () => buildBalanceSheet(financeState, accounts),
    [financeState, accounts],
  );
  const income = useMemo(() => buildIncomeStatement(transactions, period), [transactions, period]);
  const cashflow = useMemo(() => buildCashFlowStatement(transactions, period), [transactions, period]);
  const trend = useMemo(() => buildMonthlyTrend(transactions, 6), [transactions]);

  return (
    <View className='p-4 space-y-4 pb-6 min-h-screen bg-slate-50 max-w-md mx-auto w-full'>
      {/* Tab 切换 */}
      <View className='grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl'>
        {(
          [
            { id: 'balance' as Tab, label: '资产负债', icon: 'scale' },
            { id: 'income' as Tab, label: '利润', icon: 'trendingUp' },
            { id: 'cashflow' as Tab, label: '现金流', icon: 'coins' },
          ]
        ).map(({ id, label, icon }) => (
          <Motion
            key={id}
            tapScale={0.95}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold ${tab === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            <Icon name={icon} size={13} />
            {label}
          </Motion>
        ))}
      </View>

      {tab === 'balance' && <BalanceSheetView bs={balance} />}
      {tab === 'income' && (
        <IncomeView income={income} period={period} periods={monthPeriods} onPeriod={setPeriod} />
      )}
      {tab === 'cashflow' && (
        <CashFlowView
          cashflow={cashflow}
          trend={trend}
          period={period}
          periods={monthPeriods}
          onPeriod={setPeriod}
        />
      )}
    </View>
  );
}

/* ───────────── 资产负债表 ───────────── */

function BalanceGroup({ group, positive }: { group: BalanceSheetGroup; positive: boolean }) {
  if (group.items.length === 0) return null;
  return (
    <View>
      <View className='flex items-center justify-between px-1 mb-1.5'>
        <Text className='text-xs font-bold text-slate-500'>{group.label}</Text>
        <Text className={`text-xs font-black font-mono ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {fmt(group.subtotal)}
        </Text>
      </View>
      <View className='bg-white rounded-2xl overflow-hidden'>
        {group.items.map((it, idx) => (
          <View
            key={it.name}
            className={`flex items-center justify-between px-3 py-2.5 ${idx > 0 ? 'border-t border-slate-50' : ''}`}
          >
            <View className='min-w-0'>
              <Text className='text-sm font-semibold text-slate-800 block'>{it.name}</Text>
              {it.detail && <Text className='text-[10px] text-slate-400 mt-0.5 block'>{it.detail}</Text>}
            </View>
            <Text className='text-sm font-bold font-mono text-slate-700 shrink-0 ml-2'>
              {fmt(it.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BalanceSheetView({ bs }: { bs: ReturnType<typeof buildBalanceSheet> }) {
  const barData = [
    { name: '流动资产', value: bs.currentAssets.subtotal, color: '#3b82f6' },
    { name: '非流动资产', value: bs.nonCurrentAssets.subtotal, color: '#6366f1' },
  ].filter((d) => d.value > 0);
  const maxV = Math.max(...barData.map((d) => d.value), 1);

  return (
    <View className='space-y-3'>
      {/* 净资产大卡片 */}
      <Card className='bg-gradient-to-br from-indigo-600 to-blue-600 border-0 text-white'>
        <CardContent className='p-5 pt-5'>
          <View className='flex items-center gap-1.5 text-indigo-100 text-xs font-bold mb-1'>
            <Icon name='wallet' size={13} /> 净资产（所有者权益）
          </View>
          <Text className='text-3xl font-black font-mono tracking-tight block'>{fmt(bs.netAssets)}</Text>
          <View className='flex items-center gap-4 mt-3 text-[11px]'>
            <View>
              <Text className='text-indigo-200'>总资产 </Text>
              <Text className='font-bold font-mono'>{fmt(bs.totalAssets)}</Text>
            </View>
            <View>
              <Text className='text-indigo-200'>总负债 </Text>
              <Text className='font-bold font-mono'>{fmt(bs.totalLiabilities)}</Text>
            </View>
            <View className='ml-auto bg-white/15 rounded-full px-2 py-0.5 font-bold'>
              <Text>负债率 {fmtPercent(bs.debtRatio)}</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 资产流动性分布（横向柱条，替代 recharts BarChart） */}
      {barData.length > 0 && (
        <Card>
          <CardContent className='p-4'>
            <Text className='text-xs font-bold text-slate-500 mb-2 block'>资产流动性分布</Text>
            {barData.map((d) => (
              <View key={d.name} className='mb-2'>
                <View className='flex justify-between mb-1'>
                  <Text className='text-[11px] text-slate-600 font-semibold'>{d.name}</Text>
                  <Text className='text-[11px] font-mono text-slate-700 font-bold'>{fmt(d.value)}</Text>
                </View>
                <View className='h-3 bg-slate-100 rounded-full overflow-hidden'>
                  <View
                    style={{ width: `${(d.value / maxV) * 100}%`, background: d.color, height: '100%' }}
                    className='rounded-full'
                  />
                </View>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      <BalanceGroup group={bs.currentAssets} positive />
      <BalanceGroup group={bs.nonCurrentAssets} positive />
      <BalanceGroup group={bs.currentLiabilities} positive={false} />
      <BalanceGroup group={bs.nonCurrentLiabilities} positive={false} />

      <Text className='text-[10px] text-slate-400 text-center px-4 leading-relaxed block'>
        会计恒等式：资产 ¥{bs.totalAssets.toLocaleString()} − 负债 ¥{bs.totalLiabilities.toLocaleString()} = 净资产 ¥{bs.netAssets.toLocaleString()}
      </Text>
    </View>
  );
}

/* ───────────── 利润表 ───────────── */

function IncomeView({
  income,
  period,
  periods,
  onPeriod,
}: {
  income: ReturnType<typeof buildIncomeStatement>;
  period: string;
  periods: string[];
  onPeriod: (p: string) => void;
}) {
  const chartData = [
    { name: '收入', value: income.totalIncome, color: '#10b981' },
    { name: '支出', value: income.totalExpense, color: '#ef4444' },
    { name: '结余', value: income.surplus, color: '#3b82f6' },
  ];
  const maxV = Math.max(...chartData.map((d) => Math.abs(d.value)), 1);

  return (
    <View className='space-y-3'>
      <PeriodPicker periods={periods} value={period} onChange={onPeriod} />

      {/* 收支结余概览 */}
      <Card className='bg-gradient-to-br from-slate-900 to-slate-800 border-0 text-white'>
        <CardContent className='p-5 pt-5'>
          <Text className='text-xs text-slate-400 font-bold mb-1 block'>{income.period} 利润（结余）</Text>
          <Text className={`text-3xl font-black font-mono block ${income.surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {income.surplus >= 0 ? '+' : ''}
            {fmt(income.surplus)}
          </Text>
          <Text className='text-[11px] text-slate-400 mt-1 block'>储蓄率 {fmtPercent(income.surplusRate)}</Text>
        </CardContent>
      </Card>

      {/* 收支对比（横向柱条，替代 recharts BarChart） */}
      <Card>
        <CardContent className='p-4'>
          <Text className='text-xs font-bold text-slate-500 mb-2 block'>收入 / 支出 / 结余</Text>
          {income.recordCount === 0 ? (
            <EmptyHint text={`${income.period} 暂无记账数据`} />
          ) : (
            chartData.map((d) => (
              <View key={d.name} className='mb-2.5'>
                <View className='flex justify-between mb-1'>
                  <Text className='text-[11px] text-slate-600 font-semibold'>{d.name}</Text>
                  <Text className='text-[11px] font-mono font-bold' style={{ color: d.color }}>
                    {fmt(d.value)}
                  </Text>
                </View>
                <View className='h-4 bg-slate-100 rounded-md overflow-hidden'>
                  <View
                    style={{ width: `${(Math.abs(d.value) / maxV) * 100}%`, background: d.color, height: '100%' }}
                    className='rounded-md'
                  />
                </View>
              </View>
            ))
          )}
        </CardContent>
      </Card>

      {/* 支出分类明细 */}
      {income.expenseByCategory.length > 0 && (
        <CategoryList title='支出分类' items={income.expenseByCategory} kind='expense' />
      )}
      {income.incomeByCategory.length > 0 && (
        <CategoryList title='收入分类' items={income.incomeByCategory} kind='income' />
      )}
    </View>
  );
}

function CategoryList({
  title,
  items,
  kind,
}: {
  title: string;
  items: IncomeStatement['expenseByCategory'];
  kind: 'income' | 'expense';
}) {
  return (
    <Card>
      <CardContent className='p-4'>
        <Text className='text-xs font-bold text-slate-500 mb-2 block'>{title}</Text>
        <View className='space-y-2'>
          {items.slice(0, 6).map((c) => (
            <View key={c.category}>
              <View className='flex items-center justify-between text-xs mb-1'>
                <Text className='font-semibold text-slate-700'>
                  {c.category} <Text className='text-slate-400 font-normal'>· {c.count}笔</Text>
                </Text>
                <Text className={`font-bold font-mono ${kind === 'income' ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {fmt(c.amount)}
                </Text>
              </View>
              <View className='h-1.5 bg-slate-100 rounded-full overflow-hidden'>
                <View
                  className={`h-full rounded-full ${kind === 'income' ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  style={{ width: `${Math.max(4, c.ratio * 100)}%` }}
                />
              </View>
            </View>
          ))}
        </View>
      </CardContent>
    </Card>
  );
}

/* ───────────── 现金流量表 ───────────── */

function CashFlowView({
  cashflow,
  trend,
  period,
  periods,
  onPeriod,
}: {
  cashflow: ReturnType<typeof buildCashFlowStatement>;
  trend: ReturnType<typeof buildMonthlyTrend>;
  period: string;
  periods: string[];
  onPeriod: (p: string) => void;
}) {
  return (
    <View className='space-y-3'>
      <PeriodPicker periods={periods} value={period} onChange={onPeriod} />

      {/* 现金净增减 */}
      <Card className='bg-gradient-to-br from-cyan-600 to-blue-600 border-0 text-white'>
        <CardContent className='p-5 pt-5'>
          <View className='flex items-center gap-1.5 text-cyan-100 text-xs font-bold mb-1'>
            <Icon name='coins' size={13} /> {cashflow.period} 现金净增减
          </View>
          <Text className={`text-3xl font-black font-mono block ${cashflow.netChange >= 0 ? 'text-white' : 'text-rose-200'}`}>
            {cashflow.netChange >= 0 ? '+' : ''}
            {fmt(cashflow.netChange)}
          </Text>
        </CardContent>
      </Card>

      {/* 三类活动 */}
      <Card>
        <CardContent className='p-4 space-y-3'>
          <Text className='text-xs font-bold text-slate-500 block'>三类活动现金流</Text>
          {cashflow.lines.map((l) => (
            <View key={l.activity} className='flex items-center gap-2'>
              <View style={{ width: '8px', height: '32px', borderRadius: '4px', background: ACTIVITY_COLOR[l.activity] }} />
              <View className='flex-1 min-w-0'>
                <View className='flex items-center justify-between'>
                  <Text className='text-xs font-bold text-slate-700'>{ACTIVITY_LABEL[l.activity]}</Text>
                  <Text className={`text-sm font-black font-mono ${l.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {l.net >= 0 ? '+' : ''}
                    {fmt(l.net)}
                  </Text>
                </View>
                <View className='flex items-center gap-2 text-[10px] text-slate-400 mt-0.5'>
                  <Text>↓ 流出 {fmt(l.outflow)}</Text>
                  <Text>↑ 流入 {fmt(l.inflow)}</Text>
                </View>
              </View>
            </View>
          ))}
          {cashflow.recordCount === 0 && <EmptyHint text={`${cashflow.period} 暂无数据`} />}
        </CardContent>
      </Card>

      {/* 近6月现金净增走势（ECharts 折线，替代 recharts LineChart） */}
      {trend.length > 0 && (
        <Card>
          <CardContent className='p-4'>
            <Text className='text-xs font-bold text-slate-500 mb-2 block'>
              近 {trend.length} 月现金净增走势
            </Text>
            <EChart
              height={130}
              option={{
                grid: { left: 35, right: 10, top: 15, bottom: 25 },
                tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>¥${Math.round(p[0].value).toLocaleString()}` },
                xAxis: {
                  type: 'category',
                  data: trend.map((t) => t.period.slice(5)),
                  axisLabel: { fontSize: 9 },
                },
                yAxis: {
                  type: 'value',
                  axisLabel: { fontSize: 9, formatter: (v: number) => `${Math.round(v / 1000)}k` },
                  splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } },
                },
                series: [{
                  type: 'line',
                  data: trend.map((t) => Math.round(t.netCashChange)),
                  smooth: true,
                  symbol: 'circle',
                  symbolSize: 5,
                  lineStyle: { color: '#06b6d4', width: 2 },
                  itemStyle: { color: '#06b6d4' },
                  areaStyle: {
                    color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
                      { offset: 0, color: 'rgba(6,182,212,0.3)' },
                      { offset: 1, color: 'rgba(6,182,212,0.02)' },
                    ] },
                  },
                }],
              }}
            />
          </CardContent>
        </Card>
      )}
    </View>
  );
}

/* ───────────── 通用小组件 ───────────── */

function PeriodPicker({
  periods,
  value,
  onChange,
}: {
  periods: string[];
  value: string;
  onChange: (p: string) => void;
}) {
  if (periods.length === 0) {
    return (
      <View className='flex items-center gap-1.5 text-xs text-slate-400 px-1'>
        <Icon name='info' size={12} /> 暂无记账期间
      </View>
    );
  }
  return (
    <ScrollView scrollX className='flex gap-1.5 pb-1' style={{ whiteSpace: 'nowrap' }}>
      {periods.map((p) => (
        <Motion
          key={p}
          tapScale={0.95}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold ${value === p ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          {p}
        </Motion>
      ))}
    </ScrollView>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <View className='flex items-center justify-center gap-1.5 text-xs text-slate-400 py-6'>
      <Icon name='info' size={13} /> {text}
    </View>
  );
}
