import { useState, useEffect } from 'react';
import { ModuleType, Transaction } from './types';
import { storage } from './storage';
import { KEYS } from './storage/keys';
import { DashboardView } from './components/DashboardView';
import { AccountingView } from './components/AccountingView';
import { TaxView } from './components/TaxView';
import { InsuranceView } from './components/InsuranceView';
import { AssetsView } from './components/AssetsView';
import { StocksView } from './components/StocksView';
import { ChatView } from './components/ChatView';
import { DataCollectionView } from './components/DataCollectionView';
import { DepositsView } from './components/DepositsView';
import { PensionView } from './components/PensionView';
import { AnnuityView } from './components/AnnuityView';
import { LoanView } from './components/LoanView';
import { ReportsView } from './components/ReportsView';
import { MobileHub } from './components/MobileHub';
import { FinanceAppState, INITIAL_STATE } from './utils/financeState';
import { useGamification } from './hooks/useGamification';
import { ensureTemplates, checkAutoRecords, logExecution } from './logic/domain/templates';
import { syncAssetsFromFinanceState } from './logic/domain/assets';
import { todayStr, type GamificationEvents } from './logic/domain/gamification';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Coins, Flame } from 'lucide-react';
import { QuickLogModal } from './components/QuickLogModal';
import { useBookkeeping } from './hooks/useBookkeeping';
import { usePinLock } from './hooks/usePinLock';
import { 
  LayoutDashboard, 
  Wallet, 
  Grid, 
  MessageSquare, 
  User,
  ChevronLeft,
  Wifi,
  Battery,
  Signal,
  Plus,
  Lock,
  Scale
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'accounting' | 'reports' | 'profile' | 'tools'>('home');
  const [currentModule, setCurrentModule] = useState<ModuleType>(ModuleType.DASHBOARD);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const { locked, unlock } = usePinLock();
  const [pinInput, setPinInput] = useState('');
  const [initialBillView, setInitialBillView] = useState<'all' | 'expense' | 'income'>('all');
  const [billNavId, setBillNavId] = useState(0);
  const onNavigateToBills = (type: 'income' | 'expense') => { setInitialBillView(type); setBillNavId(n => n + 1); setActiveTab('accounting'); setCurrentModule(ModuleType.ACCOUNTING); };
  
  // 1. 记账数据 + 账户体系（走平台无关 domain 层，自动持久化到 fin_records / fin_accounts）
  const { records: transactions, accounts, templates, addRecord, deleteRecord, updateRecord, onToggleTemplate, onUpdateTemplate } = useBookkeeping();

  // 2. Core Finance App state - persist locally in localStorage to comply with "🔒 数据仅存本机" philosophy
  const [financeState, setFinanceState] = useState<FinanceAppState>(() => {
    const parsed = storage.get<Partial<FinanceAppState>>(KEYS.APP_STATE);
    if (parsed) {
      // Ensure perfect backward compatibility and deep recovery by merging with INITIAL_STATE
      return {
        ...INITIAL_STATE,
        ...parsed,
        profile: {
          ...INITIAL_STATE.profile,
          ...(parsed.profile || {})
        }
      };
    }
    return INITIAL_STATE;
  });

  // 3. 游戏化（独立 fin_growth，平台无关 domain）
  const { growth, onRecord, manualCheckin, awardBonus } = useGamification(financeState);
  const [celebrationMsg, setCelebrationMsg] = useState<{ title: string; subtitle: string; rewards: string[] } | null>(null);

  const triggerCelebration = (events: GamificationEvents) => {
    const rewards: string[] = [];
    let title = '✨ 记账成功';
    let subtitle = '';
    if (events.checkedIn) { subtitle = `连续打卡 ${events.streak} 天`; rewards.push('🌅 当日打卡 +财气'); }
    if (events.gotMakeupCard) rewards.push('🎁 获得 1 张补签卡！');
    if (events.streakMilestone) { title = '🔥 连击里程碑'; subtitle = `连续打卡 ${events.streakMilestone} 天！`; }
    if (events.newBadges.length) {
      title = '🏅 解锁徽章';
      events.newBadges.forEach(b => rewards.push(`${b.icon} ${b.name}（+${b.points}财气）`));
    }
    rewards.push(`+${events.pointsGained} 财气值`);
    setCelebrationMsg({ title, subtitle, rewards });
  };

  const onPunchIn = () => triggerCelebration(manualCheckin());
  const onProfileBonus = (reason: string, points: number) => triggerCelebration(awardBonus(reason, points));

  // Write finance state back to storage on change
  useEffect(() => {
    storage.set(KEYS.APP_STATE, financeState);
    syncAssetsFromFinanceState(financeState);
  }, [financeState]);

  // 阶段2c：启动时自动入账固定账单（幂等，静默不弹庆祝）
  useEffect(() => {
    ensureTemplates();
    const auto = checkAutoRecords();
    if (auto.length === 0) return;
    auto.forEach(({ record }) => {
      addRecord(record);
      onRecord(record);
    });
    logExecution(auto.map(a => a.templateId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time time string for top indicator bar
  const [timeStr, setTimeStr] = useState('23:24');
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      setTimeStr(`${hours}:${mins}`);
    };
    updateTime();
    const intervalId = setInterval(updateTime, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // When back to Hub or general tool selection
  const handleSelectModuleFromHub = (module: ModuleType) => {
    setCurrentModule(module);
  };

  const handleTabChange = (tab: 'home' | 'accounting' | 'reports' | 'profile' | 'tools') => {
    setActiveTab(tab);
    if (tab === 'home') {
      setCurrentModule(ModuleType.DASHBOARD);
    } else if (tab === 'accounting') {
      setCurrentModule(ModuleType.ACCOUNTING);
    } else if (tab === 'reports') {
      setCurrentModule(ModuleType.REPORTS);
    } else if (tab === 'profile') {
      setCurrentModule(ModuleType.PROFILE);
    } else if (tab === 'tools') {
      setCurrentModule(ModuleType.DASHBOARD); // default to our beautiful live card toolbox directory
    }
  };

  const isSubToolActive = () => {
    return activeTab === 'tools' && currentModule !== ModuleType.DASHBOARD && currentModule !== ModuleType.ACCOUNTING && currentModule !== ModuleType.PROFILE && currentModule !== ModuleType.VISION;
  };

  // Structured callback when adding accounting transactions
  const handleAddTransactionAndAwardRewards = (newTx: Transaction) => {
    // 记账（domain：写 fin_records + 联动账户余额）+ 游戏化（打卡/积分/徽章/升级）
    addRecord(newTx);
    triggerCelebration(onRecord(newTx));
  };

  const handleDeleteTransaction = (id: string) => {
    deleteRecord(id); // domain：删 fin_records + 回退账户余额
  };

  const handleToggleImportantTransaction = (id: string) => {
    const t = transactions.find(r => r.id === id);
    if (t) updateRecord(id, { important: !t.important });
  };

  const getPageTitle = () => {
    switch (currentModule) {
      case ModuleType.DASHBOARD: return 'FinanceHub 个人空间';
      case ModuleType.ACCOUNTING: return '账单详情';
      case ModuleType.REPORTS: return '财务三大报表';
      case ModuleType.LOAN: return '房贷计算 · 提前还贷';
      case ModuleType.PROFILE: return '我的财务档案';
      case ModuleType.TAX: return '个税反向算费';
      case ModuleType.INSURANCE: return '两险基数反推';
      case ModuleType.PENSION: return '统筹养老预估';
      case ModuleType.ANNUITY: return '企业复利年金';
      case ModuleType.ASSETS: return '资产配置总览';
      case ModuleType.STOCKS: return 'A股持仓明细';
      case ModuleType.DEPOSITS: return '储蓄存款账本';
      case ModuleType.CHAT: return 'AI 个人智脑';
      case ModuleType.VISION: return '财务愿景画卷';
      default: return 'FinanceHub';
    }
  };

  const renderModule = () => {
    if (activeTab === 'tools') {
      // If no subtool is actively focused on sub-navigation, show the complete tool selector index list
      if (currentModule === ModuleType.DASHBOARD || currentModule === ModuleType.ACCOUNTING || currentModule === ModuleType.CHAT || currentModule === ModuleType.PROFILE || currentModule === ModuleType.VISION) {
        return (
          <MobileHub 
            financeState={financeState}
            onSelectModule={handleSelectModuleFromHub} 
          />
        );
      }
    }

    switch (currentModule) {
      case ModuleType.DASHBOARD: 
        return (
          <DashboardView
            transactions={transactions}
            financeState={financeState}
            growth={growth}
            onUpdateState={setFinanceState}
            onNavigateTab={handleTabChange}
            onAddTransaction={handleAddTransactionAndAwardRewards}
            onPunchIn={onPunchIn}
            onProfileBonus={onProfileBonus}
            onNavigateToBills={onNavigateToBills}
          />
        );
      case ModuleType.ACCOUNTING:
        return (
          <AccountingView
            key={billNavId}
            transactions={transactions}
            accounts={accounts}
            templates={templates}
            onAddTransaction={handleAddTransactionAndAwardRewards}
            onDeleteTransaction={handleDeleteTransaction}
            onToggleImportantTransaction={handleToggleImportantTransaction}
            onToggleTemplate={onToggleTemplate}
            onUpdateTemplate={onUpdateTemplate}
            initialBillView={initialBillView}
            financeState={financeState}
          />
        );
      case ModuleType.REPORTS:
        return (
          <ReportsView
            financeState={financeState}
            accounts={accounts}
            transactions={transactions}
          />
        );
      case ModuleType.LOAN:
        return <LoanView financeState={financeState} />;
      case ModuleType.PROFILE: 
        return (
          <DataCollectionView
            financeState={financeState}
            growth={growth}
            onUpdateState={setFinanceState}
            onProfileBonus={onProfileBonus}
            transactionsCount={transactions.length}
          />
        );
      case ModuleType.TAX: 
        return <TaxView financeState={financeState} />;
      case ModuleType.INSURANCE: 
        return <InsuranceView financeState={financeState} />;
      case ModuleType.PENSION: 
        return <PensionView financeState={financeState} />;
      case ModuleType.ANNUITY: 
        return <AnnuityView financeState={financeState} />;
      case ModuleType.ASSETS: 
        return <AssetsView financeState={financeState} onUpdateState={setFinanceState} />;
      case ModuleType.STOCKS: 
        return <StocksView />;
      case ModuleType.DEPOSITS: 
        return <DepositsView financeState={financeState} />;
      case ModuleType.CHAT: 
        return <ChatView />;
      case ModuleType.VISION: 
        return <DataCollectionView financeState={financeState} growth={growth} onUpdateState={setFinanceState} onProfileBonus={onProfileBonus} transactionsCount={transactions.length} />;
      default: 
        return (
          <DashboardView
            transactions={transactions}
            financeState={financeState}
            growth={growth}
            onUpdateState={setFinanceState}
            onNavigateTab={handleTabChange}
            onAddTransaction={handleAddTransactionAndAwardRewards}
            onPunchIn={onPunchIn}
            onProfileBonus={onProfileBonus}
            onNavigateToBills={onNavigateToBills}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-0 md:p-6 text-slate-800 font-sans selection:bg-indigo-100">
      {/* Premium iPhone simulated body on desktop */}
      <div className="w-full h-screen md:h-[830px] md:max-w-[390px] md:rounded-[48px] md:shadow-2xl md:border-[12px] md:border-slate-800 bg-slate-50 flex flex-col overflow-hidden relative">
        
        {/* iOS Dynamic Island sim */}
        <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6.5 bg-slate-800 rounded-b-xl z-50"></div>

        {/* Top iOS Status Area */}
        <div className="bg-slate-50 text-slate-900 px-6 pt-3 pb-2 flex items-center justify-between text-xs font-bold select-none shrink-0 z-40">
          <span>{timeStr}</span>
          <div className="flex items-center gap-1.5">
            <Signal size={14} className="stroke-[2.5]" />
            <Wifi size={14} className="stroke-[2.5]" />
            <Battery size={16} className="stroke-[2.5]" />
          </div>
        </div>

        {/* Universal Top Header */}
        <header className="h-14 bg-white border-b border-slate-100 px-4 flex items-center justify-between shadow-sm shrink-0 z-40">
          <div className="flex items-center gap-1.5">
            {isSubToolActive() && (
              <button 
                onClick={() => setCurrentModule(ModuleType.DASHBOARD)} // jump back to the selector
                className="p-1 rounded-full hover:bg-slate-100 text-slate-700 transition"
              >
                <ChevronLeft size={20} className="stroke-[3]" />
              </button>
            )}
            <h1 className="text-sm font-black tracking-tight text-slate-900 select-none">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onPunchIn} title={growth.lastCheckinDate === todayStr() ? `已连签 ${growth.streak} 天` : '每日打卡'} className={`w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${growth.lastCheckinDate === todayStr() ? 'bg-slate-100 text-slate-400' : 'bg-gradient-to-tr from-orange-500 to-amber-500 text-white animate-pulse hover:scale-110 active:scale-95'}`}>
              <Flame size={15} className={growth.lastCheckinDate === todayStr() ? '' : 'fill-white'} />
            </button>
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-indigo-400 overflow-hidden flex items-center justify-center text-white font-extrabold text-xs select-none shadow-sm shadow-blue-500/20">
              {growth.streak}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 relative pb-10">
          {renderModule()}
        </div>

        {/* Tab-bar iOS navigation bar */}
        <nav className="h-16 bg-white border-t border-slate-100 flex items-center justify-around pb-4 pt-1 shadow-md shrink-0 z-40">
          <button 
            onClick={() => handleTabChange('home')}
            className={`flex flex-col items-center gap-0.5 text-[9px] font-bold px-3 transition duration-150 ${activeTab === 'home' && currentModule !== ModuleType.ACCOUNTING ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-550'}`}
          >
            <LayoutDashboard size={18} className="stroke-[2.5]" />
            <span>首页</span>
          </button>

          <button
            onClick={() => handleTabChange('accounting')}
            className={`flex flex-col items-center gap-0.5 text-[9px] font-bold px-3 transition duration-150 ${activeTab === 'accounting' ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-550'}`}
          >
            <Wallet size={18} className="stroke-[2.5]" />
            <span>账单详情</span>
          </button>

          <button
            onClick={() => handleTabChange('reports')}
            className={`flex flex-col items-center gap-0.5 text-[9px] font-bold px-3 transition duration-150 ${activeTab === 'reports' ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-550'}`}
          >
            <Scale size={18} className="stroke-[2.5]" />
            <span>报表</span>
          </button>

          {/* Symmetrical Central Shrunk Plus Button for Instant Bookkeeping */}
          <button 
            type="button"
            onClick={() => setIsQuickLogOpen(true)}
            className="flex flex-col items-center justify-center -mt-5 w-11 h-11 bg-gradient-to-tr from-indigo-600 to-blue-600 rounded-full text-white shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer z-50 border-[3px] border-white shrink-0"
            title="极速闪电记账"
          >
            <Plus size={20} className="stroke-[3]" />
          </button>

          <button 
            onClick={() => handleTabChange('tools')}
            className={`flex flex-col items-center gap-0.5 text-[9px] font-bold px-3 transition duration-150 ${activeTab === 'tools' ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-550'}`}
          >
            <Grid size={18} className="stroke-[2.5]" />
            <span>工具箱</span>
          </button>

          <button
            onClick={() => handleTabChange('profile')}
            className={`flex flex-col items-center gap-0.5 text-[9px] font-bold px-3 transition duration-150 ${activeTab === 'profile' ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-550'}`}
          >
            <User size={18} className="stroke-[2.5]" />
            <span>我的档案</span>
          </button>
        </nav>

        {/* Global Quick Bookkeeping Modal */}
        <QuickLogModal
          isOpen={isQuickLogOpen}
          onClose={() => setIsQuickLogOpen(false)}
          onAddTransaction={handleAddTransactionAndAwardRewards}
          onOpenLedger={() => handleTabChange('accounting')}
          accounts={accounts}
        />

        {/* 全局庆祝动效（记账/打卡/升级/徽章） */}
        <AnimatePresence>
          {celebrationMsg && (
            <div className="absolute inset-0 bg-slate-900/85 z-[60] flex items-center justify-center p-6">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                className="bg-white rounded-3xl p-6 w-full max-w-xs text-center space-y-4 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute -top-10 -left-10 w-24 h-24 bg-amber-100/40 rounded-full" />
                <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-blue-100/40 rounded-full" />
                <div className="w-14 h-14 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-full flex items-center justify-center mx-auto shadow-md">
                  <Trophy size={28} className="text-amber-800" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">{celebrationMsg.title}</h4>
                  {celebrationMsg.subtitle && <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal">{celebrationMsg.subtitle}</p>}
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl space-y-1 text-xs text-slate-700 font-semibold border border-slate-100">
                  {celebrationMsg.rewards.map((rew, index) => (
                    <p key={index} className="flex gap-1.5 items-center justify-center">
                      <Coins size={12} className="text-amber-500 shrink-0" />
                      <span>{rew}</span>
                    </p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCelebrationMsg(null)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  收下财气，继续加油！
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* iOS style lower bar indicator */}
        <div className="hidden md:block absolute bottom-1 left-1/2 -translate-x-1/2 w-28 h-1 bg-slate-300 rounded-full z-50 opacity-80"></div>

        {/* 应用锁屏（设了 PIN 时显示，遮住全部） */}
        {locked && (
          <div className="absolute inset-0 z-[100] bg-slate-900 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center space-y-4">
              <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-blue-500 rounded-full flex items-center justify-center mx-auto shadow-md">
                <Lock size={26} className="text-white" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-base">应用锁</h4>
                <p className="text-[11px] text-slate-400 mt-1">输入密码解锁</p>
              </div>
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder="••••"
                className="w-full text-center text-2xl tracking-[0.5em] py-2 bg-slate-50 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (unlock(pinInput)) { setPinInput(''); }
                  else { alert('密码错误'); setPinInput(''); }
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >解锁</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
