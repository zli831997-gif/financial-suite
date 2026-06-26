import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import {
  Home, Calculator, Scale, TrendingDown, Clock, Wallet,
  Sparkles, Info, ChevronRight, PiggyBank,
} from 'lucide-react';
import { FinanceAppState } from '../utils/financeState';
import {
  compareLoanMethods, simulatePrepayment,
} from '../logic/calc/loan';

interface LoanViewProps {
  financeState: FinanceAppState;
}

function fmt(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

export function LoanView({ financeState }: LoanViewProps) {
  const [principal, setPrincipal] = useState('1000000');
  const [years, setYears] = useState('30');
  const [rate, setRate] = useState('4.1');
  const [paidMonths, setPaidMonths] = useState('60');
  const [prepayAmount, setPrepayAmount] = useState('100000');

  // 从房产档案自动带入贷款参数
  useEffect(() => {
    const p = financeState.property;
    if (p && p.loanBalance > 0) {
      setPrincipal(String(Math.round(p.loanBalance + (p.remainingTerms ? p.monthlyPayment * 6 : 0))));
      setRate(String(p.loanRate || 4.1));
      if (p.totalLoanTerms) setYears(String(Math.round(p.totalLoanTerms / 12)));
      if (p.remainingTerms) setPaidMonths(String(Math.round(p.totalLoanTerms! - p.remainingTerms)));
    }
  }, [financeState.property]);

  const P = parseFloat(principal) || 0;
  const Y = parseFloat(years) || 0;
  const R = parseFloat(rate) || 0;
  const paidM = Math.min(parseInt(paidMonths) || 0, Math.round(Y * 12));
  const prepay = Math.min(parseFloat(prepayAmount) || 0, P);

  const compare = useMemo(
    () => (P > 0 && Y > 0 ? compareLoanMethods(P, Y, R) : null),
    [P, Y, R]
  );
  const prepayResult = useMemo(
    () => (P > 0 && Y > 0 && prepay > 0
      ? simulatePrepayment({ principal: P, years: Y, annualRatePct: R, paidMonths: paidM, prepayAmount: prepay })
      : null),
    [P, Y, R, paidM, prepay]
  );

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* 贷款参数输入 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Home size={13} /> 贷款参数
            {financeState.property && (
              <span className="ml-auto text-[10px] text-indigo-500 font-semibold">已从房产档案带入</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="贷款本金" value={principal} onChange={setPrincipal} suffix="元" />
            <Field label="贷款年限" value={years} onChange={setYears} suffix="年" />
            <Field label="年利率" value={rate} onChange={setRate} suffix="%" />
            <Field label="已还月数" value={paidMonths} onChange={setPaidMonths} suffix="月" />
          </div>
        </CardContent>
      </Card>

      {/* 等额本息 vs 等额本金 */}
      {compare && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <Scale size={13} /> 还款方式对比
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MethodCard
                title="等额本息"
                highlight={`月供 ${fmt(compare.equalPayment.monthly)}`}
                rows={[
                  ['总利息', fmt(compare.equalPayment.interest)],
                  ['总还款', fmt(compare.equalPayment.total)],
                ]}
                color="blue"
              />
              <MethodCard
                title="等额本金"
                highlight={`首月 ${fmt(compare.equalPrincipal.firstMonth)}`}
                rows={[
                  ['总利息', fmt(compare.equalPrincipal.interest)],
                  ['末月', fmt(compare.equalPrincipal.lastMonth)],
                ]}
                color="emerald"
              />
            </div>
            {compare.interestDiff > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-[11px] text-amber-700 font-semibold">
                💡 等额本息比等额本金多付利息 <b>{fmt(compare.interestDiff)}</b>，
                但月供固定、前期压力小；等额本金总利息少但前期月供高。
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 提前还贷模拟器 */}
      <Card className="border-indigo-100">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600">
            <Sparkles size={13} /> 提前还贷模拟器
          </div>

          {/* 提前还款金额滑块 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-600">一次性提前还款</span>
              <span className="text-lg font-black text-indigo-600 font-mono">{fmt(prepay)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.round(P * 0.5)}
              step={10000}
              value={prepay}
              onChange={(e) => setPrepayAmount(e.target.value)}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>0</span>
              <span>¥{(P * 0.5 / 10000).toFixed(0)}万（滑动调整）</span>
            </div>
            <input
              type="number"
              value={prepayAmount}
              onChange={(e) => setPrepayAmount(e.target.value)}
              className="w-full mt-2 px-3 py-1.5 bg-slate-50 rounded-lg text-sm font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="输入提前还款金额"
            />
          </div>

          {prepayResult ? (
            <>
              <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-500 flex items-center justify-between">
                <span>已还 {paidM} 月，剩余本金</span>
                <span className="font-mono font-bold text-slate-700">{fmt(prepayResult.balanceAfterPrepay + prepay)}</span>
              </div>

              {/* 两方案对比 */}
              <div className="space-y-2">
                <SchemeCard
                  title="方案一：缩短年限"
                  subtitle="月供不变，提前还清"
                  icon={Clock}
                  color="rose"
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
                  title="方案二：减少月供"
                  subtitle="年限不变，月供降低"
                  icon={Wallet}
                  color="blue"
                  savedInterest={prepayResult.reducePayment.savedInterest}
                  rows={[
                    ['月供（降低）', fmt(prepayResult.reducePayment.monthlyPayment)],
                    ['每月少还', fmt(prepayResult.baseline.monthlyPayment - prepayResult.reducePayment.monthlyPayment)],
                    ['剩余总利息', fmt(prepayResult.reducePayment.remainingInterest)],
                  ]}
                  recommended={prepayResult.recommendation === 'reducePayment'}
                />
              </div>

              {/* 不提前的基线 */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>若不提前还款</span>
                <span>剩余利息 {fmt(prepayResult.baseline.remainingInterest)} / {prepayResult.baseline.remainingMonths}月</span>
              </div>

              <div className="bg-indigo-50 rounded-xl p-3 text-[11px] text-indigo-800 leading-relaxed">
                <div className="flex items-start gap-1.5">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  <span>
                    提前还款 <b>{fmt(prepay)}</b>，选择<b>{prepayResult.recommendation === 'shortenTerm' ? '缩短年限' : '减少月供'}</b>
                    可省利息 <b className="text-rose-600">{fmt(prepayResult[prepayResult.recommendation].savedInterest)}</b>。
                    一般而言「缩短年限」省利息更多，「减少月供」缓解每月压力。
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 text-center py-4">
              输入提前还款金额查看省利息方案
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// 子组件
// ─────────────────────────────────────────────

function Field({
  label, value, onChange, suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 block mb-1">{label}</label>
      <div className="flex items-center bg-slate-50 rounded-lg px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-indigo-400">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm font-mono font-bold text-slate-700 focus:outline-none min-w-0"
        />
        {suffix && <span className="text-[10px] text-slate-400 ml-1 shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function MethodCard({
  title, highlight, rows, color,
}: {
  title: string;
  highlight: string;
  rows: [string, string][];
  color: 'blue' | 'emerald';
}) {
  const accent = color === 'blue' ? 'text-blue-600' : 'text-emerald-600';
  const bg = color === 'blue' ? 'bg-blue-50' : 'bg-emerald-50';
  return (
    <div className={`${bg} rounded-xl p-3`}>
      <div className="text-xs font-bold text-slate-600 mb-0.5">{title}</div>
      <div className={`text-sm font-black font-mono ${accent} mb-2`}>{highlight}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between text-[10px] text-slate-500">
          <span>{k}</span>
          <span className="font-mono font-bold text-slate-700">{v}</span>
        </div>
      ))}
    </div>
  );
}

function SchemeCard({
  title, subtitle, icon: Icon, color, savedInterest, badge, rows, recommended,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: 'rose' | 'blue';
  savedInterest: number;
  badge?: string;
  rows: [string, string][];
  recommended?: boolean;
}) {
  const accent = color === 'rose' ? 'text-rose-600 bg-rose-50' : 'text-blue-600 bg-blue-50';
  return (
    <div className={`rounded-2xl p-3 border ${recommended ? 'border-indigo-200 bg-white' : 'border-slate-100 bg-white'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className={`w-7 h-7 rounded-lg ${accent} flex items-center justify-center`}>
            <Icon size={14} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
              {title}
              {recommended && (
                <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">推荐</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400">{subtitle}</div>
          </div>
        </div>
        {badge && (
          <div className="text-right">
            <div className="text-[9px] text-slate-400">提前还清</div>
            <div className="text-[11px] font-bold text-rose-600">{badge}</div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between bg-emerald-50 rounded-lg px-2.5 py-1.5 mb-2">
        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
          <PiggyBank size={11} /> 节省利息
        </span>
        <span className="text-sm font-black text-emerald-600 font-mono">{fmt(savedInterest)}</span>
      </div>
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{k}</span>
            <span className="font-mono font-bold text-slate-700">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
