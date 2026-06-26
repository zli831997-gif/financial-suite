import { useState, useEffect } from 'react';
import { 
  FinanceAppState, 
  calculateProfileCompleteness, 
  reverseNetSalaryToGross, 
  reverseSocialSecurityBase, 
  SavingEntity
} from '../utils/financeState';
import { syncEntityAll } from '../utils/entitySync';
import type { GrowthState } from '../logic/domain/gamification';
import { importFromLegacy } from '../utils/legacyImport';
import { getCities } from '../logic/calc/social';
import { CHINA_PROVINCES, findProvinceByCity } from '../logic/calc/chinaCities';
import { exportData, restoreData } from '../utils/dataTransfer';
import { hasPin, setPin, verifyPin, clearPin } from '../logic/domain/pinLock';
import { storage } from '../storage';
import { KEYS } from '../storage/keys';
import { Card, CardContent } from './ui/card';
import { 
  User, 
  MapPin, 
  Banknote, 
  Calendar, 
  TrendingUp, 
  Briefcase, 
  Home, 
  Car, 
  ShieldAlert, 
  CheckCircle2, 
  HelpCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Calculator,
  Lock,
  ArrowRight,
  DollarSign,
  HeartPulse,
  Flame,
  Loader2,
  Image as ImageIcon,
  Plus,
  Trash2,
  Coins,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DataCollectionViewProps {
  financeState: FinanceAppState;
  growth: GrowthState;
  onUpdateState: (state: FinanceAppState) => void;
  onProfileBonus: (reason: string, points: number) => void;
  transactionsCount: number;
}

type TabType = 'basic' | 'property' | 'vehicle' | 'deposits' | 'insurance';

export function DataCollectionView({ financeState, growth, onUpdateState, onProfileBonus, transactionsCount }: DataCollectionViewProps) {
  // Active Tab
  const [activeSubTab, setActiveSubTab] = useState<TabType>('basic');

  // --- TAB 1: Basic Profile States ---
  const [city, setCity] = useState(financeState.profile.city);
  const [selectedProvince, setSelectedProvince] = useState(findProvinceByCity(financeState.profile.city));
  const [netSalary, setNetSalary] = useState(financeState.profile.monthlyNetSalary);
  const [age, setAge] = useState(financeState.profile.age);
  const [retireAge, setRetireAge] = useState(financeState.profile.retireAge);
  const [socialSelf, setSocialSelf] = useState(financeState.profile.socialInsuranceSelf);
  const [budgetGoal, setBudgetGoal] = useState(financeState.budgetGoal);

  // --- TAB 2: Property States ---
  const [hasHouse, setHasHouse] = useState(!!financeState.property);
  const [houseBuyPrice, setHouseBuyPrice] = useState(financeState.property?.buyingPrice || 1800000);
  const [houseCurrentVal, setHouseCurrentVal] = useState(financeState.property?.currentValue || 1650000);
  const [houseLoan, setHouseLoan] = useState(financeState.property?.loanBalance || 900000);
  const [housePay, setHousePay] = useState(financeState.property?.monthlyPayment || 4800);
  const [houseIsRented, setHouseIsRented] = useState(financeState.property?.isRented || false);
  const [houseRent, setHouseRent] = useState(financeState.property?.rentIncome || 0);
  const [houseIsFullyPaid, setHouseIsFullyPaid] = useState(financeState.property?.isFullyPaid ?? false);
  const [houseLoanRate, setHouseLoanRate] = useState(financeState.property?.loanRate || 3.8);
  const [houseTotalTerms, setHouseTotalTerms] = useState(financeState.property?.totalLoanTerms || 360);
  const [houseRemainingTerms, setHouseRemainingTerms] = useState(financeState.property?.remainingTerms || 240);
  const [housePayDay, setHousePayDay] = useState(financeState.property?.payDay || 15);
  const [houseAddress, setHouseAddress] = useState(financeState.property?.address || '我的家庭房产实体');

  // --- TAB 3: Vehicle States ---
  const [hasCar, setHasCar] = useState(!!financeState.vehicle);
  const [carPrice, setCarPrice] = useState(financeState.vehicle?.purchasePrice || 250000);
  const [carAge, setCarAge] = useState(financeState.vehicle?.age || 2);
  const [carDeprec, setCarDeprec] = useState(financeState.vehicle?.depreciationRate || 12);
  const [carPay, setCarPay] = useState(financeState.vehicle?.monthlyPayment || 3200);
  const [carIsFullyPaid, setCarIsFullyPaid] = useState(financeState.vehicle?.isFullyPaid ?? false);
  const [carLoanBalance, setCarLoanBalance] = useState(financeState.vehicle?.loanBalance || 110000);
  const [carLoanRate, setCarLoanRate] = useState(financeState.vehicle?.loanRate || 4.8);
  const [carTotalTerms, setCarTotalTerms] = useState(financeState.vehicle?.totalLoanTerms || 60);
  const [carRemainingTerms, setCarRemainingTerms] = useState(financeState.vehicle?.remainingTerms || 36);

  // --- TAB 4: Deposits / Savings List ---
  const [savingsList, setSavingsList] = useState<SavingEntity[]>(financeState.savings || []);
  const [newSaveName, setNewSaveName] = useState('');
  const [newSaveAmount, setNewSaveAmount] = useState('');
  const [newSaveRate, setNewSaveRate] = useState('2.5');

  // --- TAB 5: Insurance & Liabilities Breakdown ---
  const [insuranceCashVal, setInsuranceCashVal] = useState(financeState.insuranceCashValue || 12000);
  const [insurancePrem, setInsurancePrem] = useState(8000); // Helper premium input
  const [insuranceCount, setInsuranceCount] = useState(2); // Helper policies count
  
  // Liabilities break down
  const [creditCardDebt, setCreditCardDebt] = useState(0);
  const [consumerLoanDebt, setConsumerLoanDebt] = useState(0);
  const [otherPersonalDebt, setOtherPersonalDebt] = useState(financeState.otherLiabilities || 5000);

  // --- Vision Board states (Persistent goals image) ---
  const [prompt, setPrompt] = useState('');
  const [visionImage, setVisionImage] = useState<string | null>(() => storage.get<string>(KEYS.VISION_IMG));
  const [isVisionLoading, setIsVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState('');

  // 老版数据迁移
  const [legacyJson, setLegacyJson] = useState('');
  const [backupJson, setBackupJson] = useState('');
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);

  const handleExport = async () => {
    const json = exportData();
    try { await navigator.clipboard.writeText(json); alert('✅ 数据已复制到剪贴板（建议粘贴保存到文件）'); }
    catch { window.prompt('复制失败，请手动复制：', json); }
  };
  const handleRestore = () => {
    if (!window.confirm('恢复将覆盖当前数据，确定？')) return;
    const res = restoreData(backupJson);
    if (res.ok) { alert(res.msg); setTimeout(() => location.reload(), 100); }
    else alert(`❌ ${res.msg}`);
  };
  const handleSetPin = () => {
    const p1 = window.prompt('设置应用锁密码', '');
    if (!p1) return;
    const p2 = window.prompt('再次确认密码', '');
    if (p1 !== p2) { alert('两次不一致'); return; }
    setPin(p1); alert('✅ 应用锁已开启（下次打开需解锁）'); forceUpdate();
  };
  const handleChangePin = () => {
    const oldP = window.prompt('输入当前密码', '');
    if (!oldP || !verifyPin(oldP)) { alert('密码错误'); return; }
    const p1 = window.prompt('输入新密码', '');
    if (!p1) return;
    const p2 = window.prompt('再次确认新密码', '');
    if (p1 !== p2) { alert('两次不一致'); return; }
    setPin(p1); alert('✅ 密码已修改'); forceUpdate();
  };
  const handleClosePin = () => {
    if (!window.confirm('关闭后无需密码即可查看，确定？')) return;
    clearPin(); alert('应用锁已关闭'); forceUpdate();
  };
  const handleLegacyImport = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(legacyJson);
    } catch {
      alert('JSON 格式错误，请粘贴完整有效的 JSON');
      return;
    }
    if (!window.confirm('导入将覆盖当前所有数据（记账/账户/游戏化/模板/提醒/档案/资产），确定？')) return;
    const res = importFromLegacy(parsed);
    if (res.ok) {
      alert(`✅ ${res.msg}\n记账 ${res.counts.records ?? 0} 笔 · 账户 ${res.counts.accounts ?? 0} · 模板 ${res.counts.templates ?? 0} · 提醒 ${res.counts.reminders ?? 0} · 资产 ${res.counts.assets ?? 0} 项`);
      setTimeout(() => location.reload(), 100);
    } else {
      alert(`❌ ${res.msg}`);
    }
  };

  // Initial populate of liabilities from state if possible
  useEffect(() => {
    if (financeState.otherLiabilities) {
      setOtherPersonalDebt(financeState.otherLiabilities);
    }
  }, []);

  // Sync savings list when parent updates
  useEffect(() => {
    setSavingsList(financeState.savings || []);
  }, [financeState.savings]);

  // Previews & calculations
  const estimatedGross = reverseNetSalaryToGross(netSalary);
  const estimatedInsBase = reverseSocialSecurityBase(socialSelf);
  const { percent: completenessPercent, checks: checklist } = calculateProfileCompleteness(financeState, transactionsCount);

  // --- Dynamic Asset-Specific Completeness Checks ---
  const assetChecks = [];

  // 1. Property Asset Checks
  if (hasHouse) {
    assetChecks.push({
      key: 'houseBuyPrice',
      name: '房产买入价格',
      completed: Number(houseBuyPrice) > 0,
      tab: 'property' as TabType,
      desc: '对应房屋的购入总金额(元)',
      tip: '补全房产当初买入总价，以便计算房产自购入以来的累积资产涨跌幅及资产保值率。'
    });
    assetChecks.push({
      key: 'houseCurrentVal',
      name: '房产公允估值（残值）',
      completed: Number(houseCurrentVal) > 0,
      tab: 'property' as TabType,
      desc: '当前所属城市的二手交易市场预估变现价',
      tip: '补充房产当前市场估价，系统才能更精准地帮您折清现金流以及静态理财周转。'
    });
    if (!houseIsFullyPaid) {
      assetChecks.push({
        key: 'houseLoanRate',
        name: '住房商贷还款利率',
        completed: Number(houseLoanRate) > 0,
        tab: 'property' as TabType,
        desc: '年折算贷款总利率比例',
        tip: '完善按揭年化利率（如 3.8%），方便房贷周期本息构成仿真计算。'
      });
      assetChecks.push({
        key: 'houseTotalTerms',
        name: '房贷按揭分期总期数',
        completed: Number(houseTotalTerms) > 0,
        tab: 'property' as TabType,
        desc: '还款总月份数（例：360期）',
        tip: '补充房贷合同初始约定的按揭总期数，协助追踪长周期债务与本息开销。'
      });
      assetChecks.push({
        key: 'houseRemainingTerms',
        name: '房贷剩余还款月数',
        completed: Number(houseRemainingTerms) > 0,
        tab: 'property' as TabType,
        desc: '当前未付剩余期数',
        tip: '补充房贷剩余未还期数，精算盘可据此精确推演未来的按揭负债摊销进度。'
      });
    }
  } else {
    assetChecks.push({
      key: 'house_activated',
      name: '房产实体档案建立',
      completed: false,
      tab: 'property' as TabType,
      desc: '尚未开启房产建模项目',
      tip: '如果您在大中城市有购买按揭或全款住房，建档可享受房贷账单月供周期智能精算。'
    });
  }

  // 2. Vehicle Asset Checks
  if (hasCar) {
    assetChecks.push({
      key: 'carPrice',
      name: '汽车原始购置总价格',
      completed: Number(carPrice) > 0,
      tab: 'vehicle' as TabType,
      desc: '当初买入该爱车的实际总开销',
      tip: '补全您的汽车购入价格，用于结合年折旧系数自动精细核算当前的实物净残值。'
    });
    assetChecks.push({
      key: 'carDeprec',
      name: '汽车年均消费贬值率',
      completed: Number(carDeprec) > 0,
      tab: 'vehicle' as TabType,
      desc: '汽车折旧折损年百分比',
      tip: '请设置您爱车的折旧比例（如 12%），计算汽车作为贬值消费品在综合大盘中的减值流。'
    });
    if (!carIsFullyPaid) {
      assetChecks.push({
        key: 'carRemainingTerms',
        name: '车贷剩余还款期数（月）',
        completed: Number(carRemainingTerms) > 0,
        tab: 'vehicle' as TabType,
        desc: '车贷还剩多少个月即全部归还完毕',
        tip: '补充车贷的剩余还款月数，精确核对您的中期现金开销以及短期流动阻碍。'
      });
      assetChecks.push({
        key: 'carTotalTerms',
        name: '车贷总分期月份合同数',
        completed: Number(carTotalTerms) > 0,
        tab: 'vehicle' as TabType,
        desc: '车贷原本约定的总期数(月)',
        tip: '补充车贷原本约定的分期总期数，系统才能自动对比折旧趋势与分期还款比例。'
      });
    }
  } else {
    assetChecks.push({
      key: 'car_activated',
      name: '代步随行车辆配置',
      completed: false,
      tab: 'vehicle' as TabType,
      desc: '尚未开启家有机动车辆建档',
      tip: '如果您拥有一台以上的机动车，开启车辆档案能为您计账汽车折损及保费合理周转。'
    });
  }

  // 3. Liquid deposits / Savings Checks
  assetChecks.push({
    key: 'savings_count',
    name: '流动存款理财至少配置一项',
    completed: savingsList.length > 0,
    tab: 'deposits' as TabType,
    desc: '银行存款、理财、活存股票池等',
    tip: '添加一份流水的存款或理财类目（支持灵活新增），用于评估家庭总体抗风险可变资产收益。'
  });

  // 4. Insurance Cash value
  assetChecks.push({
    key: 'insurance_cash_val',
    name: '家庭及个人保险现金退保估价',
    completed: Number(insuranceCashVal) > 0,
    tab: 'insurance' as TabType,
    desc: '家庭保单累计可退保或解约返还金额',
    tip: '完善所有寿险保单的当前累积可退现金总价值，这是黑天鹅和极高财务风险发生时的紧急变现网。'
  });

  const completedAssetCount = assetChecks.filter(c => c.completed).length;
  const totalAssetCount = assetChecks.length;
  const assetCompletenessPercent = totalAssetCount > 0 ? Math.round((completedAssetCount / totalAssetCount) * 100) : 0;
  const missingAssetChecks = assetChecks.filter(c => !c.completed);

  // Save the full state
  const handleSaveAllState = (showNotification = true) => {
    const updatedProfile = {
      city,
      monthlyNetSalary: Number(netSalary) || 0,
      age: Number(age) || 30,
      retireAge: Number(retireAge) || 60,
      hasHouse,
      hasCar,
      socialInsuranceSelf: Number(socialSelf) || 0,
    };

    const propertyObj = hasHouse ? {
      buyingPrice: Number(houseBuyPrice) || 0,
      currentValue: Number(houseCurrentVal) || 0,
      loanBalance: houseIsFullyPaid ? 0 : (Number(houseLoan) || 0),
      loanRate: Number(houseLoanRate) || 3.8,
      monthlyPayment: houseIsFullyPaid ? 0 : (Number(housePay) || 0),
      payDay: Number(housePayDay) || 15,
      isRented: houseIsRented,
      rentIncome: houseIsRented ? (Number(houseRent) || 0) : 0,
      address: houseAddress || '我的家庭房产实体',
      isFullyPaid: houseIsFullyPaid,
      totalLoanTerms: Number(houseTotalTerms) || 360,
      remainingTerms: Number(houseRemainingTerms) || 240
    } : null;

    const vehicleObj = hasCar ? {
      name: '我的爱车实体',
      purchasePrice: Number(carPrice) || 0,
      age: Number(carAge) || 1,
      depreciationRate: Number(carDeprec) || 10,
      insuranceMonth: 10,
      loanBalance: carIsFullyPaid ? 0 : (Number(carLoanBalance) || 0),
      monthlyPayment: carIsFullyPaid ? 0 : (Number(carPay) || 0),
      isFullyPaid: carIsFullyPaid,
      loanRate: Number(carLoanRate) || 4.5,
      totalLoanTerms: Number(carTotalTerms) || 60,
      remainingTerms: Number(carRemainingTerms) || 36
    } : null;

    // Sum-accumulate other liabilities
    const aggregatedLiabilities = Number(creditCardDebt) + Number(consumerLoanDebt) + Number(otherPersonalDebt);

    // 档案首填奖励（走 gamification domain）
    const isFirstProfileFill = financeState.profile.monthlyNetSalary === 12000 && Number(netSalary) !== 12000;

    const updatedState: FinanceAppState = {
      ...financeState,
      profile: updatedProfile,
      property: propertyObj,
      vehicle: vehicleObj,
      savings: savingsList,
      budgetGoal: Number(budgetGoal) || 0,
      insuranceCashValue: Number(insuranceCashVal) || 0,
      otherLiabilities: aggregatedLiabilities
    };

    // 触发实体联动：房/车贷款、租金 → 自动记账模板 + 还款提醒
    syncEntityAll(propertyObj, vehicleObj);

    onUpdateState(updatedState);

    if (isFirstProfileFill) {
      onProfileBonus('profile_first', 40);
    } else if (showNotification) {
      alert('✨ 您的最新财务实体参数已保存，已实时同步应用到大盘及精算模块中！');
    }
  };

  // Auto-save debounced-like effect to avoid requiring constant clicks
  useEffect(() => {
    const handle = setTimeout(() => {
      handleSaveAllState(false);
    }, 1200);
    return () => clearTimeout(handle);
  }, [
    city, netSalary, age, retireAge, socialSelf, budgetGoal, 
    hasHouse, houseBuyPrice, houseCurrentVal, houseLoan, housePay, houseIsRented, houseRent, houseIsFullyPaid, houseLoanRate, houseTotalTerms, houseRemainingTerms, housePayDay, houseAddress,
    hasCar, carPrice, carAge, carDeprec, carPay, carIsFullyPaid, carLoanBalance, carLoanRate, carTotalTerms, carRemainingTerms,
    savingsList, insuranceCashVal, creditCardDebt, consumerLoanDebt, otherPersonalDebt
  ]);

  // Handle savings modification
  const handleAddSaving = () => {
    if (!newSaveName.trim() || !newSaveAmount) return;
    const item: SavingEntity = {
      id: Date.now().toString(),
      name: newSaveName,
      amount: Number(newSaveAmount) || 0,
      annualRate: Number(newSaveRate) || 2.5
    };
    const updated = [...savingsList, item];
    setSavingsList(updated);
    setNewSaveName('');
    setNewSaveAmount('');
    setNewSaveRate('2.5');
  };

  const handleDeleteSaving = (id: string) => {
    const updated = savingsList.filter(s => s.id !== id);
    setSavingsList(updated);
  };

  // Generate Image via AI
  const handleGenerateVisionImg = async () => {
    if (!prompt.trim() || isVisionLoading) return;
    setIsVisionLoading(true);
    setVisionError('');
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: "An elegant, highly evocative and rich cinematic scene representing financial freedom: " + prompt 
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVisionImage(data.imageUrl);
      storage.set(KEYS.VISION_IMG, data.imageUrl);
    } catch (err: any) {
      console.error(err);
      setVisionError(err.message || '生成愿景画失败，请重试');
    } finally {
      setIsVisionLoading(false);
    }
  };

  // Auto calculate values
  const totalSavings = savingsList.reduce((acc, s) => acc + s.amount, 0);
  const avgSavingRate = savingsList.length > 0 
    ? parseFloat((savingsList.reduce((acc, s) => acc + (s.annualRate * s.amount), 0) / totalSavings).toFixed(2)) 
    : 0;
  const passiveAnnualIncome = parseFloat((totalSavings * (avgSavingRate / 100)).toFixed(2));

  return (
    <div className="p-4 space-y-5 max-w-sm mx-auto pb-24 text-slate-800">
      {/* Title Header */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <Coins className="text-indigo-600 w-5 h-5" />
            财务实体画像中心
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">智合信息实体录入 · 深度联动精算器</p>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
          <Lock size={10} />
          <span>本地隔离</span>
        </div>
      </div>

      {/* Completeness Card */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-950 to-indigo-900 text-white p-4.5 rounded-3xl space-y-3.5 shadow-md border-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-5 -mt-5" />
        
        <div className="flex justify-between items-center relative z-10">
          <div className="space-y-0.5">
            <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">画像整体构建等级</span>
            <span className="text-2xl font-black font-mono">{completenessPercent}%</span>
          </div>
          <div className="px-2.5 py-1.5 bg-indigo-900 border border-indigo-700/60 rounded-2xl flex flex-col items-center">
            <span className="text-[8px] text-indigo-300 uppercase font-black tracking-widest">RANK</span>
            <span className="text-xs font-black text-amber-300 font-mono">🔥{growth.streak}天</span>
          </div>
        </div>

        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden relative z-10 p-[1px]">
          <div 
            className="h-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-rose-400 rounded-full transition-all duration-700"
            style={{ width: `${completenessPercent}%` }}
          />
        </div>

        <div className="text-[9px] text-slate-300 leading-normal bg-white/5 p-2 rounded-xl border border-white/5">
          💡 配置的数据会同步到净资产盘、五险一金与个税精算。
        </div>
      </div>

      {/* 资产建模完整度专项评级与智能引导面板 */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-3.5 text-left transition-all">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 leading-none">
              <span className="text-sm">📊</span> 资产实体数据完整度分析
            </h4>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
              Asset Modeling Precision Analyst
            </span>
          </div>
          <span className="text-xs font-black font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
            {assetCompletenessPercent}%
          </span>
        </div>

        {/* Custom Progress Bar */}
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden p-[1px]">
          <div
            className="h-full bg-gradient-to-r from-teal-400 via-emerald-400 to-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${assetCompletenessPercent}%` }}
          />
        </div>

        {/* Dynamic tips and next steps list */}
        <div className="space-y-2">
          {missingAssetChecks.length === 0 ? (
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-2 text-emerald-900">
              <ShieldCheck size={14} className="text-emerald-500 mt-0.5 shrink-0" />
              <div className="text-[10px] leading-normal font-medium">
                <span className="font-extrabold block text-emerald-950">✨ 满分级资产档案建模已解锁！</span>
                您的房产、车辆、理财存款、商业保险等所有大额实物及保证资产数据字段已录入完美。当前各项资产与负债指标已实现军工级匹配！
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500">
                <span>🔍 下一步完善建议 (仍有 {missingAssetChecks.length} 项可调优)</span>
                <span className="text-[9px] font-semibold text-slate-400">点击项目直接快捷转场</span>
              </div>
              
              <div className="space-y-1.5 max-h-[148px] overflow-y-auto pr-1 scrollbar-none">
                {missingAssetChecks.slice(0, 2).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveSubTab(item.tab);
                      const el = document.getElementById('data-collection-tabs');
                      if (el && typeof el.scrollIntoView === 'function') {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="w-full p-2 bg-white hover:bg-indigo-50/45 rounded-xl border border-slate-150 text-left flex items-start gap-2 group transition duration-150 cursor-pointer"
                  >
                    <AlertCircle size={13} className="text-amber-500 mt-0.5 shrink-0 group-hover:scale-110 transition" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-slate-800 truncate group-hover:text-indigo-600 transition">
                          {item.name}
                        </span>
                        <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50/50 px-1 py-0.2 rounded shrink-0 uppercase tracking-widest">
                          {item.tab === 'property' ? '房产' : item.tab === 'vehicle' ? '车辆' : item.tab === 'deposits' ? '存款' : '保险'}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-0.5 leading-normal">
                        {item.tip}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Structured Category Navigation Tabs */}
      <div id="data-collection-tabs" className="flex bg-slate-100 p-1 rounded-2xl justify-between gap-1 border border-slate-200/60">
        {[
          { id: 'basic', label: '👤 基础社保' },
          { id: 'property', label: '🏠 房产' },
          { id: 'vehicle', label: '🚗 车辆' },
          { id: 'deposits', label: '🏦 存款' },
          { id: 'insurance', label: '🛡️ 保证负债' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as TabType)}
            className={`flex-1 py-1.5 text-center text-[10px] font-black rounded-xl transition duration-150 ${
              activeSubTab === tab.id 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label.split(' ')[1]}
          </button>
        ))}
      </div>

      {/* Tab Contents wrapper */}
      <div className="min-h-[280px]">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: BASIC & SOCIAL */}
          {activeSubTab === 'basic' && (
            <motion.div
              key="basic-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <Card className="border border-slate-150 shadow-xs">
                <CardContent className="p-4 space-y-3.5">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <MapPin size={14} className="text-indigo-600" />
                    <span className="text-xs font-black text-slate-800">所在地区</span>
                  </div>

                  {/* Province → City 级联选择 */}
                  <div className="flex gap-2">
                    <select
                      value={selectedProvince}
                      onChange={(e) => {
                        const prov = e.target.value;
                        setSelectedProvince(prov);
                        const firstCity = CHINA_PROVINCES[prov][0];
                        setCity(firstCity);
                      }}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {Object.keys(CHINA_PROVINCES).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {(CHINA_PROVINCES[selectedProvince] || []).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Salary section */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500">
                      <span>到手月薪</span>
                      <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        💡 税前 ¥{Math.round(estimatedGross).toLocaleString()}
                      </span>
                    </div>

                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">¥</span>
                      <input
                        type="number"
                        value={netSalary || ''}
                        onChange={(e) => setNetSalary(Number(e.target.value))}
                        placeholder="例如: 12000"
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Social deduction */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500">
                      <span>五险一金（个人扣款）</span>
                      <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        💡 缴费基数 ¥{Math.round(estimatedInsBase).toLocaleString()}
                      </span>
                    </div>

                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">¥</span>
                      <input
                        type="number"
                        value={socialSelf || ''}
                        onChange={(e) => setSocialSelf(Number(e.target.value))}
                        placeholder="例如: 2000"
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400">📋 去工具箱·五险一金看城市缴存明细</p>
                    {!getCities().includes(city) && (
                      <p className="text-[9px] text-amber-500 font-semibold">⚠️ 该城市社保用全国统一比例</p>
                    )}
                  </div>

                  {/* Ages Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">当前年龄</label>
                      <input
                        type="number"
                        value={age || ''}
                        onChange={(e) => setAge(Number(e.target.value))}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">退休年龄</label>
                      <input
                        type="number"
                        value={retireAge || ''}
                        onChange={(e) => setRetireAge(Number(e.target.value))}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Budget Limit */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold text-slate-500">月度预算</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">¥</span>
                      <input
                        type="number"
                        value={budgetGoal || ''}
                        onChange={(e) => setBudgetGoal(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 2: PROPERTY */}
          {activeSubTab === 'property' && (
            <motion.div
              key="property-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <Card className="border border-slate-150 shadow-xs">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Home size={15} className="text-blue-600" />
                      <span className="text-xs font-black text-slate-800">名下不动产（住宅/公寓）实体</span>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={hasHouse} 
                        onChange={(e) => setHasHouse(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-1.5 text-[10px] font-extrabold text-slate-500">已购/已备</span>
                    </label>
                  </div>

                  {hasHouse ? (
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 block">购入总价</label>
                          <input
                            type="number"
                            value={houseBuyPrice || ''}
                            onChange={(e) => setHouseBuyPrice(Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 block">当前估值</label>
                          <input
                            type="number"
                            value={houseCurrentVal || ''}
                            onChange={(e) => setHouseCurrentVal(Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>
                      </div>

                      {/* Pay-off Status */}
                      <label className="flex items-center gap-2 p-2 bg-blue-50/60 rounded-xl border border-blue-100/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={houseIsFullyPaid}
                          onChange={(e) => setHouseIsFullyPaid(e.target.checked)}
                          className="rounded text-blue-600 border-slate-300"
                        />
                        <span className="text-[10px] font-black text-blue-900">已全款付清</span>
                      </label>

                      {!houseIsFullyPaid && (
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                          <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider">房贷按揭明细</span>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">剩余房贷本金未还 (元)</label>
                              <input
                                type="number"
                                value={houseLoan || ''}
                                onChange={(e) => setHouseLoan(Number(e.target.value))}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">每月按揭月供偿金 (元)</label>
                              <input
                                type="number"
                                value={housePay || ''}
                                onChange={(e) => setHousePay(Number(e.target.value))}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-800"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">合约定价利率 %</label>
                              <input
                                type="number"
                                step="0.01"
                                value={houseLoanRate || ''}
                                onChange={(e) => setHouseLoanRate(Number(e.target.value))}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">约定总期数(月)</label>
                              <input
                                type="number"
                                value={houseTotalTerms || ''}
                                onChange={(e) => setHouseTotalTerms(Number(e.target.value))}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">剩余期数(月)</label>
                              <input
                                  type="number"
                                  value={houseRemainingTerms || ''}
                                  onChange={(e) => setHouseRemainingTerms(Number(e.target.value))}
                                  className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">每月固定还贷日 (1-28号)</label>
                              <input
                                type="number"
                                min={1}
                                max={28}
                                value={housePayDay || ''}
                                onChange={(e) => {
                                  let v = parseInt(e.target.value) || 1;
                                  if (v < 1) v = 1;
                                  if (v > 28) v = 28;
                                  setHousePayDay(v);
                                }}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">房产名称简称/地理地址</label>
                              <input
                                type="text"
                                value={houseAddress || ''}
                                onChange={(e) => setHouseAddress(e.target.value)}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs px-2 text-slate-800 font-semibold"
                                placeholder="例如：我的第一套温馨小房"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {!houseIsFullyPaid && (
                        <div className="space-y-2 mt-2 text-left">
                          <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-100 flex items-start gap-2 text-amber-900">
                            <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                            <div className="text-[10px]">
                              <span className="font-extrabold block">⏰ 已自动绑定每月 {housePayDay || 15} 日还贷提醒。</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rental Switch */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={houseIsRented}
                            onChange={(e) => setHouseIsRented(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600"
                          />
                          <span className="text-[10px] font-bold text-slate-500">房屋目前由租客承租中 (流转产生租金收入)</span>
                        </label>
                        
                        {houseIsRented && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">租金(元/月):</span>
                            <input
                              type="number"
                              value={houseRent || ''}
                              onChange={(e) => setHouseRent(Number(e.target.value))}
                              className="w-16 p-1 bg-slate-50 border border-slate-200 rounded text-center text-xs font-mono font-bold"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      🏠 暂无房产。开启开关即可联动月供提醒。
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 3: VEHICLE */}
          {activeSubTab === 'vehicle' && (
            <motion.div
              key="vehicle-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <Card className="border border-slate-150 shadow-xs">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Car size={15} className="text-emerald-600" />
                      <span className="text-xs font-black text-slate-800">车辆信息</span>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={hasCar} 
                        onChange={(e) => setHasCar(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      <span className="ml-1.5 text-[10px] font-extrabold text-slate-500">已购/已备</span>
                    </label>
                  </div>

                  {hasCar ? (
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 block">购入价格</label>
                          <input
                            type="number"
                            value={carPrice || ''}
                            onChange={(e) => setCarPrice(Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 block">已购置天数/年限</label>
                          <input
                            type="number"
                            value={carAge || ''}
                            onChange={(e) => setCarAge(Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-center"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 block">年贬值率</label>
                          <input
                            type="number"
                            value={carDeprec || ''}
                            onChange={(e) => setCarDeprec(Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>

                        <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 flex flex-col justify-center text-center">
                          <span className="text-[8px] text-emerald-600 font-bold">参考当前折旧账面估值</span>
                          <span className="text-xs font-black text-emerald-800 font-mono">
                            ¥{Math.round(carPrice * Math.pow(1 - (carDeprec/100), carAge)).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Pay-off Status */}
                      <label className="flex items-center gap-2 p-2 bg-emerald-50/65 rounded-xl border border-emerald-100/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={carIsFullyPaid}
                          onChange={(e) => setCarIsFullyPaid(e.target.checked)}
                          className="rounded text-emerald-600 border-slate-300"
                        />
                        <span className="text-[10px] font-black text-emerald-950">该车辆全款购入 (无汽车消费金融车贷贷款)</span>
                      </label>

                      {!carIsFullyPaid && (
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                          <span className="text-[9px] font-extrabold text-slate-400 block">车贷偿还账务详情</span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">剩余车贷本息余额 (元)</label>
                              <input
                                type="number"
                                value={carLoanBalance || ''}
                                onChange={(e) => setCarLoanBalance(Number(e.target.value))}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">车贷每月月供固定支出 (元)</label>
                              <input
                                type="number"
                                value={carPay || ''}
                                onChange={(e) => setCarPay(Number(e.target.value))}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">车贷年化协议利率 %</label>
                              <input
                                type="number"
                                step="0.01"
                                value={carLoanRate || ''}
                                onChange={(e) => setCarLoanRate(Number(e.target.value))}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 block mb-0.5">剩余还置期数(月)</label>
                              <input
                                type="number"
                                value={carRemainingTerms || ''}
                                onChange={(e) => setCarRemainingTerms(Number(e.target.value))}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      🚗 暂无车辆。登记后自动核算折旧减值。
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 4: DEPOSITS & SAVINGS */}
          {activeSubTab === 'deposits' && (
            <motion.div
              key="deposits-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <Card className="border border-slate-150 shadow-xs">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Banknote size={15} className="text-amber-500" />
                      <span className="text-xs font-black text-slate-800 font-sans">家庭存款及理财账户记账 ledger</span>
                    </div>
                    <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-black">
                      理财实体: {savingsList.length} 笔
                    </span>
                  </div>

                  {/* Dynamic Savings Table/List */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {savingsList.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs text-slate-400">
                        📭 目前暂未登记多余资金。点击下方可添增定期、国债、低回款等资产。
                      </div>
                    ) : (
                      savingsList.map((save) => (
                        <div 
                          key={save.id} 
                          className="flex justify-between items-center bg-slate-50 p-2 rounded-xl text-xs border border-slate-100 hover:border-slate-300/80 transition"
                        >
                          <div>
                            <span className="font-extrabold text-slate-800">{save.name}</span>
                            <div className="flex gap-2 text-[9px] text-slate-400 font-semibold mt-0.5">
                              <span>预期年化: <b className="text-slate-600 font-mono">{save.annualRate}%</b></span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-emerald-600">¥{save.amount.toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSaving(save.id)}
                              className="text-slate-300 hover:text-rose-500 p-1"
                              title="删除此项"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add New Ledger Block */}
                  <div className="bg-slate-55 p-3 rounded-2xl border border-slate-100 space-y-2.5">
                    <span className="text-[9px] font-extrabold text-slate-500 block uppercase tracking-wider">➕ 增设一笔大额理财/定期</span>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="存款或网点名 (如：招商月月开)"
                        value={newSaveName}
                        onChange={(e) => setNewSaveName(e.target.value)}
                        className="p-1.5 bg-white border border-slate-200 rounded text-xs font-semibold focus:outline-none"
                      />
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 text-[10px]">¥</span>
                        <input
                          type="number"
                          placeholder="存款金额"
                          value={newSaveAmount}
                          onChange={(e) => setNewSaveAmount(e.target.value)}
                          className="w-full pl-5 pr-1.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center gap-2 pt-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400 font-bold">预期收益年率 (%):</span>
                        <input
                          type="number"
                          step="0.1"
                          value={newSaveRate}
                          onChange={(e) => setNewSaveRate(e.target.value)}
                          className="w-12 p-1 border border-slate-200 rounded text-center text-xs font-mono font-bold"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddSaving}
                        className="py-1 px-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-lg text-[9px] flex items-center gap-1 transition"
                      >
                        <Plus size={10} />
                        <span>填入多端</span>
                      </button>
                    </div>
                  </div>

                  {/* Yield Summary preview */}
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[8px] text-amber-700 font-extrabold block uppercase tracking-wider">总储蓄资产理财预评估</span>
                      <span className="text-base font-black text-amber-900 font-mono">¥{totalSavings.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] text-slate-400 font-bold block">加权估计复均率 / 年红利收益</span>
                      <span className="font-mono text-[10px] font-bold text-amber-800">
                        {avgSavingRate}% / ¥{Math.round(passiveAnnualIncome).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 5: INSURANCE & LIABILITIES */}
          {activeSubTab === 'insurance' && (
            <motion.div
              key="insurance-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <Card className="border border-slate-150 shadow-xs">
                <CardContent className="p-4 space-y-4">
                  {/* Commercial Insurance policies cash value */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
                      <ShieldCheck size={15} className="text-blue-500" />
                      <span className="text-xs font-black text-slate-800">商业保险</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-50 block">保单现金价值</label>
                        <input
                          type="number"
                          value={insuranceCashVal || ''}
                          onChange={(e) => setInsuranceCashVal(Number(e.target.value))}
                          placeholder="例如: 12000"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-50 block">年需缴交保金保费 (元/年支)</label>
                        <input
                          type="number"
                          value={insurancePrem || ''}
                          onChange={(e) => setInsurancePrem(Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                        />
                      </div>
                    </div>
                    <p className="text-[8px] text-slate-400 leading-normal">
                      保单现金价值 = 退保时可拿回的金额。
                    </p>
                  </div>

                  {/* Fine scale liabilities builder */}
                  <div className="space-y-3 pt-2 border-t border-dashed border-slate-200">
                    <div className="flex items-center gap-1.5 pb-1">
                      <AlertTriangle size={15} className="text-rose-500" />
                      <span className="text-xs font-black text-slate-800">其他负债</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 block">信用卡未还账单</label>
                        <input
                          type="number"
                          value={creditCardDebt || ''}
                          onChange={(e) => setCreditCardDebt(Number(e.target.value))}
                          placeholder="0"
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 block">消费金融/微粒网络贷</label>
                        <input
                          type="number"
                          value={consumerLoanDebt || ''}
                          onChange={(e) => setConsumerLoanDebt(Number(e.target.value))}
                          placeholder="0"
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 block">民间朋友其它借款</label>
                        <input
                          type="number"
                          value={otherPersonalDebt || ''}
                          onChange={(e) => setOtherPersonalDebt(Number(e.target.value))}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono text-rose-600"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-rose-50/50 rounded-xl border border-rose-100/50 flex justify-between items-center text-[10px]">
                      <span className="font-extrabold text-rose-800">总聚合民间其他负债</span>
                      <span className="font-mono font-black text-rose-600">
                        ¥{(creditCardDebt + consumerLoanDebt + otherPersonalDebt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Primary Explicit Save Action */}
      <button
        type="button"
        onClick={() => handleSaveAllState(true)}
        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl text-xs transition duration-150 shadow-md flex items-center justify-center gap-2 border-0"
      >
        <CheckCircle2 size={14} className="text-white" />
        <span>确认并立即重算全盘资产 & 纳税精算</span>
      </button>

      {/* LIFE VISION AI GENERATION SECTION */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <ImageIcon size={14} className="text-pink-500" />
          <h4 className="text-[11px] font-black text-indigo-950 uppercase tracking-wider">终身财务奋斗美好未来愿景 AI 绘卷</h4>
        </div>

        <Card className="shadow-xs border border-pink-100 bg-pink-50/10">
          <CardContent className="p-4 space-y-3.5 text-left">
            <p className="text-[9px] text-slate-400 leading-normal">
              设想一个激发您努力工作的财务自由奋斗目标（例如：“在海边有一座落地窗白房子，门前开满粉色玫瑰树，晚风拂过海面”），利用 Gemini 生成精美愿景图：
            </p>
            <div className="flex gap-1.5">
              <input
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-pink-400 focus:outline-none"
                placeholder="我的目标是：拥有一间看得见群山雪景的日式咖啡屋..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateVisionImg()}
              />
              <button
                type="button"
                onClick={handleGenerateVisionImg}
                disabled={isVisionLoading || !prompt.trim()}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-850 disabled:opacity-50 transition"
              >
                {isVisionLoading ? (
                  <Loader2 className="animate-spin w-3 h-3" />
                ) : (
                  <Sparkles className="w-3 h-3 text-pink-400" />
                )}
                <span>绘制</span>
              </button>
            </div>

            {visionError && <div className="text-rose-500 text-[9px]">{visionError}</div>}

            {visionImage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative group bg-slate-50"
              >
                <img 
                  src={visionImage} 
                  referrerPolicy="no-referrer" 
                  alt="Dynamic future financial vision goal" 
                  className="w-full h-44 object-cover" 
                />
                <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-2 text-white text-[9px] font-semibold text-center leading-normal">
                  🌅 「我的财富动力源泉」：{prompt || '终身奋斗极简愿景图'}
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 text-center flex items-center justify-center gap-1.5 opacity-90 text-[9px] text-slate-400">
        <Lock size={12} className="text-slate-400" />
        <span className="font-bold uppercase tracking-wider">🔒 FINANCEHUB 保安级别：全线数据完全驻留在您当前的浏览器本地</span>
      </div>

      {/* 老版「财务通」数据迁移 */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
        <div className="flex items-center gap-1.5">
          <Database size={14} className="text-amber-600" />
          <h4 className="text-xs font-bold text-slate-700">老版「财务通」数据迁移</h4>
        </div>
        <p className="text-[10px] text-slate-500 leading-normal">把老版小程序导出的 JSON 粘贴到下方，导入后<b className="text-rose-600">覆盖当前数据</b>（记账/账户/游戏化/模板/提醒/档案/资产）。股票持仓暂不迁移。</p>
        <textarea
          rows={3}
          value={legacyJson}
          onChange={e => setLegacyJson(e.target.value)}
          placeholder='{"_meta":{"app":"财务通",...},"fin_records":[...],...}'
          className="w-full bg-white border border-amber-200 rounded-xl p-2 font-mono text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          onClick={handleLegacyImport}
          disabled={!legacyJson.trim()}
          className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition"
        >导入并覆盖</button>
      </div>

      {/* 数据备份（新版导出/恢复） */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
        <div className="flex items-center gap-1.5">
          <Database size={14} className="text-emerald-600" />
          <h4 className="text-xs font-bold text-slate-700">数据备份与恢复</h4>
        </div>
        <p className="text-[10px] text-slate-500 leading-normal">导出当前全部数据为 JSON（备份）。恢复时粘贴备份 JSON 覆盖当前数据。PIN 不在导出里。</p>
        <button
          onClick={handleExport}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
        >导出 JSON 到剪贴板</button>
        <textarea
          rows={2}
          value={backupJson}
          onChange={e => setBackupJson(e.target.value)}
          placeholder='粘贴备份 JSON 以恢复...'
          className="w-full bg-white border border-emerald-200 rounded-xl p-2 font-mono text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          onClick={handleRestore}
          disabled={!backupJson.trim()}
          className="w-full py-2 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition"
        >恢复（覆盖）</button>
      </div>

      {/* 应用锁 */}
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2">
        <div className="flex items-center gap-1.5">
          <Lock size={14} className="text-indigo-600" />
          <h4 className="text-xs font-bold text-slate-700">应用锁</h4>
        </div>
        <p className="text-[10px] text-slate-500 leading-normal">{hasPin() ? '应用锁已开启，打开 App 或切回前台需输密码。' : '设置后，打开 App 或切回前台需输密码解锁（仅防瞄一眼）。'}</p>
        {hasPin() ? (
          <div className="flex gap-2">
            <button onClick={handleChangePin} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition">修改密码</button>
            <button onClick={handleClosePin} className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition">关闭应用锁</button>
          </div>
        ) : (
          <button onClick={handleSetPin} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition">设置应用锁</button>
        )}
      </div>
    </div>
  );
}
