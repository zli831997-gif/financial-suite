import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import {
  FinanceAppState,
  SavingEntity,
  CryptoEntity,
} from '@finance/utils/financeState';
import { calcNetAssets } from '@finance/logic/calc/netAssets';
import { getAccountsNetBalance } from '@finance/logic/domain/accounts';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import { MiniPie } from '../../components/MiniChart';
import { confirmAsync } from '../../utils/platform';
import './index.css';

/**
 * 跨端资产页（移植自上游 AssetsView，923行）。
 * 改造点：
 * - onUpdateState → storage.set(KEYS.APP_STATE)（跨端页自取自存）
 * - recharts 环形饼图 → MiniPie
 * - motion/AnimatePresence → 条件渲染
 * - healthScore 公式 + 仿真器逻辑原样保留
 * - lucide → Icon；div/input/form → View/Input
 */

function fmt(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

export default function Assets() {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);
  void version;

  // 写回 financeState（替代上游 onUpdateState）
  const updateState = (next: FinanceAppState) => {
    storage.set(KEYS.APP_STATE, next);
    refresh();
  };

  const [activeTab, setActiveTab] = useState<'ledger' | 'diagnosis'>('ledger');
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [showAddCrypto, setShowAddCrypto] = useState(false);
  const [depName, setDepName] = useState('');
  const [depAmount, setDepAmount] = useState('');
  const [depRate, setDepRate] = useState('');
  const [cryCoin, setCryCoin] = useState('BTC');
  const [cryAmount, setCryAmount] = useState('');
  const [cryPrice, setCryPrice] = useState('');
  const [simulatedPrepay, setSimulatedPrepay] = useState(50000);
  const [simulationTarget, setSimulationTarget] = useState<'house' | 'car'>('house');

  // 资产计算
  const savingsAmount = (financeState.savings || []).reduce((acc, s) => acc + s.amount, 0);
  const cryptoAmount = (financeState.cryptos || []).reduce((acc, c) => acc + c.amount * c.price, 0);

  const houseEntity = financeState.property;
  const isHouseActive = !!houseEntity;
  const houseCurrentVal = houseEntity?.currentValue ?? 0;
  const houseFullyPaid = houseEntity?.isFullyPaid ?? false;
  const houseLoanVal = houseEntity && !houseFullyPaid ? houseEntity.loanBalance : 0;
  const housePayVal = houseEntity && !houseFullyPaid ? houseEntity.monthlyPayment : 0;
  const houseRateVal = houseEntity?.loanRate ?? 3.8;
  const houseRemainTerms = houseEntity?.remainingTerms ?? 240;
  const houseIsRental = houseEntity?.isRented ?? false;
  const houseRentalIncome = houseIsRental ? (houseEntity?.rentIncome ?? 0) : 0;
  const propertyNet = isHouseActive ? Math.max(0, houseCurrentVal - houseLoanVal) : 0;

  const carEntity = financeState.vehicle;
  const isCarActive = !!carEntity;
  const carPurchasePrice = carEntity?.purchasePrice ?? 0;
  const carAgeVal = carEntity?.age ?? 0;
  const carDeprecRate = carEntity?.depreciationRate ?? 10;
  const carFullyPaid = carEntity?.isFullyPaid ?? false;
  const carLoanVal = carEntity && !carFullyPaid ? carEntity.loanBalance : 0;
  const carPayVal = carEntity && !carFullyPaid ? carEntity.monthlyPayment : 0;
  const carRateVal = carEntity?.loanRate ?? 4.5;
  const carRemainTerms = carEntity?.remainingTerms ?? 36;
  const carCurrentValue = isCarActive ? carPurchasePrice * Math.pow(1 - carDeprecRate / 100, carAgeVal) : 0;
  const carNet = isCarActive ? Math.max(0, carCurrentValue - carLoanVal) : 0;

  // 饼图数据
  const COLORS: Record<number, string> = { 0: '#10b981', 1: '#f59e0b', 2: '#3b82f6', 3: '#8b5cf6', 4: '#ec4899' };
  const chartData = [
    { name: '银行存款/理财', value: savingsAmount },
    { name: '虚拟加密货币', value: cryptoAmount },
    { name: '自持房产净值', value: propertyNet },
    { name: '自驾车辆残值', value: carNet },
    { name: '商业险金价值', value: financeState.insuranceCashValue || 0 },
  ]
    .filter((item) => item.value > 0)
    .map((d, i) => ({ ...d, color: COLORS[i] || '#94a3b8' }));

  const pieData = chartData.length
    ? chartData
    : [{ name: '无记录', value: 10000, color: '#94a3b8' }];

  const netAssetsResult = calcNetAssets(financeState, getAccountsNetBalance());
  const netWorthValue = netAssetsResult.net;

  // 诊断核心计算（原样保留上游公式）
  const userIncomeValue = (financeState.profile?.monthlyNetSalary || 0) + houseRentalIncome;
  const totalMonthlyDebts = housePayVal + carPayVal;
  const debtRatio = userIncomeValue > 0 ? totalMonthlyDebts / userIncomeValue : 0;
  const isCarNegativeEquity = isCarActive && !carFullyPaid && carCurrentValue < carLoanVal;

  let healthScore = 100;
  if (debtRatio > 0.5) healthScore -= 30;
  else if (debtRatio > 0.3) healthScore -= 15;
  else if (debtRatio > 0.05) healthScore -= 5;
  if (isCarNegativeEquity) healthScore -= 15;
  if (isHouseActive && !houseFullyPaid && houseRateVal > 4.5) healthScore -= 10;
  if (isCarActive && !carFullyPaid && carRateVal > 5.5) healthScore -= 8;
  const liquidReserves = savingsAmount;
  const monthlyOutflows = totalMonthlyDebts + 3500;
  if (liquidReserves < monthlyOutflows * 3) healthScore -= 15;
  else if (liquidReserves >= monthlyOutflows * 6) healthScore += 5;
  healthScore = Math.max(30, Math.min(100, healthScore));

  let healthLevel = '稳健绿洲系 🟢';
  let healthColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
  let healthDesc = '您的核心资产健康度极高，债务抗跌能效处于高冗余区间。';
  if (healthScore < 60) {
    healthLevel = '债务警戒等级 🚨';
    healthColor = 'text-rose-600 bg-rose-50 border-rose-100';
    healthDesc = '重度负债红线区！利息损耗极大且现金流告急，急需削减车、房重资产杠杆。';
  } else if (healthScore < 80) {
    healthLevel = '中度承压诊候 ⚠️';
    healthColor = 'text-amber-600 bg-amber-50 border-amber-100';
    healthDesc = '房车分期占用了近半收入，现金流容错空间有限，建议优化多项房车资产。';
  }

  // 仿真器
  let simulatedRemainingDebt = 0;
  let simulatedInterestSaving = 0;
  let simulatedNewMonthlyPay = 0;
  let simulatedNewHealthScore = healthScore;

  if (simulationTarget === 'house' && isHouseActive && !houseFullyPaid) {
    const curLoan = houseLoanVal;
    const maxPrepay = Math.min(simulatedPrepay, curLoan);
    simulatedRemainingDebt = Math.max(0, curLoan - maxPrepay);
    const houseRemainYears = houseRemainTerms / 12;
    simulatedInterestSaving = maxPrepay * (houseRateVal / 100) * houseRemainYears * 0.7;
    simulatedNewMonthlyPay = curLoan > 0 ? Math.round(housePayVal * (simulatedRemainingDebt / curLoan)) : 0;
    const newTotalDebts = simulatedNewMonthlyPay + carPayVal;
    const simulatedNewDebtRatio = userIncomeValue > 0 ? newTotalDebts / userIncomeValue : 0;
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
    const simulatedNewDebtRatio = userIncomeValue > 0 ? newTotalDebts / userIncomeValue : 0;
    let simScore = 100;
    if (simulatedNewDebtRatio > 0.5) simScore -= 30;
    else if (simulatedNewDebtRatio > 0.3) simScore -= 15;
    else if (simulatedNewDebtRatio > 0.05) simScore -= 5;
    if (carCurrentValue < simulatedRemainingDebt) simScore -= 15;
    if (liquidReserves < monthlyOutflows * 3) simScore -= 15;
    simulatedNewHealthScore = Math.max(30, Math.min(100, simScore));
  }

  // CRUD handlers
  const handleAddSavings = () => {
    const amt = parseFloat(depAmount);
    const r = parseFloat(depRate) || 0;
    if (!depName || isNaN(amt) || amt <= 0) return;
    const newDepItem: SavingEntity = { id: Date.now().toString(), name: depName, amount: amt, annualRate: r };
    updateState({ ...financeState, savings: [...(financeState.savings || []), newDepItem] });
    setDepName('');
    setDepAmount('');
    setDepRate('');
    setShowAddDeposit(false);
  };

  const handleDeleteSavings = async (id: string) => {
    if (!(await confirmAsync('删除这条理财记录？'))) return;
    updateState({ ...financeState, savings: (financeState.savings || []).filter((s) => s.id !== id) });
  };

  const handleAddCrypto = () => {
    const amt = parseFloat(cryAmount);
    const pr = parseFloat(cryPrice);
    if (isNaN(amt) || amt <= 0 || isNaN(pr) || pr <= 0) return;
    const newCryptoItem: CryptoEntity = {
      id: Date.now().toString(),
      coin: cryCoin.toUpperCase(),
      amount: amt,
      price: pr,
    };
    updateState({ ...financeState, cryptos: [...(financeState.cryptos || []), newCryptoItem] });
    setCryAmount('');
    setCryPrice('');
    setShowAddCrypto(false);
  };

  const handleDeleteCrypto = async (id: string) => {
    if (!(await confirmAsync('删除这条加密资产？'))) return;
    updateState({ ...financeState, cryptos: (financeState.cryptos || []).filter((c) => c.id !== id) });
  };

  return (
    <View className='p-4 space-y-4 max-w-sm mx-auto w-full text-left min-h-screen bg-slate-50 pb-6'>
      <View className='flex justify-between items-center pb-1'>
        <Text className='text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5'>
          <Icon name='pieChart' size={18} className='text-rose-500' /> 资产与负债医生
        </Text>
      </View>

      {/* Tab */}
      <View className='flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100'>
        <Motion
          tapScale={0.95}
          onClick={() => setActiveTab('ledger')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl text-center ${activeTab === 'ledger' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          资产台账
        </Motion>
        <Motion
          tapScale={0.95}
          onClick={() => setActiveTab('diagnosis')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl text-center ${activeTab === 'diagnosis' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          智能诊断
        </Motion>
      </View>

      {activeTab === 'ledger' && (
        <View className='space-y-3'>
          {/* 净资产快照 */}
          <Card className='bg-gradient-to-br from-slate-900 to-slate-800 border-0 text-white'>
            <CardContent className='p-4 pt-4'>
              <Text className='text-[10px] text-slate-400 font-bold block mb-1'>当前净资产总览</Text>
              <Text className='text-2xl font-black font-mono block'>{fmt(netWorthValue)}</Text>
              <View className='flex gap-4 mt-2 text-[10px]'>
                <View>
                  <Text className='text-slate-400'>总资产 </Text>
                  <Text className='font-bold font-mono'>{fmt(netWorthValue + (houseLoanVal + carLoanVal + (financeState.otherLiabilities || 0)))}</Text>
                </View>
                <View>
                  <Text className='text-slate-400'>总负债 </Text>
                  <Text className='font-bold font-mono'>{fmt(houseLoanVal + carLoanVal + (financeState.otherLiabilities || 0))}</Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* 资产分布饼图 */}
          <Card>
            <CardContent className='p-4'>
              <Text className='text-xs font-bold text-slate-500 mb-3 block'>资产流动性分布</Text>
              <View className='flex items-center justify-around'>
                <MiniPie data={pieData} size={130} thickness={22} />
                <View className='flex flex-col gap-1.5'>
                  {pieData.map((d) => (
                    <View key={d.name} className='flex items-center gap-1.5'>
                      <View style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color }} />
                      <Text className='text-[10px] text-slate-600'>{d.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </CardContent>
          </Card>

          {/* 大件实物资产 */}
          {(isHouseActive || isCarActive) && (
            <Card>
              <CardContent className='p-4 space-y-3'>
                <Text className='text-xs font-bold text-slate-500 block'>大件实物资产</Text>
                {isHouseActive && (
                  <View className='flex justify-between bg-slate-50 rounded-xl p-2.5'>
                    <View>
                      <Text className='text-xs font-bold text-slate-700 block'>🏠 自持房产</Text>
                      <Text className='text-[9px] text-slate-400 block'>估值 ¥{houseCurrentVal.toLocaleString()} · 贷款 ¥{houseLoanVal.toLocaleString()}</Text>
                    </View>
                    <Text className='text-xs font-black text-blue-600 font-mono'>{fmt(propertyNet)}</Text>
                  </View>
                )}
                {isCarActive && (
                  <View className='flex justify-between bg-slate-50 rounded-xl p-2.5'>
                    <View>
                      <Text className='text-xs font-bold text-slate-700 block'>🚗 自驾车辆</Text>
                      <Text className='text-[9px] text-slate-400 block'>残值 ¥{Math.round(carCurrentValue).toLocaleString()} · 贷款 ¥{carLoanVal.toLocaleString()}</Text>
                    </View>
                    <Text className='text-xs font-black text-purple-600 font-mono'>{fmt(carNet)}</Text>
                  </View>
                )}
              </CardContent>
            </Card>
          )}

          {/* 银行存款理财 */}
          <Card>
            <CardContent className='p-4 space-y-3'>
              <View className='flex justify-between items-center'>
                <Text className='text-xs font-bold text-slate-500'>银行存款理财</Text>
                <Motion
                  tapScale={0.95}
                  onClick={() => setShowAddDeposit(true)}
                  className='text-[10px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5'
                >
                  ＋ 新增
                </Motion>
              </View>
              {(financeState.savings || []).length === 0 ? (
                <Text className='text-[10px] text-slate-400 text-center py-3 block'>暂无记录</Text>
              ) : (
                (financeState.savings || []).map((s) => (
                  <View key={s.id} className='flex justify-between items-center bg-slate-50 rounded-xl p-2.5'>
                    <View>
                      <Text className='text-xs font-bold text-slate-700 block'>{s.name}</Text>
                      <Text className='text-[9px] text-slate-400 block'>{s.annualRate}% 年化</Text>
                    </View>
                    <View className='flex items-center gap-2'>
                      <Text className='text-xs font-mono font-black text-emerald-600'>{fmt(s.amount)}</Text>
                      <Text className='text-rose-400' onClick={() => handleDeleteSavings(s.id)}>✕</Text>
                    </View>
                  </View>
                ))
              )}
            </CardContent>
          </Card>

          {/* 加密货币 */}
          <Card>
            <CardContent className='p-4 space-y-3'>
              <View className='flex justify-between items-center'>
                <Text className='text-xs font-bold text-slate-500'>虚拟加密货币</Text>
                <Motion
                  tapScale={0.95}
                  onClick={() => setShowAddCrypto(true)}
                  className='text-[10px] text-amber-600 font-bold bg-amber-50 border border-amber-100 rounded-lg px-2 py-0.5'
                >
                  ＋ 新增
                </Motion>
              </View>
              {(financeState.cryptos || []).length === 0 ? (
                <Text className='text-[10px] text-slate-400 text-center py-3 block'>暂无记录</Text>
              ) : (
                (financeState.cryptos || []).map((c) => (
                  <View key={c.id} className='flex justify-between items-center bg-slate-50 rounded-xl p-2.5'>
                    <View>
                      <Text className='text-xs font-bold text-slate-700 block'>{c.coin}</Text>
                      <Text className='text-[9px] text-slate-400 block'>{c.amount} 枚 @ ¥{c.price.toLocaleString()}</Text>
                    </View>
                    <View className='flex items-center gap-2'>
                      <Text className='text-xs font-mono font-black text-amber-600'>{fmt(c.amount * c.price)}</Text>
                      <Text className='text-rose-400' onClick={() => handleDeleteCrypto(c.id)}>✕</Text>
                    </View>
                  </View>
                ))
              )}
            </CardContent>
          </Card>
        </View>
      )}

      {activeTab === 'diagnosis' && (
        <View className='space-y-3'>
          {/* 健康分 */}
          <Card className={healthColor}>
            <CardContent className='p-4 text-center'>
              <Text className='text-xs font-bold block mb-1'>资产健康体检分</Text>
              <Text className='text-5xl font-black font-mono block'>{healthScore}</Text>
              <Text className='text-sm font-bold mt-1 block'>{healthLevel}</Text>
              <Text className='text-[10px] mt-2 leading-relaxed block'>{healthDesc}</Text>
            </CardContent>
          </Card>

          {/* 关键比率 */}
          <View className='grid grid-cols-2 gap-2'>
            <Card>
              <CardContent className='p-3'>
                <Text className='text-[10px] text-slate-400 font-bold block'>负债收入比</Text>
                <Text className={`text-lg font-black font-mono block ${debtRatio > 0.5 ? 'text-rose-600' : debtRatio > 0.3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {(debtRatio * 100).toFixed(0)}%
                </Text>
              </CardContent>
            </Card>
            <Card>
              <CardContent className='p-3'>
                <Text className='text-[10px] text-slate-400 font-bold block'>流动储备月数</Text>
                <Text className={`text-lg font-black font-mono block ${liquidReserves < monthlyOutflows * 3 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {monthlyOutflows > 0 ? (liquidReserves / monthlyOutflows).toFixed(1) : '∞'}
                </Text>
              </CardContent>
            </Card>
          </View>

          {/* 提前还贷仿真器 */}
          {(isHouseActive || isCarActive) && (
            <Card className='border-indigo-100'>
              <CardContent className='p-4 space-y-3'>
                <Text className='text-xs font-bold text-indigo-600 block'>⚡ 提前还贷仿真器</Text>
                <View className='flex gap-1 bg-slate-100 p-1 rounded-lg'>
                  {isHouseActive && !houseFullyPaid && (
                    <Motion
                      tapScale={0.95}
                      onClick={() => setSimulationTarget('house')}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-md text-center ${simulationTarget === 'house' ? 'bg-white text-slate-900' : 'text-slate-500'}`}
                    >
                      🏠 房贷
                    </Motion>
                  )}
                  {isCarActive && !carFullyPaid && (
                    <Motion
                      tapScale={0.95}
                      onClick={() => setSimulationTarget('car')}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-md text-center ${simulationTarget === 'car' ? 'bg-white text-slate-900' : 'text-slate-500'}`}
                    >
                      🚗 车贷
                    </Motion>
                  )}
                </View>

                <View>
                  <View className='flex justify-between mb-1'>
                    <Text className='text-[10px] text-slate-500'>提前还款金额</Text>
                    <Text className='text-sm font-black text-indigo-600 font-mono'>{fmt(simulatedPrepay)}</Text>
                  </View>
                  <View className='flex gap-1'>
                    {[20000, 50000, 100000, 200000].map((amt) => (
                      <Motion
                        key={amt}
                        tapScale={0.95}
                        onClick={() => setSimulatedPrepay(amt)}
                        className={`flex-1 py-1 text-[10px] font-bold rounded-md text-center ${simulatedPrepay === amt ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {(amt / 10000).toFixed(0)}万
                      </Motion>
                    ))}
                  </View>
                </View>

                <View className='bg-slate-50 rounded-xl p-3 space-y-1.5'>
                  <View className='flex justify-between text-[10px]'>
                    <Text className='text-slate-400'>模拟后剩余本金</Text>
                    <Text className='font-mono font-bold text-slate-700'>{fmt(simulatedRemainingDebt)}</Text>
                  </View>
                  <View className='flex justify-between text-[10px]'>
                    <Text className='text-slate-400'>模拟后月供</Text>
                    <Text className='font-mono font-bold text-slate-700'>{fmt(simulatedNewMonthlyPay)}</Text>
                  </View>
                  <View className='flex justify-between text-[10px]'>
                    <Text className='text-slate-400'>预计节省利息</Text>
                    <Text className='font-mono font-bold text-emerald-600'>{fmt(simulatedInterestSaving)}</Text>
                  </View>
                  <View className='flex justify-between text-[10px] pt-1.5 border-t border-slate-200'>
                    <Text className='text-slate-500 font-bold'>模拟后健康分</Text>
                    <Text className={`font-mono font-black ${simulatedNewHealthScore > healthScore ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {simulatedNewHealthScore}
                      {simulatedNewHealthScore > healthScore && ` ↑${simulatedNewHealthScore - healthScore}`}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          )}

          {!isHouseActive && !isCarActive && (
            <Card>
              <CardContent className='p-6 text-center'>
                <Icon name='checkCircle' size={28} className='text-emerald-500' />
                <Text className='text-xs font-bold text-slate-700 block mt-2'>暂无负债</Text>
                <Text className='text-[10px] text-slate-400 block mt-1'>无房车贷款，资产健康度天然较高</Text>
              </CardContent>
            </Card>
          )}
        </View>
      )}

      {/* 新增存款 Modal */}
      {showAddDeposit && (
        <View className='fixed inset-0 bg-slate-900/60 z-50 flex items-end'>
          <View className='w-full bg-white rounded-t-3xl p-6 space-y-3'>
            <View className='flex justify-between items-center pb-2 border-b border-slate-100'>
              <Text className='font-bold text-slate-900'>新增理财存款</Text>
              <Text className='text-slate-400 text-xl' onClick={() => setShowAddDeposit(false)}>✕</Text>
            </View>
            <Input value={depName} onInput={(e) => setDepName(e.detail.value)} placeholder='名称（如：工商定期）' className='w-full bg-slate-100 rounded-xl px-4 py-2.5 text-sm' />
            <Input type='digit' value={depAmount} onInput={(e) => setDepAmount(e.detail.value)} placeholder='金额（元）' className='w-full bg-slate-100 rounded-xl px-4 py-2.5 text-sm' />
            <Input type='digit' value={depRate} onInput={(e) => setDepRate(e.detail.value)} placeholder='年化收益率（%）' className='w-full bg-slate-100 rounded-xl px-4 py-2.5 text-sm' />
            <Motion tapScale={0.98} onClick={handleAddSavings} className='w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-sm text-center'>
              保存
            </Motion>
          </View>
        </View>
      )}

      {/* 新增加密 Modal */}
      {showAddCrypto && (
        <View className='fixed inset-0 bg-slate-900/60 z-50 flex items-end'>
          <View className='w-full bg-white rounded-t-3xl p-6 space-y-3'>
            <View className='flex justify-between items-center pb-2 border-b border-slate-100'>
              <Text className='font-bold text-slate-900'>新增加密资产</Text>
              <Text className='text-slate-400 text-xl' onClick={() => setShowAddCrypto(false)}>✕</Text>
            </View>
            <View className='flex gap-1 flex-wrap'>
              {['BTC', 'ETH', 'BNB', 'SOL'].map((coin) => (
                <Motion key={coin} tapScale={0.95} onClick={() => setCryCoin(coin)} className={`px-3 py-1 text-xs font-bold rounded-lg ${cryCoin === coin ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {coin}
                </Motion>
              ))}
            </View>
            <Input type='digit' value={cryAmount} onInput={(e) => setCryAmount(e.detail.value)} placeholder='持有数量' className='w-full bg-slate-100 rounded-xl px-4 py-2.5 text-sm' />
            <Input type='digit' value={cryPrice} onInput={(e) => setCryPrice(e.detail.value)} placeholder='当前单价（元）' className='w-full bg-slate-100 rounded-xl px-4 py-2.5 text-sm' />
            <Motion tapScale={0.98} onClick={handleAddCrypto} className='w-full py-3 bg-amber-600 text-white font-bold rounded-xl text-sm text-center'>
              保存
            </Motion>
          </View>
        </View>
      )}
    </View>
  );
}
