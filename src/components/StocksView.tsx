import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { storage } from '../storage';
import { KEYS } from '../storage/keys';
import { 
  Sparkles, Plus, Wallet, TrendingUp, TrendingDown, Trash2, 
  RefreshCw, DollarSign, BookOpen, Edit3, Percent, Check, X 
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface StockHolding {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  marketType: 'A股' | '港股' | '美股';
  assetType: '股票' | '基金' | 'ETF';
  dividendYield: number; // Dividend rate in % e.g. 4.2%
  investmentNote: string; // Thoughts, plan
}

export function StocksView() {
  const [holdings, setHoldings] = useState<StockHolding[]>(() => {
    return storage.get<StockHolding[]>(KEYS.STOCKS) ?? [
      { id: '1', symbol: '600519', name: '贵州茅台', shares: 100, avgPrice: 1600, currentPrice: 1645.5, marketType: 'A股', assetType: '股票', dividendYield: 1.8, investmentNote: '消费龙头，白酒护城河极深，逢低定投。' },
      { id: '2', symbol: '00700', name: '腾讯控股', shares: 400, avgPrice: 320, currentPrice: 382.4, marketType: '港股', assetType: '股票', dividendYield: 2.9, investmentNote: '互联网硬核社交底座，SAAS重估与游戏回暖。' },
      { id: '3', symbol: 'VOO', name: '标普500 ETF', shares: 25, avgPrice: 420, currentPrice: 512.2, marketType: '美股', assetType: 'ETF', dividendYield: 1.4, investmentNote: '国运红利，懒人定投之王。' },
    ];
  });

  // Modal & form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [shares, setShares] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [marketType, setMarketType] = useState<'A股' | '港股' | '美股'>('A股');
  const [assetType, setAssetType] = useState<'股票' | '基金' | 'ETF'>('股票');
  const [dividendRate, setDividendRate] = useState('');
  const [note, setNote] = useState('');

  // Persist to storage
  useEffect(() => {
    storage.set(KEYS.STOCKS, holdings);
  }, [holdings]);

  // Handle Save
  const handleSave = () => {
    if (!symbol || !name || !shares || !avgPrice || !currentPrice) {
      alert('请填写完整所有基本交易参数');
      return;
    }

    const item: StockHolding = {
      id: editingId || Date.now().toString(),
      symbol,
      name,
      shares: parseFloat(shares) || 0,
      avgPrice: parseFloat(avgPrice) || 0,
      currentPrice: parseFloat(currentPrice) || 0,
      marketType,
      assetType,
      dividendYield: parseFloat(dividendRate) || 0,
      investmentNote: note
    };

    if (editingId) {
      setHoldings(prev => prev.map(h => h.id === editingId ? item : h));
      setEditingId(null);
    } else {
      setHoldings(prev => [...prev, item]);
    }

    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setSymbol('');
    setName('');
    setShares('');
    setAvgPrice('');
    setCurrentPrice('');
    setMarketType('A股');
    setAssetType('股票');
    setDividendRate('');
    setNote('');
    setEditingId(null);
  };

  const startEdit = (h: StockHolding) => {
    setEditingId(h.id);
    setSymbol(h.symbol);
    setName(h.name);
    setShares(h.shares.toString());
    setAvgPrice(h.avgPrice.toString());
    setCurrentPrice(h.currentPrice.toString());
    setMarketType(h.marketType);
    setAssetType(h.assetType);
    setDividendRate(h.dividendYield.toString());
    setNote(h.investmentNote);
    setShowAddModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('确认删除此项持仓记录吗？')) {
      setHoldings(prev => prev.filter(h => h.id !== id));
    }
  };

  // Convert prices to CNY for overall visual dashboard consolidation
  // CNY = Rate 1.0, USD = Rate 7.25, HKD = Rate 0.93
  const getExchangeRate = (mType: 'A股' | '港股' | '美股') => {
    if (mType === '美股') return 7.25;
    if (mType === '港股') return 0.93;
    return 1.0;
  };

  const getCurrencySymbol = (mType: 'A股' | '港股' | '美股') => {
    if (mType === '美股') return '$';
    if (mType === '港股') return 'HK$';
    return '¥';
  };

  // Portfolio overall calculations
  let totalCostCNY = 0;
  let totalValueCNY = 0;
  let totalAnnualDividendsCNY = 0;

  holdings.forEach(h => {
    const rate = getExchangeRate(h.marketType);
    const costLocal = h.avgPrice * h.shares;
    const valueLocal = h.currentPrice * h.shares;
    
    totalCostCNY += costLocal * rate;
    totalValueCNY += valueLocal * rate;
    
    const divLocal = valueLocal * (h.dividendYield / 100);
    totalAnnualDividendsCNY += divLocal * rate;
  });

  const totalProfitCNY = totalValueCNY - totalCostCNY;
  const portfolioProfitPercent = totalCostCNY > 0 ? (totalProfitCNY / totalCostCNY) * 100 : 0;
  const avgPorfolioDividendRate = totalValueCNY > 0 ? (totalAnnualDividendsCNY / totalValueCNY) * 100 : 0;

  // Fake real-time feed update with cool green/red flashing
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleMockRefreshMarket = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setHoldings(prev => prev.map(h => {
        // fluctuate by -2% to +3%
        const pct = 1 + (Math.random() * 0.05 - 0.02);
        return {
          ...h,
          currentPrice: parseFloat((h.currentPrice * pct).toFixed(2))
        };
      }));
      setIsRefreshing(false);
    }, 800);
  };

  // Prepare chart data
  const pieData = holdings.map((h, index) => {
    const rate = getExchangeRate(h.marketType);
    return {
      name: h.name,
      value: Math.round(h.currentPrice * h.shares * rate)
    };
  }).filter(v => v.value > 0);

  const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto w-full text-left">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800">多市场持仓</h3>
          <p className="text-xs text-slate-400">一盘棋纵览 A股、美股、港股及公募基金</p>
        </div>
        <div className="flex gap-1.5">
          <button 
            onClick={handleMockRefreshMarket}
            className={`p-1.5 bg-slate-150 text-slate-600 rounded-xl transition hover:bg-slate-205 flex items-center ${isRefreshing ? 'animate-spin' : ''}`}
            title="模拟新浪腾讯财经实时行情获取"
          >
            <RefreshCw size={14} />
          </button>
          <button 
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-indigo-700 transition"
          >
            <Plus size={14} /> 新建持仓
          </button>
        </div>
      </div>

      {/* INVESTMENT OVERALL STATUS REPORT PANEL */}
      <Card className="border border-slate-100 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-4 bg-slate-950 text-slate-100 rounded-2xl relative">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">跨市场股票基金投资总市值 (等值人民币)</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black font-mono">¥{Math.round(totalValueCNY).toLocaleString()}</span>
                <span className={`text-xs font-bold font-mono ${totalProfitCNY >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {totalProfitCNY >= 0 ? '▲' : '▼'}{portfolioProfitPercent.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-slate-800 text-[11px] leading-relaxed">
              <div>
                <span className="text-slate-400 font-medium">累计浮动盈亏:</span>
                <p className={`font-bold font-mono text-xs ${totalProfitCNY >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {totalProfitCNY >= 0 ? '+' : ''}¥{Math.round(totalProfitCNY).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">预估年总股息红利:</span>
                <p className="font-bold text-amber-400 font-mono text-xs">
                  ¥{Math.round(totalAnnualDividendsCNY).toLocaleString()} <span className="font-normal text-[9px] text-slate-400">(平均 {avgPorfolioDividendRate.toFixed(1)}%)</span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HOLDINGS LIST */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-slate-500 px-1 uppercase block tracking-wider">当前持仓与投资备忘记录</span>
        {holdings.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 bg-slate-100 rounded-xl border border-dashed border-slate-200">
            暂无底仓账单，点击新建持仓录入第一笔投资
          </p>
        ) : (
          <div className="space-y-3">
            {holdings.map(h => {
              const localValue = h.currentPrice * h.shares;
              const rate = getExchangeRate(h.marketType);
              const valueCNY = localValue * rate;
              
              const diffLocal = h.currentPrice - h.avgPrice;
              const diffPct = (diffLocal / h.avgPrice) * 100;
              const isProfit = diffLocal >= 0;

              return (
                <Card key={h.id} className="border border-slate-100 hover:border-indigo-100/60 transition shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-3.5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-800 text-sm leading-tight">{h.name}</span>
                          <span className="text-[8px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold font-mono">
                            {h.symbol}
                          </span>
                          <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-semibold">
                            {h.marketType} · {h.assetType}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold font-mono">
                          {h.shares} 股 @ 成本 {getCurrencySymbol(h.marketType)}{h.avgPrice} ➔ 现价 {h.currentPrice}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-slate-900 font-mono block">
                          {getCurrencySymbol(h.marketType)}{localValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </span>
                        <span className={`text-[10px] font-bold font-mono ${isProfit ? 'text-red-600' : 'text-emerald-600'}`}>
                          {isProfit ? '+' : ''}{diffPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Investment notes */}
                    {h.investmentNote && (
                      <div className="bg-slate-50 p-2 rounded-xl text-[9px] text-slate-500 leading-normal border border-slate-100 flex gap-1 items-start">
                        <BookOpen size={11} className="text-slate-400 shrink-0 mt-0.5" />
                        <p>{h.investmentNote}</p>
                      </div>
                    )}

                    {/* Secondary detail row */}
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                      <span>利息股息: <b>{h.dividendYield}%</b></span>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(h)} className="text-indigo-600 font-bold hover:underline">编辑</button>
                        <button onClick={() => handleDelete(h.id)} className="text-rose-600 font-bold hover:underline">删除</button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* RECHARTS PORTFOLIO WEIGHT DISTRIBUTION PIE (C) */}
      {pieData.length > 0 && (
        <Card className="border border-slate-100 shadow-sm bg-white">
          <CardContent className="p-4 space-y-2 text-center text-xs">
            <span className="font-extrabold text-slate-700 block text-xs">持仓组合结构占比分析 (等效人民币)</span>
            <div className="h-[120px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legends */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[9px] text-slate-500">
               {pieData.map((ent, idx) => (
                 <span key={ent.name} className="flex items-center gap-1 font-medium">
                   <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                   {ent.name}
                 </span>
               ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ADD / EDIT TRANSACTION BOTTOM SHEET MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center backdrop-blur-xs">
          <div className="w-full max-w-[390px] bg-white rounded-t-3xl p-5 space-y-4 shadow-2xl overflow-y-auto max-h-[85vh] animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                <Plus size={16} className="text-indigo-600" />
                {editingId ? '修改证券持仓参数' : '建立跨市理财证券底账'}
              </h4>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-100 rounded-full">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-left">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">代码/编码</label>
                  <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="如AAPL, 600519" className="w-full p-2 bg-slate-100 rounded-xl text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">证券学名拼写</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="如标普500, 茅台" className="w-full p-2 bg-slate-100 rounded-xl text-xs font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">主营资本市场</label>
                  <select value={marketType} onChange={e => setMarketType(e.target.value as any)} className="w-full p-2 bg-slate-100 rounded-xl text-xs font-bold">
                    <option value="A股">中国A股 (¥)</option>
                    <option value="港股">中国港股 (HK$)</option>
                    <option value="美股">海外美股 ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">资产证券类别</label>
                  <select value={assetType} onChange={e => setAssetType(e.target.value as any)} className="w-full p-2 bg-slate-100 rounded-xl text-xs font-bold">
                    <option value="股票">单只股票</option>
                    <option value="基金">公募基金</option>
                    <option value="ETF">上市 ETF</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">持股/指数量 (股)</label>
                  <input type="number" value={shares} onChange={e => setShares(e.target.value)} placeholder="100" className="w-full p-2 bg-slate-100 rounded-xl text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">年化股息分红率 (%)</label>
                  <input type="number" step="0.1" value={dividendRate} onChange={e => setDividendRate(e.target.value)} placeholder="如2.5" className="w-full p-2 bg-slate-100 rounded-xl text-xs font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">平均买入单价价</label>
                  <input type="number" value={avgPrice} onChange={e => setAvgPrice(e.target.value)} placeholder="0.00" className="w-full p-2 bg-slate-100 rounded-xl text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">当前行情参考单价</label>
                  <input type="number" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} placeholder="0.00" className="w-full p-2 bg-slate-100 rounded-xl text-xs font-bold" />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 mb-1">投资笔记及复盘思路</label>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="买入逻辑、止盈心理线等..." className="w-full p-2 bg-slate-100 rounded-xl text-xs" />
              </div>

              <button onClick={handleSave} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition">
                保存证券持仓
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
