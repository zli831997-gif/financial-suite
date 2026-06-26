import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Transaction } from '../types';
import type { Account } from '../logic/domain/accounts';
import type { Template } from '../logic/domain/templates';
import { isAutoLoggedToday } from '../logic/domain/templates';
import { getReminders, type Reminder } from '../logic/domain/reminders';
import { FinanceAppState } from '../utils/financeState';
import { 
  Plus, X, Wallet, Trash2, Star, RefreshCw, CheckCircle2, 
  Upload, FileSpreadsheet, Play, AlertCircle, Sparkles, Check 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SwipeableItemProps {
  transaction: Transaction;
  onDelete: (id: string) => void;
  onToggleImportant: (id: string) => void;
}

export function SwipeableItem({ transaction, onDelete, onToggleImportant }: SwipeableItemProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-100 shadow-sm select-none border border-slate-100">
      {/* Background Actions */}
      <div className="absolute inset-0 flex items-center justify-between pointer-events-none z-0">
        {/* Swipe Right / Mark Important Action (revealed on Left side) */}
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 h-full w-1/2 pl-5 justify-start absolute left-0">
          <Star size={16} fill={transaction.important ? "#f59e0b" : "none"} stroke={transaction.important ? "#d97706" : "currentColor"} className="shrink-0" />
          <span className="text-[11px] font-bold">{transaction.important ? '取消重要' : '标记重要'}</span>
        </div>
        
        {/* Swipe Left / Delete Action (revealed on Right side) */}
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 h-full w-1/2 pr-5 justify-end absolute right-0">
          <span className="text-[11px] font-bold">手势删除</span>
          <Trash2 size={16} className="shrink-0" />
        </div>
      </div>

      {/* Main Content card */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0.6 }}
        onDragEnd={(_event, info) => {
          if (info.offset.x < -80) {
            onDelete(transaction.id);
          } else if (info.offset.x > 80) {
            onToggleImportant(transaction.id);
          }
        }}
        className={`relative z-10 bg-white p-3 md:p-4 flex items-center justify-between cursor-grab active:cursor-grabbing transition-shadow ${
          transaction.important ? 'border-l-4 border-amber-500' : ''
        }`}
      >
        <div className="flex items-center gap-3 text-left">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${
            transaction.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            {transaction.type === 'income' ? '💰' : '☕'}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-semibold text-slate-800 text-sm leading-tight">{transaction.note}</h4>
              {transaction.important && (
                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Star size={8} fill="#d97706" stroke="#d97706" /> 重要
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{transaction.date} · {transaction.category}</p>
          </div>
        </div>
        <div className="text-right shrink-0 pl-2">
          <p className={`font-bold text-sm ${transaction.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
            {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

interface AccountingViewProps {
  transactions: Transaction[];
  accounts: Account[];
  templates: Template[];
  onAddTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onToggleImportantTransaction: (id: string) => void;
  onToggleTemplate: (id: string, enabled: boolean) => void;
  onUpdateTemplate: (id: string, updates: Partial<Template>) => void;
  initialBillView?: 'all' | 'expense' | 'income';
  financeState?: FinanceAppState;
}

export function AccountingView({
  transactions,
  accounts,
  templates,
  onAddTransaction,
  onDeleteTransaction,
  onToggleImportantTransaction,
  onToggleTemplate,
  onUpdateTemplate,
  initialBillView,
  financeState
}: AccountingViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'auto_template' | 'csv_import'>('list');
  const [billView, setBillView] = useState<'all' | 'expense' | 'income'>(initialBillView ?? 'all');
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('餐饮');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('acc_wechat');

  // CSV State
  const [csvText, setCsvText] = useState('');
  const [parsedItems, setParsedItems] = useState<Transaction[]>([]);
  const [importSelectedOnly, setImportSelectedOnly] = useState<boolean>(true);

  // 模板来自 props（fin_templates domain，App 传入；启用后按周期自动入账）

  const handleSave = () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    const now = new Date();
    const acc = accounts.find(a => a.id === accountId);
    const newTx: Transaction = {
      id: Date.now().toString(),
      type,
      amount: parseFloat(amount),
      category,
      accountId,
      accountName: acc?.name,
      date: now.toISOString().split('T')[0],
      time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      note: note || category
    };
    onAddTransaction(newTx);
    setShowModal(false);
    setAmount('');
    setNote('');
  };

  const handleApplyTemplate = (tpl: Template) => {
    const today = new Date();
    const todayDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const newTx: Transaction = {
      id: `manual-${tpl.id}-${Date.now()}`,
      type: tpl.type,
      amount: tpl.amount,
      category: tpl.category,
      accountId: tpl.accountId,
      accountName: tpl.accountName,
      date: todayDate,
      time: '09:00',
      note: `【手动】${tpl.name}`
    };
    onAddTransaction(newTx);
  };

  // Demo CSV payload generator
  const loadDemoCSV = () => {
    const data = `交易时间,交易分类,交易对方,商品名称,金额,收/支
2026-06-22 12:45:00,餐饮美食,麦当劳中国,双层至尊吉士牛套餐,28.50,支出
2026-06-22 18:30:00,交通出行,滴滴出行,打车车费,36.40,支出
2026-06-21 19:15:00,休闲娱乐,爱奇艺科技,黄金VIP按季自动续费,68.00,支出
2026-06-21 10:10:00,其他收入,社交红包,来自张三的转账,200.00,收入
2026-06-20 09:12:00,数码购物,拼多多小店,Type-C快充尼龙数据线,15.90,支出`;
    setCsvText(data);
  };

  const parseCSV = () => {
    if (!csvText.trim()) return;
    const lines = csvText.split('\n');
    const computedList: Transaction[] = [];
    
    // Simple but robust CSV parser that checks common tokens in Chinese Alipay/WeChat billing
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length < 5) continue;

      const datePart = parts[0] || new Date().toISOString().split('T')[0];
      const categoryPart = parts[1] || '其他';
      const opposite = parts[2] || '';
      const prodName = parts[3] || '';
      const valueRaw = parts[4] || '0';
      const typePart = parts[5] || '支出';

      const isIncome = typePart.includes('收') || parseFloat(valueRaw) > 0;
      
      // Remap category to our native accounting taxonomy
      let nativeCategory = '其他';
      if (categoryPart.includes('食') || categoryPart.includes('餐')) {
        nativeCategory = '餐饮';
      } else if (categoryPart.includes('行') || categoryPart.includes('交') || categoryPart.includes('理')) {
        nativeCategory = '交通';
      } else if (categoryPart.includes('玩') || categoryPart.includes('乐')) {
        nativeCategory = '娱乐';
      } else if (categoryPart.includes('雇') || categoryPart.includes('资') || categoryPart.includes('薪')) {
        nativeCategory = '工资';
      } else if (categoryPart.includes('投') || categoryPart.includes('理')) {
        nativeCategory = '投资理财';
      } else if (categoryPart.includes('房') || categoryPart.includes('租') || categoryPart.includes('宿')) {
        nativeCategory = '住房';
      } else if (categoryPart.includes('医') || categoryPart.includes('药')) {
        nativeCategory = '医疗';
      } else if (categoryPart.includes('红包') || categoryPart.includes('转')) {
        nativeCategory = isIncome ? '兼职' : '其他';
      } else if (categoryPart.includes('购') || categoryPart.includes('买')) {
        nativeCategory = '购物';
      }

      computedList.push({
        id: `csv-${i}-${Date.now()}`,
        type: isIncome ? 'income' : 'expense',
        amount: Math.abs(parseFloat(valueRaw)) || 0,
        category: nativeCategory,
        accountId: 'acc_wechat',
        accountName: '微信',
        date: datePart.split(' ')[0], // only keep YYYY-MM-DD
        note: `${opposite || ''} - ${prodName || categoryPart}`
      });
    }

    setParsedItems(computedList);
  };

  const commitCsvImport = () => {
    if (parsedItems.length === 0) return;
    parsedItems.forEach(item => {
      onAddTransaction(item);
    });
    alert(`🎉 成功解析并一键合并导入了 ${parsedItems.length} 条移动对账明细，已重算成长等级和财气点数！`);
    setParsedItems([]);
    setCsvText('');
    setActiveSubTab('list');
  };

  const categories = type === 'expense' 
    ? ['餐饮', '交通', '购物', '娱乐', '住房', '医疗', '其他']
    : ['工资', '投资理财', '分红', '兼职', '其他'];

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto w-full relative">
       <div className="flex justify-between items-center">
         <div>
           <h3 className="text-xl font-bold text-slate-800">记账账簿</h3>
           <p className="text-xs text-slate-400">管理日常明细、固流计账与自动对账</p>
         </div>
         <button 
           onClick={() => setShowModal(true)}
           className="px-3 py-1.5.5 bg-indigo-600 text-white rounded-xl font-semibold text-xs flex items-center gap-1 hover:bg-indigo-700 active:bg-indigo-800 transition"
         >
           <Plus size={14} /> 记一笔
         </button>
       </div>

       {/* 账户余额展示（验证余额联动） */}
       <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
         {accounts.map(acc => (
           <div key={acc.id} className={`shrink-0 px-3 py-2 rounded-xl border ${acc.type === 'credit' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
             <p className="text-[9px] text-slate-400 font-bold">{acc.icon} {acc.name}</p>
             <p className={`text-xs font-black font-mono ${acc.balance < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
               ¥{acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
             </p>
           </div>
         ))}
       </div>

       {/* Sub Tab selection bar */}
       <div className="flex bg-slate-200/60 p-1 rounded-2xl w-full border border-slate-100">
         <button 
           onClick={() => setActiveSubTab('list')}
           className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition ${activeSubTab === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
         >
           日常明细
         </button>
         <button 
           onClick={() => setActiveSubTab('auto_template')}
           className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition ${activeSubTab === 'auto_template' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
         >
           固定账单 ({templates.filter(x=>x.enabled).length})
         </button>
         <button 
           onClick={() => setActiveSubTab('csv_import')}
           className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition ${activeSubTab === 'csv_import' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
         >
           CSV 导入
         </button>
       </div>

       {activeSubTab === 'list' && (() => {
         const list = billView === 'all' ? transactions : transactions.filter(t => t.type === billView);
         return (
         <>
           <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
             <button onClick={() => setBillView('all')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${billView === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>全部账单</button>
             <button onClick={() => setBillView('expense')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${billView === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>支出账单</button>
             <button onClick={() => setBillView('income')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${billView === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>收入账单</button>
           </div>
           {list.length === 0 ? (
             <Card className="shadow-sm border border-slate-100">
               <CardContent className="p-12 text-center text-slate-400 text-xs">
                 {billView === 'all' ? '暂无日常明细，点击右上角「记一笔」添加' : `暂无${billView === 'expense' ? '支出' : '收入'}账单`}
               </CardContent>
             </Card>
           ) : (
             <div className="space-y-3">
               <div className="text-[10px] text-slate-400 text-center font-medium">
                 💡 极简手势：记录「向左滑删除」 · 「向右滑置顶重要」
               </div>
               
               <div className="space-y-2.5">
                 <AnimatePresence initial={false}>
                   {list.map(t => (
                     <motion.div
                       key={t.id}
                       initial={{ opacity: 0, height: 0, y: -10 }}
                       animate={{ opacity: 1, height: 'auto', y: 0 }}
                       exit={{ opacity: 0, height: 0, scale: 0.9, transition: { duration: 0.2 } }}
                       style={{ overflow: 'hidden' }}
                     >
                       <SwipeableItem 
                         transaction={t} 
                         onDelete={onDeleteTransaction} 
                         onToggleImportant={onToggleImportantTransaction} 
                       />
                     </motion.div>
                   ))}
                 </AnimatePresence>
               </div>
             </div>
           )}
         </>
         );
       })()}

       {activeSubTab === 'auto_template' && (
         <div className="space-y-4 text-left">
          {/* 账单提醒（from fin_reminders，entitySync 从房/车贷款派生） */}
          {(() => {
            const reminders: Reminder[] = getReminders();
            if (reminders.length === 0) return null;
            const todayD = new Date().getDate();
            const daysTo = (day: number) => (day - todayD + 31) % 31;
            const todayList = reminders.filter(r => r.day === todayD);
            const upcoming = reminders.filter(r => r.day !== todayD).sort((a, b) => daysTo(a.day) - daysTo(b.day)).slice(0, 5);
            const card = (r: Reminder, isToday: boolean) => (
              <div key={r.id} className={`p-2.5 rounded-xl flex justify-between items-center border ${isToday ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{r.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{r.name}</p>
                    <p className={`text-[10px] font-semibold ${isToday ? 'text-rose-600' : 'text-slate-400'}`}>{isToday ? '今日到期' : `每月${r.day}号 · ${daysTo(r.day)}天后`}</p>
                  </div>
                </div>
                <span className={`text-xs font-black font-mono shrink-0 ${isToday ? 'text-rose-600' : 'text-slate-700'}`}>¥{r.amount.toLocaleString()}</span>
              </div>
            );
            return (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">⏰ 账单提醒</h4>
                {todayList.map(r => card(r, true))}
                {upcoming.map(r => card(r, false))}
              </div>
            );
          })()}


          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">固流固定收支（启用后按周期自动入账）</h4>
             {templates.map(tpl => {
               const loggedToday = isAutoLoggedToday(tpl.id);
               return (
               <Card key={tpl.id} className={`border border-slate-100 shadow-sm bg-white overflow-hidden ${tpl.enabled ? '' : 'opacity-60'}`}>
                 <CardContent className="p-4 flex justify-between items-center bg-white">
                   <div className="space-y-0.5 flex-1 min-w-0">
                     <div className="flex items-center gap-2 flex-wrap">
                       <span className="font-extrabold text-slate-800 text-xs">{tpl.name}</span>
                       <span className="bg-slate-100 text-slate-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full font-mono">
                         每月 {tpl.day ?? 1} 日
                       </span>
                       {loggedToday && tpl.enabled && (
                         <span className="bg-emerald-100 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded-full">今日已自动</span>
                       )}
                     </div>
                     <p className="text-[10px] text-slate-400 font-medium">{tpl.note} · {tpl.category}</p>
                   </div>
                   <div className="flex items-center gap-1.5 shrink-0">
                     <span className={`text-xs font-black font-mono ${tpl.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                       {tpl.type === 'income' ? '+' : '-'}¥{tpl.amount}
                     </span>
                     <button
                       onClick={() => {
                         const v = window.prompt(`编辑「${tpl.name}」金额`, String(tpl.amount));
                         if (v !== null && !isNaN(parseFloat(v))) onUpdateTemplate(tpl.id, { amount: parseFloat(v) });
                       }}
                       className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-bold transition"
                       title="编辑金额"
                     >改</button>
                     <button
                       onClick={() => onToggleTemplate(tpl.id, !tpl.enabled)}
                       className={`px-2 py-1 rounded-lg text-[9px] font-bold transition ${tpl.enabled ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}
                     >{tpl.enabled ? '开' : '关'}</button>
                     <button
                       onClick={() => handleApplyTemplate(tpl)}
                       className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9px] font-bold flex items-center gap-1 transition"
                     >
                       <Check size={10} strokeWidth={3} />
                       划扣
                     </button>
                   </div>
                 </CardContent>
               </Card>
               );
             })}
           </div>
         </div>
       )}

       {activeSubTab === 'csv_import' && (
         <div className="space-y-4 text-left">
           <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex gap-1.5 items-start">
             <Upload size={16} className="text-indigo-600 shrink-0 mt-0.5" />
             <div>
               <p className="text-xs font-bold text-indigo-950 mb-0.5">微信、支付宝 CSV 对账账单归类</p>
               <p className="text-[10px] text-indigo-900 leading-normal">
                 支持黏贴或导入微信/支付宝纯文本CSV格式。系统具有智能分词机制，能够一键解析对方商家并精准映射分属于「餐饮、交通、购物、医疗」等标准分类。
               </p>
             </div>
           </div>

           <div className="space-y-2 bg-slate-100/50 p-3 rounded-2xl border border-slate-200/50">
             <div className="flex justify-between items-center mb-1">
               <span className="text-[10px] font-bold text-slate-600">CSV 文本内容粘贴区</span>
               <button 
                 onClick={loadDemoCSV} 
                 className="text-[9px] text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg px-2 py-0.5 flex items-center gap-1"
               >
                 <Sparkles size={10} /> 载入样例 CSV 看看
               </button>
             </div>

             <textarea
               rows={4}
               value={csvText}
               onChange={e => setCsvText(e.target.value)}
               placeholder="交易时间,交易分类,交易对方,商品名称,金额,收/支..."
               className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-mono text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 overflow-y-auto"
             ></textarea>

             <button 
               onClick={parseCSV}
               disabled={!csvText.trim()}
               className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-350 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition"
             >
               <FileSpreadsheet size={13} />
               解析并生成草稿
             </button>
           </div>

           {parsedItems.length > 0 && (
             <div className="space-y-3">
               <div className="flex justify-between items-center px-1">
                 <h4 className="text-xs font-bold text-indigo-950">
                   📂 草稿池已解析 {parsedItems.length} 条账单
                 </h4>
               </div>

               <div className="space-y-2 max-h-[180px] overflow-y-auto pr-0.5">
                 {parsedItems.map((item, idx) => (
                   <div key={item.id} className="p-2.5 bg-white border border-slate-150 rounded-xl flex justify-between items-center text-xs">
                     <div className="space-y-0.5">
                       <p className="font-semibold text-slate-800 text-[11px] truncate max-w-[160px]">{item.note}</p>
                       <p className="text-[9px] text-slate-400">{item.date} · {item.category}</p>
                     </div>
                     <span className={`font-bold font-mono text-xs ${item.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                       {item.type === 'income' ? '+' : '-'}¥{item.amount.toLocaleString()}
                     </span>
                   </div>
                 ))}
               </div>

               <button 
                 onClick={commitCsvImport}
                 className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
               >
                 <CheckCircle2 size={13} />
                 一键合并写入核心账簿
               </button>
             </div>
           )}
         </div>
       )}

       {/* Native styled Bottom Sheet Modal */}
       {showModal && (
         <div className="absolute inset-0 bg-slate-900/60 z-50 flex items-end">
           <div className="w-full bg-white rounded-t-3xl p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-250">
             <div className="flex justify-between items-center pb-2 border-b border-slate-100">
               <h4 className="font-bold text-slate-900 flex items-center gap-1.5"><Wallet className="text-indigo-500 w-5 h-5"/> 记录一笔收支</h4>
               <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
             </div>

             <div className="flex bg-slate-100 p-1 rounded-xl">
               <button 
                 onClick={() => { setType('expense'); setCategory('餐饮'); }}
                 className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${type === 'expense' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
               >
                 支出
               </button>
               <button 
                 onClick={() => { setType('income'); setCategory('工资'); }}
                 className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${type === 'income' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
               >
                 收入
               </button>
             </div>

             <div className="space-y-1 text-left">
               <label className="text-xs font-semibold text-slate-500">账单金额 (元)</label>
               <input 
                 type="number" 
                 pattern="[0-9]*"
                 inputMode="decimal"
                 placeholder="0.00" 
                 value={amount} 
                 onChange={e => setAmount(e.target.value)}
                 className="w-full bg-slate-100 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
               />
             </div>

             <div className="space-y-1 text-left">
               <label className="text-xs font-semibold text-slate-400">账目分类</label>
               <div className="flex flex-wrap gap-1.5">
                 {categories.map(cat => (
                   <button
                     key={cat}
                     onClick={() => setCategory(cat)}
                     className={`px-3 py-1 text-xs font-medium border rounded-lg transition ${category === cat ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                   >
                     {cat}
                   </button>
                 ))}
               </div>
             </div>

             <div className="space-y-1 text-left">
               <label className="text-xs font-semibold text-slate-400">支付账户 (联动余额)</label>
               <div className="flex flex-wrap gap-1.5">
                 {accounts.map(acc => (
                   <button
                     key={acc.id}
                     onClick={() => setAccountId(acc.id)}
                     className={`px-3 py-1 text-xs font-medium border rounded-lg transition ${accountId === acc.id ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                   >
                     {acc.icon} {acc.name}
                   </button>
                 ))}
               </div>
             </div>

             <div className="space-y-1 text-left">
               <label className="text-xs font-semibold text-slate-500">备注</label>
               <input 
                 type="text" 
                 placeholder="添加账单说明..." 
                 value={note} 
                 onChange={e => setNote(e.target.value)}
                 className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none"
               />
             </div>

             <button 
               onClick={handleSave}
               className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition"
             >
               保存账单
             </button>
           </div>
         </div>
       )}
    </div>
  );
}
