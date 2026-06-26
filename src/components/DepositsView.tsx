import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Banknote, Database, Sparkles } from 'lucide-react';
import { FinanceAppState } from '../utils/financeState';

interface DepositsViewProps {
  financeState?: FinanceAppState;
}

export function DepositsView({ financeState }: DepositsViewProps) {
  const [principal, setPrincipal] = useState('100000');
  const [rate, setRate] = useState('3.5');
  const [years, setYears] = useState('1');

  const calculate = () => {
    const p = parseFloat(principal) || 0;
    const r = (parseFloat(rate) || 0) / 100;
    const y = parseFloat(years) || 0;
    
    const simpleInterest = p * r * y;
    const compoundInterest = p * Math.pow(1 + r, y) - p;

    return { simpleInterest, compoundInterest };
  };

  const res = calculate();
  
  const savedSavings = financeState?.savings || [];

  return (
    <div className="p-4 max-w-sm mx-auto space-y-4 pb-24 text-slate-800">
      <div className="pb-1 border-b border-slate-100">
        <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
          <Banknote className="text-emerald-500 w-5 h-5"/>
          理财与存款复利计算
        </h3>
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">实体联动分析器 · 验证单复利复权回报</p>
      </div>

      {/* Database Entity Connection Shortcut */}
      {savedSavings.length > 0 && (
        <Card className="border border-emerald-100 bg-emerald-50/15 overflow-hidden shadow-xs">
          <CardContent className="p-3 space-y-2">
            <span className="text-[9px] font-black text-emerald-800 flex items-center gap-1 uppercase tracking-wider">
              <Database size={10} className="text-emerald-600 animate-pulse" />
              我的已登记财产实体 (点击快捷填入本金利率)
            </span>
            <div className="flex flex-wrap gap-1.55">
              {savedSavings.map((save) => (
                <button
                  key={save.id}
                  type="button"
                  onClick={() => {
                    setPrincipal(save.amount.toString());
                    setRate(save.annualRate.toString());
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200/85 rounded-xl text-[10px] font-bold text-slate-700 transition flex items-center gap-1 shadow-2xs"
                >
                  <Sparkles size={8} className="text-emerald-500" />
                  <span>{save.name} (¥{(save.amount / 1000).toFixed(0)}k @ {save.annualRate}%)</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-slate-200/80 shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-3.5">
             <div>
               <label className="block text-[10px] font-extrabold text-slate-500 mb-1">测算本金金额 (元)</label>
               <div className="relative">
                 <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">¥</span>
                 <input 
                   type="number" 
                   value={principal} 
                   onChange={e => setPrincipal(e.target.value)} 
                   className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none" 
                 />
               </div>
             </div>
             <div>
               <label className="block text-[10px] font-extrabold text-slate-500 mb-1">测算预期年化收益率 (%)</label>
               <input 
                 type="number" 
                 value={rate} 
                 onChange={e => setRate(e.target.value)} 
                 step="0.1" 
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none" 
               />
             </div>
             <div>
               <label className="block text-[10px] font-extrabold text-slate-500 mb-1">测算定存投资期限 (年)</label>
               <input 
                 type="number" 
                 value={years} 
                 onChange={e => setYears(e.target.value)} 
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none" 
               />
             </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col gap-3">
             <div className="text-xs font-black text-slate-800 flex items-center gap-1.5"><Banknote className="text-emerald-500 w-4 h-4"/> 预估到期收益分析</div>
             <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-white rounded-xl shadow-xs border border-emerald-100/50">
                  <div className="text-[8px] text-slate-400 font-extrabold mb-1">单利模式总回报 (定期存款)</div>
                  <div className="text-sm font-black text-emerald-600 font-mono">¥{res.simpleInterest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  <div className="text-[7.5px] text-slate-400 font-bold mt-1.5 bg-slate-50 px-1 py-0.5 rounded truncate">到期: ¥{Math.round(parseFloat(principal) + res.simpleInterest).toLocaleString()}</div>
                </div>
                <div className="p-2.5 bg-white rounded-xl shadow-xs border border-emerald-100/50">
                  <div className="text-[8px] text-slate-400 font-extrabold mb-1">复利模式总回报 (理财滚投)</div>
                  <div className="text-sm font-black text-emerald-700 font-mono">¥{res.compoundInterest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  <div className="text-[7.5px] text-slate-400 font-bold mt-1.5 bg-slate-50 px-1 py-0.5 rounded truncate">到期: ¥{Math.round(parseFloat(principal) + res.compoundInterest).toLocaleString()}</div>
                </div>
             </div>
          </div>
        </CardContent>
      </Card>
      
      <p className="text-[8.5px] font-medium text-slate-400 leading-normal bg-slate-50 p-2.5 rounded-xl border border-slate-200/50">
        📌 资产估值提示：实际存款及资财产品的计息、付息时间点（如按日、按季、按月复权滾投）存在细微差异。结果仅作为预测决策性理论推演参考。
      </p>
    </div>
  )
}
