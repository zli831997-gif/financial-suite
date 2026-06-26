import { ModuleType } from '../types';
import { LayoutDashboard, Wallet, Receipt, BriefcaseMedical, Landmark, PiggyBank, PieChart, TrendingUp, Banknote, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export function Sidebar({ currentModule, setCurrentModule }: { currentModule: ModuleType, setCurrentModule: (m: ModuleType) => void }) {
  const navItems = [
    { id: ModuleType.DASHBOARD, label: '总览仪表盘', icon: LayoutDashboard },
    { id: ModuleType.ACCOUNTING, label: '个人记账', icon: Wallet },
    { id: ModuleType.TAX, label: '个税计算', icon: Receipt },
    { id: ModuleType.INSURANCE, label: '五险一金', icon: BriefcaseMedical },
    { id: ModuleType.PENSION, label: '养老金预测', icon: Landmark },
    { id: ModuleType.ANNUITY, label: '年金计算', icon: PiggyBank },
    { id: ModuleType.ASSETS, label: '资产总管', icon: PieChart },
    { id: ModuleType.STOCKS, label: '股票投资', icon: TrendingUp },
    { id: ModuleType.DEPOSITS, label: '理财收益', icon: Banknote },
    { id: ModuleType.CHAT, label: 'AI 理财顾问', icon: MessageSquare },
    { id: ModuleType.VISION, label: '财务愿景版', icon: ImageIcon },
  ];

  return (
    <div className="w-64 bg-white text-slate-900 h-screen flex flex-col p-4 border-r border-slate-200 shrink-0">
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">
          FS
        </div>
        <h1 className="text-xl font-bold tracking-tight">FinanceHub</h1>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto pr-2 pb-10">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentModule(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left",
                isActive 
                  ? "bg-blue-50 text-blue-700" 
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <Icon size={18} className={isActive ? "text-blue-700" : "text-slate-500"} />
              {item.label}
            </button>
          )
        })}
      </nav>
      <div className="mt-auto px-4 pb-4">
        <div className="bg-slate-100 rounded-2xl p-4">
          <p className="text-xs text-slate-500 mb-1">Powered by</p>
          <p className="text-sm font-semibold">Google Gemini</p>
        </div>
      </div>
    </div>
  );
}
