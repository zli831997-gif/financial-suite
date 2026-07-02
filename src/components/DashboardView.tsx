import { useState } from 'react';
import { Transaction } from '../types';
import { Card, CardContent } from './ui/card';
import { Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import {
  Lock,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  X,
  Check
} from 'lucide-react';
import {
  FinanceAppState,
  calculateProfileCompleteness
} from '../utils/financeState';
import type { GrowthState } from '../logic/domain/gamification';
import { todayStr as getTodayStr } from '../logic/domain/gamification';
import { calcNetAssets } from '../logic/calc/netAssets';
import { getAccountsNetBalance } from '../logic/domain/accounts';
import { storage } from '../storage';
import { KEYS } from '../storage/keys';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardViewProps {
  transactions: Transaction[];
  financeState: FinanceAppState;
  growth: GrowthState;
  onUpdateState: (state: FinanceAppState) => void;
  onNavigateTab: (tab: 'home' | 'accounting' | 'reports' | 'profile' | 'tools') => void;
  onAddTransaction?: (t: Transaction) => void;
  onPunchIn: () => void;
  onProfileBonus: (reason: string, points: number) => void;
  onNavigateToBills?: (type: 'income' | 'expense') => void;
}

export function DashboardView({
  transactions,
  financeState,
  growth,
  onUpdateState,
  onNavigateTab,
  onAddTransaction,
  onPunchIn,
  onProfileBonus,
  onNavigateToBills
}: DashboardViewProps) {
  const [showCompletenessModal, setShowCompletenessModal] = useState(false);

  // Load preset checklist
  const { percent: completenessPercent, checks: checklist } = calculateProfileCompleteness(financeState, transactions.length);

  // 1. Calculate dynamic values for metrics
  const baseSalary = financeState.profile.monthlyNetSalary;
  const rentIncome = (financeState.property && financeState.property.isRented) ? financeState.property.rentIncome : 0;
  const totalIncome = baseSalary + rentIncome;

  // Monthly Expenses: transactions sum + house payment + car payment
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthTrans = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const transactionsExpense = thisMonthTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const housePayment = financeState.property ? financeState.property.monthlyPayment : 0;
  const carPayment = financeState.vehicle ? financeState.vehicle.monthlyPayment : 0;
  const totalExpense = transactionsExpense + housePayment + carPayment;

  // 统一净资产口径（单一权威函数，首页/工具箱/资产页共用）
  const netAssetsResult = calcNetAssets(financeState, getAccountsNetBalance());
  const netAssets = netAssetsResult.net;

  const [isCompletenessDismissed, setIsCompletenessDismissed] = useState(() => {
    return storage.get<boolean>(KEYS.COMPLETENESS_DISMISSED) === true;
  });
  const [isRepaymentReminderDismissed, setIsRepaymentReminderDismissed] = useState(() => {
    return storage.get<boolean>(KEYS.REPAYMENT_REMINDER_DISMISSED) === true;
  });

  // 预算执行曲线
  const budgetGoalVal = financeState.budgetGoal || 3000;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayDate = new Date().getDate();
  const budgetPerDay = budgetGoalVal / daysInMonth;
  const expenseByDay: Record<number, number> = {};
  thisMonthTrans.filter(t => t.type === 'expense').forEach(t => {
    const d = new Date(t.date).getDate();
    expenseByDay[d] = (expenseByDay[d] || 0) + t.amount;
  });
  let cumExpense = 0;
  const budgetChartData: { day: number; actual: number | null; budget: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    cumExpense += expenseByDay[d] || 0;
    budgetChartData.push({ day: d, actual: d <= todayDate ? Math.round(cumExpense) : null, budget: Math.round(budgetPerDay * d) });
  }
  const budgetPaceToday = budgetPerDay * todayDate;
  const isOverPace = transactionsExpense > budgetPaceToday;
  const paceDiff = Math.round(Math.abs(transactionsExpense - budgetPaceToday));
  const projectedMonthEnd = todayDate > 0 ? Math.round((transactionsExpense / todayDate) * daysInMonth) : 0;
  const budgetRemaining = budgetGoalVal - transactionsExpense;

  // Daily punch-in method（走 gamification domain，幂等打卡）
  const handlePunchIn = () => {
    onPunchIn();
  };

  const todayStr = getTodayStr();

  const getRepaymentReminderInfo = () => {
    if (!financeState.property || financeState.property.isFullyPaid || !financeState.property.monthlyPayment) {
      return null;
    }
    const payDay = financeState.property.payDay || 15;
    const monthlyPayment = financeState.property.monthlyPayment;
    const propertyName = financeState.property.address || '我的家庭房产实体';
    
    // Calculate days remaining
    const today = new Date();
    const currentDay = today.getDate();
    
    let daysRemaining = 0;
    let nextPayDateStr = '';
    
    if (currentDay <= payDay) {
      daysRemaining = payDay - currentDay;
      nextPayDateStr = `本月 ${payDay} 日`;
    } else {
      // It falls in the next month
      const daysInThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      daysRemaining = (daysInThisMonth - currentDay) + payDay;
      nextPayDateStr = `下月 ${payDay} 日`;
    }
    
    return {
      propertyName,
      payDay,
      monthlyPayment,
      daysRemaining,
      nextPayDateStr
    };
  };

  return (
    <div className="p-4 space-y-5 max-w-sm mx-auto w-full">

      {/* 本月预算执行 */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">本月预算执行</p>
            <p className="text-[22px] font-black text-slate-900 font-mono mt-0.5">
              ¥{transactionsExpense.toLocaleString()}
              <span className="text-[12px] text-slate-400 font-bold"> / ¥{budgetGoalVal.toLocaleString()}</span>
              <button type="button" onClick={() => { const v = window.prompt('设置本月支出预算（元）', String(budgetGoalVal)); if (v !== null && !isNaN(parseFloat(v)) && parseFloat(v) >= 0) onUpdateState({ ...financeState, budgetGoal: parseFloat(v) }); }} className="ml-1.5 text-[10px] text-indigo-500 hover:text-indigo-700 font-bold align-middle">✏️设置预算</button>
            </p>
            <p className={`text-[10px] font-bold mt-0.5 ${isOverPace ? 'text-rose-500' : 'text-emerald-500'}`}>
              {isOverPace ? `⚠️ 超节奏 ¥${paceDiff.toLocaleString()}` : `✓ 比节奏省 ¥${paceDiff.toLocaleString()}`}
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={64}>
          <LineChart data={budgetChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <Line type="monotone" dataKey="budget" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            <Line type="monotone" dataKey="actual" stroke={isOverPace ? '#ef4444' : '#10b981'} strokeWidth={2} dot={false} connectNulls />
            <Tooltip formatter={(v: any) => v != null ? `¥${Number(v).toLocaleString()}` : '—'} labelFormatter={(l: any) => `${l}号`} contentStyle={{ fontSize: '10px', padding: '4px 8px' }} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex justify-between items-center mt-2 text-[9px] font-bold">
          <span className="text-slate-400">剩余 <span className={budgetRemaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}>¥{budgetRemaining.toLocaleString()}</span></span>
          <span className="text-slate-400">月底预测 <span className={projectedMonthEnd > budgetGoalVal ? 'text-rose-600' : 'text-emerald-600'}>¥{projectedMonthEnd.toLocaleString()}</span></span>
        </div>
      </div>

      {/* 2. ONBOARDING COMPLETENESS WIDGET (模块5) */}
      {!isCompletenessDismissed && completenessPercent < 100 && (
        <div 
          onClick={() => setShowCompletenessModal(true)}
          className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:bg-slate-50 transition cursor-pointer relative text-left"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsCompletenessDismissed(true);
              storage.set(KEYS.COMPLETENESS_DISMISSED, true);
            }}
            className="absolute top-2.5 right-2.5 text-slate-300 hover:text-slate-500 p-1 rounded-full hover:bg-slate-100 cursor-pointer flex items-center justify-center transition"
            title="暂时隐藏完美度面板"
          >
            <X size={12} />
          </button>

          <div className="flex justify-between items-center mb-1.5 pr-6">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
              <CheckCircle size={14} className="text-blue-500" />
              <span>财务档案完美度</span>
            </div>
            <span className="text-xs font-bold text-blue-600">{completenessPercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${completenessPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-2 flex items-center justify-between">
            <span>还差 {8 - checklist.filter(c => c.completed).length} 步以达到 100% 预测精度</span>
            <span className="text-blue-600 font-semibold flex items-center gap-0.5">查看面板 <ChevronRight size={10} /></span>
          </p>
        </div>
      )}

      {/* 2.5 DYNAMIC PROPERTY LOAN REPAYMENT REMINDER */}
      {!isRepaymentReminderDismissed && (() => {
        const reminder = getRepaymentReminderInfo();
        if (!reminder) return null;
        
        return (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-sm text-left animate-in fade-in duration-200 relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setIsRepaymentReminderDismissed(true);
                storage.set(KEYS.REPAYMENT_REMINDER_DISMISSED, true);
              }}
              className="absolute top-2.5 right-2.5 text-amber-500 hover:text-amber-700 p-1 rounded-full hover:bg-amber-100/60 cursor-pointer flex items-center justify-center transition"
              title="忽略通知"
            >
              <X size={12} />
            </button>

            <div className="flex justify-between items-center pr-6">
              <div className="flex gap-1.5 items-center text-amber-900 font-extrabold text-[11px]">
                <AlertCircle className="text-amber-500 animate-pulse shrink-0" size={14} />
                <span>⚙️ 房产按揭月供还款日前瞻通知</span>
              </div>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${reminder.daysRemaining <= 3 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
                {reminder.daysRemaining === 0 ? '⏰ 今日扣划!' : `距扣款还剩 ${reminder.daysRemaining} 天`}
              </span>
            </div>
            
            <p className="text-[10.5px] text-slate-600 leading-normal">
              您的关联资产 <span className="font-extrabold text-slate-800">{reminder.propertyName}</span> 的月供扣划日为 <span className="font-bold text-amber-700">{reminder.nextPayDateStr}</span>，目前需划转本息 <span className="font-black text-rose-600 font-mono">¥{reminder.monthlyPayment.toLocaleString()}</span>。
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const newTx = {
                    id: `housing-repay-${Date.now()}`,
                    type: 'expense' as const,
                    amount: reminder.monthlyPayment,
                    category: '住房',
                    date: todayStr,
                    note: `【还贷联动】房贷月供划扣 (${reminder.propertyName})`
                  };
                  if (onAddTransaction) {
                    onAddTransaction(newTx);
                    setIsRepaymentReminderDismissed(true);
                    storage.set(KEYS.REPAYMENT_REMINDER_DISMISSED, true);
                    alert(`✨ 房贷还贷记款成功！已向您的日常账簿追加了一条房贷月供指出流记录：¥${reminder.monthlyPayment.toLocaleString()}`);
                  } else {
                    alert("⚠️ 记账配置暂不可用，请进入账簿直接添加！");
                  }
                }}
                className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition shadow-2xs cursor-pointer"
              >
                <Check size={11} strokeWidth={3} />
                <span>一键记账并扣划</span>
              </button>
              
              <button
                type="button"
                onClick={() => onNavigateTab('accounting')}
                className="py-1.5 px-3 bg-white hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <span>进入账簿</span>
              </button>
            </div>
          </div>
        );
      })()}



      {/* 3. DYNAMIC 2x2 GRID FOR CORE METRICS */}
      <div className="grid grid-cols-2 gap-3">
        {/* Estimated Income */}
        <Card className="shadow-sm border border-slate-100 cursor-pointer hover:border-emerald-300 hover:shadow-md transition" onClick={() => onNavigateToBills?.('income')}>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">本月预估收入</p>
            <p className="text-[17px] font-extrabold text-slate-900 font-mono">¥{totalIncome.toLocaleString()}</p>
            <p className="text-[9px] text-emerald-500 font-bold mt-1 flex items-center gap-0.5">
              <span>基薪: ¥{baseSalary.toLocaleString()}</span>
              {rentIncome > 0 && <span className="text-indigo-600 bg-indigo-50 px-1 rounded">含房租</span>}
            </p>
          </CardContent>
        </Card>

        {/* Estimated Expense */}
        <Card className="shadow-sm border border-slate-100 cursor-pointer hover:border-rose-300 hover:shadow-md transition" onClick={() => onNavigateToBills?.('expense')}>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold text-slate-400 tracking-wider mb-1">本月预估总支出</p>
            <p className="text-[17px] font-extrabold text-slate-900 font-mono">¥{totalExpense.toLocaleString()}</p>
            <p className="text-[9px] text-rose-500 font-bold mt-1 flex items-center gap-0.5">
              <span>明细: ¥{transactionsExpense.toLocaleString()}</span>
              {(housePayment > 0 || carPayment > 0) && <span className="bg-rose-50 text-rose-600 px-1 rounded font-bold">含月供</span>}
            </p>
          </CardContent>
        </Card>

        {/* Net Asset Valuation with unified net assets */}
        <Card 
          onClick={() => onNavigateTab('tools')} // asset tab resides in Tools
          className="shadow-sm border border-slate-100 col-span-2 bg-gradient-to-br from-slate-50 to-white hover:border-blue-200 cursor-pointer transition"
        >
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">精细净资产估值 (统一口径)</p>
              <p className={`text-2xl font-extrabold font-mono ${netAssets >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                ¥{netAssets.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </p>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded-full mb-1">
                资产结构完整
              </span>
              <p className="text-[10px] text-slate-400">存款储蓄自持+投资估值</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PRIVACY MANDATE BANNER */}
      <div className="pt-2 text-center flex flex-col items-center justify-center gap-1.5 select-none opacity-85">
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-200/50 py-1 px-3 rounded-full">
          <Lock size={10} className="text-indigo-600 fill-indigo-100" />
          <span>数据仅存本机 · 隐私防泄露</span>
        </div>
        <p className="text-[9px] text-slate-400 leading-normal max-w-[260px] text-center">
          FinanceHub 已启动纯浏览器物理隔离防护。不进行任何公网云传输或外部资产绑卡。
        </p>
      </div>

      {/* --- BOTTOM SHEET 2: FILE COMPLETENESS DETAILS --- */}
      <AnimatePresence>
        {showCompletenessModal && (
          <div className="absolute inset-0 bg-slate-900/60 z-50 flex items-end">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-white rounded-t-3xl max-h-[75%] overflow-y-auto p-6 space-y-4 shadow-2xl z-50 text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">档案配置追踪面板</h4>
                  <p className="text-[10px] text-slate-400">目前完整度 {completenessPercent}% • 完成档案解锁极高计算拟真度</p>
                </div>
                <button onClick={() => setShowCompletenessModal(false)} className="p-1 hover:bg-slate-100 rounded-full">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2.5 pt-2">
                {checklist.map((item) => (
                  <div 
                    key={item.key}
                    className={`p-3 rounded-2xl flex items-center justify-between border ${
                      item.completed 
                        ? 'bg-emerald-50/40 border-emerald-100 text-emerald-950' 
                        : 'bg-slate-50 border-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.completed ? (
                        <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle size={18} className="text-amber-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-bold">{item.name}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    {!item.completed ? (
                      <button 
                        onClick={() => {
                          setShowCompletenessModal(false);
                          if (item.key === 'trans') {
                            onNavigateTab('accounting');
                          } else if (item.key === 'savings') {
                            onNavigateTab('tools'); // savings is listed inside AssetsView under Tools
                          } else {
                            onNavigateTab('profile');
                          }
                        }}
                        className="px-2.5 py-1 bg-blue-600 border-0 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 active:scale-95 transition"
                      >
                        {item.action}
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-100/55 px-2 py-0.5 rounded">
                        已就绪
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* celebration 动效已移至 App 全局（记账/打卡/升级/徽章统一弹） */}

    </div>
  );
}
