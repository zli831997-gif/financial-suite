import { useState, useEffect, useRef } from 'react';
import { Transaction } from '../types';
import type { Account } from '../logic/domain/accounts';
import { 
  X, Plus, Check, Wallet, ChevronRight, 
  Coffee, Car, ShoppingBag, Gamepad2, Home, Settings,
  Briefcase, TrendingUp, Landmark, Zap, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: Transaction) => void;
  onOpenLedger: () => void;
  accounts: Account[];
}

export function QuickLogModal({ isOpen, onClose, onAddTransaction, onOpenLedger, accounts }: QuickLogModalProps) {
  const [quickType, setQuickType] = useState<'expense' | 'income'>('expense');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState('餐饮');
  const [quickNote, setQuickNote] = useState('');
  const [quickAccount, setQuickAccount] = useState('acc_wechat');
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  // Adjust default category when type changes
  useEffect(() => {
    if (quickType === 'expense') {
      setQuickCategory('餐饮');
    } else {
      setQuickCategory('工资');
    }
  }, [quickType]);

  if (!isOpen) return null;

  const expenseCategories = [
    { name: '餐饮', emoji: '🍔', icon: Coffee, color: 'text-orange-500 bg-orange-50' },
    { name: '交通', emoji: '🚗', icon: Car, color: 'text-blue-500 bg-blue-50' },
    { name: '购物', emoji: '🛍️', icon: ShoppingBag, color: 'text-purple-500 bg-purple-50' },
    { name: '娱乐', emoji: '🎮', icon: Gamepad2, color: 'text-rose-500 bg-rose-50' },
    { name: '住房', emoji: '🏠', icon: Home, color: 'text-amber-500 bg-amber-50' },
    { name: '其他', emoji: '⚙️', icon: Settings, color: 'text-slate-500 bg-slate-50' }
  ];

  const incomeCategories = [
    { name: '工资', emoji: '💰', icon: Briefcase, color: 'text-emerald-500 bg-emerald-50' },
    { name: '理财', emoji: '📈', icon: TrendingUp, color: 'text-sky-500 bg-sky-50' },
    { name: '收租', emoji: '🏢', icon: Home, color: 'text-cyan-500 bg-cyan-50' },
    { name: '兼职', emoji: '⚡', icon: Zap, color: 'text-indigo-500 bg-indigo-50' },
    { name: '其他', emoji: '⚙️', icon: Settings, color: 'text-slate-500 bg-slate-50' }
  ];

  const activeCategories = quickType === 'expense' ? expenseCategories : incomeCategories;

  const handleQuickAmountClick = (num: number) => {
    setQuickAmount(num.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(quickAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("⚠️ 请输入正确的金额数值！");
      return;
    }

    const now = new Date();
    const acc = accounts.find(a => a.id === quickAccount);
    const newTx: Transaction = {
      id: `quick-${Date.now()}`,
      type: quickType,
      amount: amt,
      category: quickCategory,
      accountId: quickAccount,
      accountName: acc?.name,
      date: now.toISOString().split('T')[0],
      time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      note: quickNote.trim() || quickCategory
    };

    onAddTransaction(newTx);
    
    // Reset state & close
    setQuickAmount('');
    setQuickNote('');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center font-sans">
        {/* Underlay / Overlay Blur Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
          id="quick-log-backdrop"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ y: "100%", opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0.8 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative bg-white rounded-t-[32px] w-full max-w-[390px] p-5 shadow-2xl border-t border-slate-100 flex flex-col space-y-4 max-h-[85vh] overflow-y-auto z-10 text-left"
          id="quick-log-modal-body"
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Plus size={18} className="stroke-[3]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 leading-tight">极速闪电记账</h3>
                <p className="text-[10px] text-slate-400 font-bold">记账秒级同步 • 激发成长值 ⚡</p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X size={16} className="stroke-[2.5]" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tab Selector: Expense vs Income */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-50 rounded-2xl">
              <button
                type="button"
                onClick={() => setQuickType('expense')}
                className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  quickType === 'expense'
                    ? 'bg-white text-rose-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                支出 (🍔 / 🚗 / 🏠)
              </button>
              <button
                type="button"
                onClick={() => setQuickType('income')}
                className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  quickType === 'income'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                收入 (💰 / 📈 / ⚡)
              </button>
            </div>

            {/* Large Amount Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">记账金额 (元)</label>
              <div className="relative flex items-center">
                <span className={`absolute left-3 text-lg font-black ${quickType === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>¥</span>
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-base font-black font-mono text-slate-800 placeholder-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition"
                  required
                />
              </div>
              
              {/* Quick shortcuts */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {(quickType === 'expense' ? [15, 30, 50, 100, 200, 500] : [100, 500, 1000, 2000, 5000, 10000]).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleQuickAmountClick(num)}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 rounded-xl text-[10.5px] font-extrabold text-slate-500 hover:text-indigo-600 transition cursor-pointer font-mono shrink-0"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Grid */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">选择收支分类</label>
              <div className="grid grid-cols-3 gap-2">
                {activeCategories.map((cat) => {
                  const isSel = quickCategory === cat.name;
                  const IconComp = cat.icon;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setQuickCategory(cat.name)}
                      className={`p-2.5 rounded-2xl text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border ${
                        isSel 
                          ? (quickType === 'expense' 
                              ? 'bg-rose-50 border-rose-200 text-rose-700 font-extrabold shadow-sm scale-102' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold shadow-sm scale-102')
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-600'
                      }`}
                    >
                      <span className="text-sm">{cat.emoji}</span>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">支付账户 (联动余额)</label>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setQuickAccount(acc.id)}
                    className={`px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold transition cursor-pointer shrink-0 border ${
                      quickAccount === acc.id
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {acc.icon} {acc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Note / Remark */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">交易备注 (选填)</label>
              <input
                type="text"
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="例如: 麦当劳、滴滴打车、加班费等..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-semibold text-slate-600 placeholder-slate-300 focus:outline-none focus:border-indigo-400 transition"
              />
            </div>

            {/* Primary Log Button */}
            <button
              type="submit"
              className={`w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md ${
                !quickAmount ? 'opacity-50 cursor-not-allowed' : 'hover:scale-101 active:scale-99'
              }`}
              disabled={!quickAmount}
            >
              <Check size={14} className="stroke-[3]" />
              <span>记入今日流水</span>
            </button>
          </form>

          {/* Footer Ledger link */}
          <div className="pt-3 border-t border-slate-50 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLedger();
              }}
              className="text-[10.5px] font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-full hover:scale-102 transition cursor-pointer"
            >
              <Wallet size={12} />
              <span>打开完整账簿 (对账、手势删改、划扣日程)</span>
              <ChevronRight size={12} className="stroke-[2.5]" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
