import { useMemo, useState } from 'react';
import { Card, CardContent } from './ui/card';
import {
  Scale, TrendingUp, Waves, ChevronUp, ChevronDown, Wallet, AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import type { FinanceAppState } from '../utils/financeState';
import type { Account } from '../logic/domain/accounts';
import type { Transaction } from '../types';
import {
  buildBalanceSheet, type BalanceSheetGroup,
} from '../logic/calc/netAssets';
import {
  buildIncomeStatement, buildCashFlowStatement, buildMonthlyTrend,
  listMonthPeriods, type CashFlowActivity,
} from '../logic/calc/report';

interface ReportsViewProps {
  financeState: FinanceAppState;
  accounts: Account[];
  transactions: Transaction[];
}

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

export function ReportsView({ financeState, accounts, transactions }: ReportsViewProps) {
  const [tab, setTab] = useState<Tab>('balance');

  // 期间选择：默认本月
  const monthPeriods = useMemo(() => listMonthPeriods(transactions), [transactions]);
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return monthPeriods.includes(ym) ? ym : (monthPeriods[0] || ym);
  });

  const balance = useMemo(() => buildBalanceSheet(financeState, accounts), [financeState, accounts]);
  const income = useMemo(() => buildIncomeStatement(transactions, period), [transactions, period]);
  const cashflow = useMemo(() => buildCashFlowStatement(transactions, period), [transactions, period]);
  const trend = useMemo(() => buildMonthlyTrend(transactions, 6), [transactions]);

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Tab 切换 */}
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl">
        {([
          { id: 'balance' as Tab, label: '资产负债', icon: Scale },
          { id: 'income' as Tab, label: '利润', icon: TrendingUp },
          { id: 'cashflow' as Tab, label: '现金流', icon: Waves },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition ${
              tab === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'balance' && <BalanceSheetView bs={balance} />}
      {tab === 'income' && (
        <IncomeView
          income={income}
          period={period}
          periods={monthPeriods}
          onPeriod={setPeriod}
        />
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
    </div>
  );
}

// ─────────────────────────────────────────────
// 资产负债表
// ─────────────────────────────────────────────

function BalanceGroup({ group, positive }: { group: BalanceSheetGroup; positive: boolean }) {
  if (group.items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-1.5">
        <span className="text-xs font-bold text-slate-500">{group.label}</span>
        <span className={`text-xs font-black font-mono ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {fmt(group.subtotal)}
        </span>
      </div>
      <div className="bg-white rounded-2xl divide-y divide-slate-50 overflow-hidden">
        {group.items.map((it) => (
          <div key={it.name} className="flex items-center justify-between px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800">{it.name}</div>
              {it.detail && <div className="text-[10px] text-slate-400 mt-0.5">{it.detail}</div>}
            </div>
            <span className="text-sm font-bold font-mono text-slate-700 shrink-0 ml-2">
              {fmt(it.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BalanceSheetView({ bs }: { bs: ReturnType<typeof buildBalanceSheet> }) {
  const pieData = [
    { name: '流动资产', value: bs.currentAssets.subtotal, color: '#3b82f6' },
    { name: '非流动资产', value: bs.nonCurrentAssets.subtotal, color: '#6366f1' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-3">
      {/* 净资产大卡片 */}
      <Card className="bg-gradient-to-br from-indigo-600 to-blue-600 border-0 text-white">
        <CardContent className="p-5 pt-5">
          <div className="flex items-center gap-1.5 text-indigo-100 text-xs font-bold mb-1">
            <Wallet size={13} /> 净资产（所有者权益）
          </div>
          <div className="text-3xl font-black font-mono tracking-tight">{fmt(bs.netAssets)}</div>
          <div className="flex items-center gap-4 mt-3 text-[11px]">
            <div>
              <span className="text-indigo-200">总资产 </span>
              <span className="font-bold font-mono">{fmt(bs.totalAssets)}</span>
            </div>
            <div>
              <span className="text-indigo-200">总负债 </span>
              <span className="font-bold font-mono">{fmt(bs.totalLiabilities)}</span>
            </div>
            <div className="ml-auto bg-white/15 rounded-full px-2 py-0.5 font-bold">
              负债率 {fmtPercent(bs.debtRatio)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 资产分布饼图 */}
      {pieData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 mb-2">资产流动性分布</div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={pieData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={22}>
                  {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <BalanceGroup group={bs.currentAssets} positive />
      <BalanceGroup group={bs.nonCurrentAssets} positive />
      <BalanceGroup group={bs.currentLiabilities} positive={false} />
      <BalanceGroup group={bs.nonCurrentLiabilities} positive={false} />

      <div className="text-[10px] text-slate-400 text-center px-4 leading-relaxed">
        会计恒等式：资产 ¥{bs.totalAssets.toLocaleString()} − 负债 ¥{bs.totalLiabilities.toLocaleString()} = 净资产 ¥{bs.netAssets.toLocaleString()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 利润表
// ─────────────────────────────────────────────

function IncomeView({
  income, period, periods, onPeriod,
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

  return (
    <div className="space-y-3">
      <PeriodPicker periods={periods} value={period} onChange={onPeriod} />

      {/* 收支结余概览 */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-0 text-white">
        <CardContent className="p-5 pt-5">
          <div className="text-xs text-slate-400 font-bold mb-1">{income.period} 利润（结余）</div>
          <div className={`text-3xl font-black font-mono ${income.surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {income.surplus >= 0 ? '+' : ''}{fmt(income.surplus)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">储蓄率 {fmtPercent(income.surplusRate)}</div>
        </CardContent>
      </Card>

      {/* 收支对比柱状图 */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs font-bold text-slate-500 mb-2">收入 / 支出 / 结余</div>
          {income.recordCount === 0 ? (
            <EmptyHint text={`${income.period} 暂无记账数据`} />
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48}
                  tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {chartData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 支出分类明细 */}
      {income.expenseByCategory.length > 0 && (
        <CategoryList title="支出分类" items={income.expenseByCategory} kind="expense" />
      )}
      {income.incomeByCategory.length > 0 && (
        <CategoryList title="收入分类" items={income.incomeByCategory} kind="income" />
      )}
    </div>
  );
}

function CategoryList({
  title, items, kind,
}: {
  title: string;
  items: ReturnType<typeof buildIncomeStatement>['expenseByCategory'];
  kind: 'income' | 'expense';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-bold text-slate-500 mb-2">{title}</div>
        <div className="space-y-2">
          {items.slice(0, 6).map((c) => (
            <div key={c.category}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">
                  {c.category} <span className="text-slate-400 font-normal">· {c.count}笔</span>
                </span>
                <span className={`font-bold font-mono ${kind === 'income' ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {fmt(c.amount)}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${kind === 'income' ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  style={{ width: `${Math.max(4, c.ratio * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// 现金流量表
// ─────────────────────────────────────────────

function CashFlowView({
  cashflow, trend, period, periods, onPeriod,
}: {
  cashflow: ReturnType<typeof buildCashFlowStatement>;
  trend: ReturnType<typeof buildMonthlyTrend>;
  period: string;
  periods: string[];
  onPeriod: (p: string) => void;
}) {
  return (
    <div className="space-y-3">
      <PeriodPicker periods={periods} value={period} onChange={onPeriod} />

      {/* 现金净增减 */}
      <Card className="bg-gradient-to-br from-cyan-600 to-blue-600 border-0 text-white">
        <CardContent className="p-5 pt-5">
          <div className="flex items-center gap-1.5 text-cyan-100 text-xs font-bold mb-1">
            <Waves size={13} /> {cashflow.period} 现金净增减
          </div>
          <div className={`text-3xl font-black font-mono ${cashflow.netChange >= 0 ? 'text-white' : 'text-rose-200'}`}>
            {cashflow.netChange >= 0 ? '+' : ''}{fmt(cashflow.netChange)}
          </div>
        </CardContent>
      </Card>

      {/* 三类活动 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="text-xs font-bold text-slate-500">三类活动现金流</div>
          {cashflow.lines.map((l) => (
            <div key={l.activity} className="flex items-center gap-2">
              <span className="w-2 h-8 rounded-full" style={{ backgroundColor: ACTIVITY_COLOR[l.activity] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{ACTIVITY_LABEL[l.activity]}</span>
                  <span className={`text-sm font-black font-mono ${l.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {l.net >= 0 ? '+' : ''}{fmt(l.net)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                  <span className="flex items-center gap-0.5"><ChevronDown size={10} className="text-rose-400" />流出 {fmt(l.outflow)}</span>
                  <span className="flex items-center gap-0.5"><ChevronUp size={10} className="text-emerald-400" />流入 {fmt(l.inflow)}</span>
                </div>
              </div>
            </div>
          ))}
          {cashflow.recordCount === 0 && <EmptyHint text={`${cashflow.period} 暂无数据`} />}
        </CardContent>
      </Card>

      {/* 近6月现金净增走势 */}
      {trend.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-bold text-slate-500 mb-2">近 {trend.length} 月现金净增走势</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48}
                  tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l: string) => `${l}`} />
                <Line type="monotone" dataKey="netCashChange" stroke="#06b6d4" strokeWidth={2.5}
                  dot={{ r: 3, fill: '#06b6d4' }} name="现金净增" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 通用小组件
// ─────────────────────────────────────────────

function PeriodPicker({
  periods, value, onChange,
}: {
  periods: string[];
  value: string;
  onChange: (p: string) => void;
}) {
  if (periods.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400 px-1">
        <AlertCircle size={12} /> 暂无记账期间
      </div>
    );
  }
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
            value === p ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 py-6">
      <AlertCircle size={13} /> {text}
    </div>
  );
}
