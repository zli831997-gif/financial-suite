import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { FinanceAppState, SavingEntity, CryptoEntity } from '../utils/financeState';
import { calcNetAssets } from '../logic/calc/netAssets';
import { getAccountsNetBalance } from '../logic/domain/accounts';
import { 
  Plus, 
  Trash2, 
  PiggyBank, 
  Coins, 
  ShieldCheck, 
  X, 
  Building, 
  Landmark, 
  Shield, 
  TrendingUp, 
  Sparkles, 
  Activity, 
  AlertTriangle, 
  TrendingDown, 
  SlidersHorizontal,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AssetsViewProps {
  financeState: FinanceAppState;
  onUpdateState: (state: FinanceAppState) => void;
}

export function AssetsView({ financeState, onUpdateState }: AssetsViewProps) {
  // Navigation between ledger and smart diagnosis
  const [activeTab, setActiveTab] = useState<'ledger' | 'diagnosis'>('ledger');
  
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [showAddCrypto, setShowAddCrypto] = useState(false);

  // New deposit inputs
  const [depName, setDepName] = useState('');
  const [depAmount, setDepAmount] = useState('');
  const [depRate, setDepRate] = useState('');

  // New crypto inputs
  const [cryCoin, setCryCoin] = useState('BTC');
  const [cryAmount, setCryAmount] = useState('');
  const [cryPrice, setCryPrice] = useState('');

  // Interactive Prepaid Loan Simulator State
  const [simulatedPrepay, setSimulatedPrepay] = useState<number>(50000); // default 50k simulation
  const [simulationTarget, setSimulationTarget] = useState<'house' | 'car'>('house');

  // 1. Calculate dynamic values for actual state
  const savingsAmount = financeState.savings.reduce((acc, s) => acc + s.amount, 0);
  const cryptoAmount = financeState.cryptos.reduce((acc, c) => acc + c.amount * c.price, 0);
  
  // Property net equity & parameters
  const houseEntity = financeState.property;
  const isHouseActive = !!houseEntity;
  const houseBuyPriceVal = houseEntity?.buyingPrice ?? 0;
  const houseCurrentVal = houseEntity?.currentValue ?? 0;
  const houseFullyPaid = houseEntity?.isFullyPaid ?? false;
  const houseLoanVal = houseEntity && !houseFullyPaid ? houseEntity.loanBalance : 0;
  const housePayVal = houseEntity && !houseFullyPaid ? houseEntity.monthlyPayment : 0;
  const houseRateVal = houseEntity?.loanRate ?? 3.8;
  const houseTotalTerms = houseEntity?.totalLoanTerms ?? 360;
  const houseRemainTerms = houseEntity?.remainingTerms ?? 240;
  const houseIsRental = houseEntity?.isRented ?? false;
  const houseRentalIncome = houseIsRental ? (houseEntity?.rentIncome ?? 0) : 0;
  
  const propertyNet = isHouseActive ? Math.max(0, houseCurrentVal - houseLoanVal) : 0;
  
  // Vehicle net equity & parameters
  const carEntity = financeState.vehicle;
  const isCarActive = !!carEntity;
  const carPurchasePrice = carEntity?.purchasePrice ?? 0;
  const carAgeVal = carEntity?.age ?? 0;
  const carDeprecRate = carEntity?.depreciationRate ?? 10;
  const carFullyPaid = carEntity?.isFullyPaid ?? false;
  const carLoanVal = carEntity && !carFullyPaid ? carEntity.loanBalance : 0;
  const carPayVal = carEntity && !carFullyPaid ? carEntity.monthlyPayment : 0;
  const carRateVal = carEntity?.loanRate ?? 4.5;
  const carTotalTerms = carEntity?.totalLoanTerms ?? 60;
  const carRemainTerms = carEntity?.remainingTerms ?? 36;
  
  let carCurrentValue = 0;
  if (isCarActive) {
    carCurrentValue = carPurchasePrice * Math.pow(1 - carDeprecRate / 100, carAgeVal);
  }
  const carNet = isCarActive ? Math.max(0, carCurrentValue - carLoanVal) : 0;

  // Pie chart data
  const chartData = [
    { name: '银行存款/理财', value: savingsAmount },
    { name: '虚拟加密货币', value: cryptoAmount },
    { name: '自持房产净值', value: propertyNet },
    { name: '自驾车辆残值净股', value: carNet },
    { name: '商业险金价值', value: financeState.insuranceCashValue },
  ].filter(item => item.value > 0);

  const renderData = chartData.length ? chartData : [{ name: '无记录(待补充)', value: 10000 }];

  const netAssetsResult = calcNetAssets(financeState, getAccountsNetBalance());
  const totalAssetsValue = savingsAmount + cryptoAmount + propertyNet + carNet + financeState.insuranceCashValue;
  const totalLiabilities = houseLoanVal + carLoanVal + financeState.otherLiabilities;
  const netWorthValue = netAssetsResult.net;

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8'];

  // DIAGNOSTIC CORE COMPUTING
  const userIncomeValue = financeState.profile.monthlyNetSalary + houseRentalIncome;
  const totalMonthlyDebts = housePayVal + carPayVal;
  const debtRatio = userIncomeValue > 0 ? (totalMonthlyDebts / userIncomeValue) : 0;
  
  // Is Car in negative equity default criteria
  const isCarNegativeEquity = isCarActive && !carFullyPaid && (carCurrentValue < carLoanVal);
  
  // Health Score Formula
  let healthScore = 100;
  if (debtRatio > 0.5) {
    healthScore -= 30;
  } else if (debtRatio > 0.3) {
    healthScore -= 15;
  } else if (debtRatio > 0.05) {
    healthScore -= 5;
  }

  if (isCarNegativeEquity) {
    healthScore -= 15;
  }

  if (isHouseActive && !houseFullyPaid && houseRateVal > 4.5) {
    healthScore -= 10;
  }
  if (isCarActive && !carFullyPaid && carRateVal > 5.5) {
    healthScore -= 8;
  }

  const liquidReserves = savingsAmount;
  const monthlyOutflows = totalMonthlyDebts + 3500; // estimated standard cost
  if (liquidReserves < monthlyOutflows * 3) {
    healthScore -= 15;
  } else if (liquidReserves >= monthlyOutflows * 6) {
    healthScore += 5;
  }

  healthScore = Math.max(30, Math.min(100, healthScore));

  let healthLevel = '稳健绿洲系 🟢';
  let healthColor = 'text-emerald-500 bg-emerald-50 border-emerald-100';
  let healthDesc = '您的核心资产健康度极高，债务抗跌能效处于高冗余区间。';
  if (healthScore < 60) {
    healthLevel = '债务警戒等级 🚨';
    healthColor = 'text-rose-600 bg-rose-50 border-rose-150';
    healthDesc = '重度负债红线区！利息损耗极大且现金流告急，急需削减车、房重资产杠杆。';
  } else if (healthScore < 80) {
    healthLevel = '中度承压诊候 ⚠️';
    healthColor = 'text-amber-600 bg-amber-50 border-amber-100';
    healthDesc = '房车分期占用了近半收入，现金流容错空间有限，建议优化多项房车资产。';
  }

  // INTERACTIVE WHAT-IF LOAN SIMULATOR COMPUTATION
  let simulatedRemainingDebt = 0;
  let simulatedInterestSaving = 0;
  let simulatedNewMonthlyPay = 0;
  let simulatedNewDebtRatio = 0;
  let simulatedNewHealthScore = healthScore;

  if (simulationTarget === 'house' && isHouseActive && !houseFullyPaid) {
    const curLoan = houseLoanVal;
    const maxPrepay = Math.min(simulatedPrepay, curLoan);
    simulatedRemainingDebt = Math.max(0, curLoan - maxPrepay);
    // Interest saved estimate = prepay * rate * remainingYears * discount factor (declining balance)
    const houseRemainYears = houseRemainTerms / 12;
    simulatedInterestSaving = maxPrepay * (houseRateVal / 100) * houseRemainYears * 0.70;
    simulatedNewMonthlyPay = curLoan > 0 ? Math.round(housePayVal * (simulatedRemainingDebt / curLoan)) : 0;
    
    const newTotalDebts = simulatedNewMonthlyPay + carPayVal;
    simulatedNewDebtRatio = userIncomeValue > 0 ? (newTotalDebts / userIncomeValue) : 0;
    
    // Recalculate health score for simulation
    let simScore = 100;
    if (simulatedNewDebtRatio > 0.5) simScore -= 30;
    else if (simulatedNewDebtRatio > 0.3) simScore -= 15;
    else if (simulatedNewDebtRatio > 0.05) simScore -= 5;
    if (isCarNegativeEquity) simScore -= 15;
    if (liquidReserves < monthlyOutflows * 3) simScore -= 15;
    simulatedNewHealthScore = Math.max(30, Math.min(100, simScore));

  } else if (simulationTarget === 'car' && isCarActive && !carFullyPaid) {
    const curLoan = carLoanVal;
    const maxPrepay = Math.min(simulatedPrepay, curLoan);
    simulatedRemainingDebt = Math.max(0, curLoan - maxPrepay);
    const carRemainYears = carRemainTerms / 12;
    simulatedInterestSaving = maxPrepay * (carRateVal / 100) * carRemainYears * 0.85;
    simulatedNewMonthlyPay = curLoan > 0 ? Math.round(carPayVal * (simulatedRemainingDebt / curLoan)) : 0;

    const newTotalDebts = housePayVal + simulatedNewMonthlyPay;
    simulatedNewDebtRatio = userIncomeValue > 0 ? (newTotalDebts / userIncomeValue) : 0;
    
    let simScore = 100;
    if (simulatedNewDebtRatio > 0.5) simScore -= 30;
    else if (simulatedNewDebtRatio > 0.3) simScore -= 15;
    else if (simulatedNewDebtRatio > 0.05) simScore -= 5;
    const simCarNetVal = carCurrentValue - simulatedRemainingDebt;
    const simCarNegativeEquity = carCurrentValue < simulatedRemainingDebt;
    if (simCarNegativeEquity) simScore -= 15;
    if (liquidReserves < monthlyOutflows * 3) simScore -= 15;
    simulatedNewHealthScore = Math.max(30, Math.min(100, simScore));
  }

  // Handlers for manual additions
  const handleAddSavings = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depAmount);
    const r = parseFloat(depRate) || 0;
    if (!depName || isNaN(amt) || amt <= 0) return;

    const newDepItem: SavingEntity = {
      id: Date.now().toString(),
      name: depName,
      amount: amt,
      annualRate: r
    };

    const updatedState: FinanceAppState = {
      ...financeState,
      savings: [...financeState.savings, newDepItem],
    };

    onUpdateState(updatedState);
    setDepName('');
    setDepAmount('');
    setDepRate('');
    setShowAddDeposit(false);
  };

  const handleDeleteSavings = (id: string) => {
    const updatedState: FinanceAppState = {
      ...financeState,
      savings: financeState.savings.filter(s => s.id !== id),
    };
    onUpdateState(updatedState);
  };

  const handleAddCrypto = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(cryAmount);
    const pr = parseFloat(cryPrice);
    if (isNaN(amt) || amt <= 0 || isNaN(pr) || pr <= 0) return;

    const newCryptoItem: CryptoEntity = {
      id: Date.now().toString(),
      coin: cryCoin.toUpperCase(),
      amount: amt,
      price: pr
    };

    const updatedState: FinanceAppState = {
      ...financeState,
      cryptos: [...financeState.cryptos, newCryptoItem],
    };

    onUpdateState(updatedState);
    setCryAmount('');
    setCryPrice('');
    setShowAddCrypto(false);
  };

  const handleDeleteCrypto = (id: string) => {
    const updatedState: FinanceAppState = {
      ...financeState,
      cryptos: financeState.cryptos.filter(c => c.id !== id),
    };
    onUpdateState(updatedState);
  };

  return (
    <div id="assets-view-root" className="p-4 space-y-4 max-w-sm mx-auto w-full text-left">
      
      {/* Visual Identity Header */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">资产与负债医生</h3>
          <p className="text-[10px] text-slate-400 font-medium">全生命资产负债智能评测与优化决策</p>
        </div>
        <div className="bg-slate-100/50 p-1 rounded-xl border border-slate-100 flex items-center gap-1 text-[9px] font-bold text-indigo-600">
          <Sparkles size={11} className="animate-spin text-indigo-500" />
          <span>哲学 5 专属智案</span>
        </div>
      </div>

      {/* High-fidelity Tab Switcher */}
      <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/40 relative">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-1 ${
            activeTab === 'ledger'
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>📊 个人财富清单</span>
        </button>
        <button
          onClick={() => setActiveTab('diagnosis')}
          className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 relative ${
            activeTab === 'diagnosis'
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>🩺 智能诊断与优化建议</span>
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'ledger' ? (
          <motion.div
            key="ledger-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Net wealth snap card */}
            <Card className="shadow-sm border border-slate-150 bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4 rounded-3xl relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-32 h-32 bg-white/5 rounded-full" />
              <div className="relative z-10 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-indigo-300 font-extrabold tracking-wider uppercase">我的个人净资产估值</span>
                    <h2 className="text-2xl font-black font-mono tracking-tight">¥{netWorthValue.toLocaleString(undefined, { minimumFractionDigits: 1 })}</h2>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-lg text-[9px] font-bold">
                    净资产口径
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 text-[10px] text-indigo-200/80 border-t border-white/10">
                  <div>
                    <span className="text-indigo-300 font-semibold">总计持有资产量:</span>
                    <p className="font-extrabold text-white font-mono text-xs mt-0.5">¥{totalAssetsValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-rose-350 font-semibold">房车及外借负债:</span>
                    <p className="font-extrabold text-rose-300 font-mono text-xs mt-0.5">¥{totalLiabilities.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Allocation Recharts */}
            <Card className="shadow-sm border border-slate-100 bg-white rounded-2xl">
              <CardContent className="p-3">
                <span className="text-[10px] font-bold text-slate-400 block px-1">本期持有资产成份分布比例</span>
                <div className="h-[170px] w-full mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={renderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        fill="#8884d8"
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {renderData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `¥${Math.round(value).toLocaleString()}`} />
                      <Legend iconSize={7} wrapperStyle={{ fontSize: '8px', fontWeight: 'bold' }} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* REAL ESTATE & AUTOMOBILE SUMMARIES IN清单 */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block px-1">🏠 自有大件实物资产</span>
              
              {/* House card in list */}
              {isHouseActive ? (
                <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-1.5 hover:shadow-md transition">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">🏠</span>
                      <span className="font-extrabold text-xs text-slate-800">房产: {houseEntity.address.substring(0, 8)}...</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-600">
                      {houseFullyPaid ? '已全款付清' : '组合商业贷销售中'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 border-t border-slate-50 pt-1.5 font-sans">
                    <div>
                      <p className="text-[8px] text-slate-350">购入原价</p>
                      <span className="font-bold text-slate-700 font-mono">¥{(houseBuyPriceVal/10000).toFixed(0)}万</span>
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-350">市场参考折估</p>
                      <span className="font-bold text-blue-600 font-mono">¥{(houseCurrentVal/10000).toFixed(0)}万</span>
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-350">房净产值权益</p>
                      <span className="font-black text-emerald-600 font-mono">¥{(propertyNet/10000).toFixed(1)}万</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center text-[10px] text-slate-400">
                  名下无登记自持房产，可在个人中心添加房产实体
                </div>
              )}

              {/* Car card in list */}
              {isCarActive ? (
                <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-1.5 hover:shadow-md transition">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">🚗</span>
                      <span className="font-extrabold text-xs text-slate-800">爱车: {carEntity.name}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-600">
                      {carFullyPaid ? '全款无债' : '车贷未完期'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 border-t border-slate-50 pt-1.5 font-sans">
                    <div>
                      <p className="text-[8px] text-slate-350">买入价格</p>
                      <span className="font-bold text-slate-700 font-mono">¥{(carPurchasePrice/10000).toFixed(1)}万</span>
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-350">贬值折后残值</p>
                      <span className="font-bold text-amber-600 font-mono">¥{(carCurrentValue/10000).toFixed(1)}万</span>
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-350">净车自权益</p>
                      <span className="font-black text-emerald-600 font-mono">¥{(carNet/10000).toFixed(1)}万</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center text-[10px] text-slate-400">
                  名下无登记自持车产，可在个人中心添加车辆资产
                </div>
              )}
            </div>

            {/* BANK DEPOSITS & CASH ACCURATED MANAGER */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Landmark size={12} className="text-emerald-500" />
                  <span>🏦 定期与银行存款理财</span>
                </span>
                <button 
                  onClick={() => setShowAddDeposit(true)}
                  className="text-[9px] text-blue-600 font-black bg-blue-100/60 hover:bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1"
                >
                  <Plus size={10} /> 存入登记
                </button>
              </div>

              <div className="space-y-2">
                {financeState.savings.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-[10px] text-slate-400">
                    尚无存款记录。点击登记一笔，将按预估年利率自动派息滚动！
                  </div>
                ) : (
                  financeState.savings.map(s => (
                    <div key={s.id} className="p-3 rounded-2xl bg-white border border-slate-100 flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                          💰
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800 text-xs">{s.name}</h5>
                          <p className="text-[9px] text-slate-400 mt-0.5">预估年化利率: {s.annualRate}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-slate-700 font-mono">¥{s.amount.toLocaleString()}</span>
                        <button onClick={() => handleDeleteSavings(s.id)} className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CRYPTO CURRENCY MANAGER */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Coins size={12} className="text-amber-500" />
                  <span>₿ 加密虚拟资产配置</span>
                </span>
                <button 
                  onClick={() => setShowAddCrypto(true)}
                  className="text-[9px] text-blue-600 font-black bg-blue-100/60 hover:bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1"
                >
                  <Plus size={10} /> 增持登记
                </button>
              </div>

              <div className="space-y-2">
                {financeState.cryptos.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-[10px] text-slate-400">
                    暂未持有比特币等数字货币。可在资产总管配置中增设。
                  </div>
                ) : (
                  financeState.cryptos.map(c => (
                    <div key={c.id} className="p-3 rounded-2xl bg-white border border-slate-100 flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                          🪙
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800 text-xs">{c.coin}</h5>
                          <p className="text-[9px] text-slate-400 mt-0.5">持仓数 {c.amount} • 单价 ¥{c.price.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-slate-700 font-mono">¥{Math.round(c.amount * c.price).toLocaleString()}</span>
                        <button onClick={() => handleDeleteCrypto(c.id)} className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="diagnosis-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Visual Medical Health score Card */}
            <Card className="shadow-sm border border-slate-100 bg-white rounded-3xl p-5 text-center space-y-4">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-1">🏥 个人财富资产债务体检分数</span>
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                    <circle cx="48" cy="48" r="40" 
                      stroke={healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444'} 
                      strokeWidth="8" 
                      fill="transparent" 
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * healthScore) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col justify-center items-center">
                    <span className="text-3xl font-black font-mono tracking-tight text-slate-800">{healthScore}</span>
                    <span className="text-[8px] font-black text-slate-400">HEALTH LEVEL</span>
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-2xl border ${healthColor} text-left space-y-1.5`}>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-extrabold flex items-center gap-1">
                    <Activity size={12} />
                    诊断结论: {healthLevel}
                  </span>
                </div>
                <p className="text-[10px] font-medium leading-relaxed opacity-95">{healthDesc}</p>
              </div>

              {/* Core quick financial ratio stats */}
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <span className="text-[8px] text-slate-400 font-bold block">月供还贷收入比</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-sm font-black font-mono text-slate-700">{(debtRatio * 100).toFixed(0)}%</span>
                    <span className={`text-[8px] font-extrabold ${debtRatio > 0.5 ? 'text-rose-500' : debtRatio > 0.3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {debtRatio > 0.5 ? '高压红线' : debtRatio > 0.3 ? '中度负荷' : '轻盈舒缓'}
                    </span>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <span className="text-[8px] text-slate-400 font-bold block">现金流备用金倍数</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-sm font-black font-mono text-slate-700">{(savingsAmount / Math.max(1, (totalMonthlyDebts + 3000))).toFixed(1)}x</span>
                    <span className={`text-[8px] font-extrabold ${(savingsAmount / Math.max(1, (totalMonthlyDebts + 3000))) < 3 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {(savingsAmount / Math.max(1, (totalMonthlyDebts + 3000))) < 3 ? '警戒不足' : '充裕稳健'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* SECTION: Targeted Advice & Treatments */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 block px-1 tracking-wider uppercase">🩺 诊疗处方: 资产专属调优路径</span>
              
              {/* Advice 1: Real Estate Refinancing and Tax Offset */}
              {isHouseActive ? (
                <div className="p-3.5 bg-white rounded-2xl border border-slate-150/80 shadow-sm space-y-2">
                  <div className="flex justify-between items-center pb-1.5 border-b border-indigo-50">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">🏠</span>
                      <h4 className="font-extrabold text-slate-800 text-xs">房产专项处方 (RefinanceLink)</h4>
                    </div>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black bg-indigo-50 text-indigo-600">
                      首套住房利息专项扣除
                    </span>
                  </div>

                  <div className="space-y-2 text-[10px] leading-relaxed text-slate-600">
                    {houseFullyPaid ? (
                      <p className="font-medium text-emerald-600">
                        🎉 名下该房产已无任何贷款纠纷，负债结构极好！自主持有净值 ¥{(propertyNet/10000).toFixed(0)}万，极大拉升了个人抗高压能力。
                      </p>
                    ) : (
                      <>
                        <div className="p-2 bg-indigo-50/50 rounded-xl space-y-1">
                          <p className="font-extrabold text-indigo-950 flex items-center gap-1">
                            <Sparkles size={11} className="text-indigo-500" />
                            <span>省钱策略：个税专项附加扣除</span>
                          </p>
                          <p className="text-[9px] text-indigo-800">
                            已检测到您存在商贷未完结。**重要提醒：**请在个人所得税 App 内，填报**首套住房贷款利息专项附加扣除**（每月享受 1,000 元税前扣除额度），根据您的工资，预计每年可直接返现 **¥{(12000 * 0.10).toFixed(0)} ~ ¥3,600** 的纯现金红利。
                          </p>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="font-bold text-slate-700">
                            🔍 利率诊断：当前房贷协议执行利率为 <span className="text-blue-600 font-mono font-bold">{houseRateVal}%</span>
                          </p>
                          <p className="text-slate-500 text-[9px]">
                            {houseRateVal > 4.1 ? (
                              <span>当前市场存量房贷 LPR 正值低重定价区间（多数重定价为 3.4~3.7%），您的执行汇率偏高！建议持身份证向贷款银行客服热线咨询办理转低 LPR 浮动或提前还本金，避免无谓的高额年终利损。</span>
                            ) : (
                              <span>您房贷执行利率处于低利率健康周期。无需大幅提前结清本金，可将积蓄配置于更优高股息投资或存款，放大息差被动创收。</span>
                            )}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Advice 2: Car Residuals and Negative Equity Warning */}
              {isCarActive ? (
                <div className="p-3.5 bg-white rounded-2xl border border-slate-150/80 shadow-sm space-y-2">
                  <div className="flex justify-between items-center pb-1.5 border-b border-emerald-50">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">🚗</span>
                      <h4 className="font-extrabold text-slate-800 text-xs">车产折旧诊治 (LiquidCheck)</h4>
                    </div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${isCarNegativeEquity ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {isCarNegativeEquity ? '危险：车产资不抵债' : '车辆估损健康'}
                    </span>
                  </div>

                  <div className="space-y-2 text-[10px] leading-relaxed text-slate-600">
                    <div className="flex justify-between text-[9px] text-slate-400 bg-slate-50 p-2 rounded-xl">
                      <div>
                        <span>买入原价及当前估残值:</span>
                        <p className="font-extrabold text-slate-700 mt-0.5 font-mono">¥{(carPurchasePrice).toLocaleString()} → ¥{Math.round(carCurrentValue).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <span>年度自贬值扣费:</span>
                        <p className="font-extrabold text-rose-500 mt-0.5 font-mono">-{carDeprecRate}% / 年</p>
                      </div>
                    </div>

                    {carFullyPaid ? (
                      <p className="font-medium text-emerald-600">
                        🎉 爱车已全款买下，无月度现金流流出之忧。但每年汽车以 ¥{Math.round(carCurrentValue * carDeprecRate / 100)} 的折旧流失。车是高质消耗品，不建议在自驾外追加任何大型商用车贷，谨防被动破产。
                      </p>
                    ) : (
                      <>
                        {isCarNegativeEquity ? (
                          <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl space-y-1 text-rose-900">
                            <p className="font-extrabold flex items-center gap-1">
                              <AlertTriangle size={11} className="text-rose-500" />
                              <span>严重警告：资产贬值跑输贷款余额</span>
                            </p>
                            <p className="text-[9px] text-rose-700 leading-normal">
                              您的爱车当前残值已跌至¥{Math.round(carCurrentValue).toLocaleString()}，已低于您尚欠的车贷余额 **¥{carLoanVal.toLocaleString()}**！车贷往往具有高复利率、低重定价的商业特性，建议一有大笔闲散款项，优先把该高利车贷付清，清除这一负资本损耗大块头。
                            </p>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-[9px]">
                            目前车辆残值 ¥{Math.round(carCurrentValue).toLocaleString()} 尚大于未还借款 ¥{carLoanVal.toLocaleString()}。但由于车辆贬值极速，折旧流失不容小觑。建议到手积蓄充裕时平移小贷，切莫为了追求享受盲目置换升级导致中产财务重返谷底。
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Advice 3: General debt optimizations if no assets registered */}
              {!isHouseActive && !isCarActive && (
                <div className="p-3.5 bg-white rounded-2xl border border-slate-100 text-center text-slate-400 text-[10px] space-y-1.5">
                  <p>🩺 智能体检发现您非常清爽，没有任何车贷房贷等重压杠杆型负债！</p>
                  <p className="text-[9px] text-slate-400 font-semibold text-emerald-600">
                    “无债一身轻”是极高的人生被动防险衣。建议您将富余月薪的多余资金，划归 70% 作为定期或稳健理财（见资产管理登记），30% 寻找周期高分红标的，完成复利裂变。
                  </p>
                </div>
              )}
            </div>

            {/* INTERACTIVE WHAT-IF SIMULATOR WIDGET */}
            {((isHouseActive && !houseFullyPaid) || (isCarActive && !carFullyPaid)) && (
              <Card className="shadow-sm border border-indigo-100 bg-indigo-50/40 rounded-3xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1 border-0">
                    <SlidersHorizontal size={13} className="text-indigo-600 block" />
                    <span className="text-xs font-black text-indigo-950">A/B 提前还贷大额减负仿真器</span>
                  </div>
                  <span className="text-[8px] bg-indigo-200/50 text-indigo-800 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    哲学 1 标准还原
                  </span>
                </div>

                <p className="text-[9px] text-slate-400 leading-tight">
                  拖拽金额，动态仿真如果您拿出手头的年终奖或储蓄去**提前偿还一部分本金**，您的月度还款压强和健康分数会起何种变化：
                </p>

                {/* Target Select */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-[10px]">
                  {isHouseActive && !houseFullyPaid && (
                    <button
                      onClick={() => {
                        setSimulationTarget('house');
                        setSimulatedPrepay(Math.min(50000, houseLoanVal));
                      }}
                      className={`py-1.5 text-center font-bold rounded-lg transition-colors ${simulationTarget === 'house' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}
                    >
                      🏠 房产商业贷
                    </button>
                  )}
                  {isCarActive && !carFullyPaid && (
                    <button
                      onClick={() => {
                        setSimulationTarget('car');
                        setSimulatedPrepay(Math.min(30000, carLoanVal));
                      }}
                      className={`col-span-1 py-1.5 text-center font-bold rounded-lg transition-colors ${simulationTarget === 'car' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}
                    >
                      🚗 车辆分期借
                    </button>
                  )}
                </div>

                {/* Interactive Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] pb-1">
                    <span className="font-bold text-slate-500">模拟大额偿还本金金额:</span>
                    <span className="font-extrabold text-indigo-700 font-mono text-xs">¥{simulatedPrepay.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="10000"
                    max={simulationTarget === 'house' ? houseLoanVal : carLoanVal}
                    step="5000"
                    value={simulatedPrepay}
                    onChange={(e) => setSimulatedPrepay(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                    <span>¥10,000</span>
                    <span>最大可还额 (¥{(simulationTarget === 'house' ? houseLoanVal : carLoanVal).toLocaleString()})</span>
                  </div>
                </div>

                {/* Results Screen */}
                <div className="p-3 bg-white rounded-2xl border border-indigo-100/40 space-y-2 text-[10px]">
                  <div className="flex justify-between items-center text-slate-500 border-b border-indigo-50/50 pb-1.5">
                    <span>剩余债务变动</span>
                    <span className="font-mono text-slate-700 font-bold">
                      ¥{(simulationTarget === 'house' ? houseLoanVal : carLoanVal).toLocaleString()} → <span className="text-emerald-600">¥{Math.round(simulatedRemainingDebt).toLocaleString()}</span>
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-500 border-b border-indigo-50/50 pb-1.5">
                    <span>利息立省损耗评估</span>
                    <span className="font-mono font-black text-rose-500">
                      立减约 ¥{Math.round(simulatedInterestSaving).toLocaleString()} 利息纯损！
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-500 border-b border-indigo-50/50 pb-1.5">
                    <span>月供重构减负比</span>
                    <span className="font-mono text-slate-700 font-bold">
                      ¥{simulationTarget === 'house' ? housePayVal : carPayVal} → <span className="text-emerald-600 font-black">¥{simulatedNewMonthlyPay}/月</span>
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-indigo-900 bg-indigo-50 p-2 rounded-xl text-[9px] font-bold">
                    <span className="flex items-center gap-1">
                      <Sparkles size={11} className="text-indigo-500 animate-pulse" />
                      评分与压力度改善
                    </span>
                    <span>
                      杠杆比: {(debtRatio * 100).toFixed(0)}% → <span className="text-emerald-600 font-extrabold font-mono">{(simulatedNewDebtRatio * 100).toFixed(0)}%</span> • 
                      健康分: {healthScore} → <span className="text-emerald-600 font-extrabold font-mono">{simulatedNewHealthScore}分</span>
                    </span>
                  </div>
                </div>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL WINDOW 1: ADD BANK DEPOSIT */}
      <AnimatePresence>
        {showAddDeposit && (
          <div className="absolute inset-0 bg-slate-900/60 z-50 flex items-end">
            <motion.form 
              onSubmit={handleAddSavings}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-white rounded-t-3xl p-6 space-y-4 shadow-2xl z-50 text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-extrabold text-slate-900 text-sm">登记存款与年利收益</h4>
                <button type="button" onClick={() => setShowAddDeposit(false)} className="p-1 hover:bg-slate-100 rounded-full">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">存款产品名称 / 类别</label>
                  <input type="text" value={depName} onChange={e => setDepName(e.target.value)} placeholder="如「招商银行定期三年」" className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold focus:outline-none" required />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">存入本金 (元)</label>
                    <input type="number" value={depAmount} onChange={e => setDepAmount(e.target.value)} placeholder="80000" className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold focus:outline-none" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">协议年收益率 (%)</label>
                    <input type="number" step="0.01" value={depRate} onChange={e => setDepRate(e.target.value)} placeholder="2.2" className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold focus:outline-none" />
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full py-3 bg-slate-900 border-0 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition">
                保 存 储 蓄
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL WINDOW 2: ADD CRYPTO ASSET */}
      <AnimatePresence>
        {showAddCrypto && (
          <div className="absolute inset-0 bg-slate-900/60 z-50 flex items-end">
            <motion.form 
              onSubmit={handleAddCrypto}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-white rounded-t-3xl p-6 space-y-4 shadow-2xl z-50 text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-extrabold text-slate-900 text-sm">登记新增持加密资产</h4>
                <button type="button" onClick={() => setShowAddCrypto(false)} className="p-1 hover:bg-slate-100 rounded-full">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">主流行情币种 Symbol</label>
                  <select value={cryCoin} onChange={e => setCryCoin(e.target.value)} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold">
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="SOL">Solana (SOL)</option>
                    <option value="USDT">Tether (USDT)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">持有代币总数量</label>
                    <input type="number" step="0.00001" value={cryAmount} onChange={e => setCryAmount(e.target.value)} placeholder="0.25" className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold focus:outline-none" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">当前行情折合人民币价值</label>
                    <input type="number" value={cryPrice} onChange={e => setCryPrice(e.target.value)} placeholder="470000" className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold focus:outline-none" required />
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full py-3 bg-slate-900 border-0 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition">
                确 认 资 产
              </button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
