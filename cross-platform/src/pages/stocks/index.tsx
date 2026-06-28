import { useState } from 'react';
import { View, Text, Input, Textarea } from '@tarojs/components';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import { MiniPie } from '../../components/MiniChart';
import { EChart } from '../../components/EChart';
import { confirmAsync, alertAsync } from '../../utils/platform';
import './index.css';

/**
 * 跨端证券持仓页（移植自上游 StocksView）。
 * 改造点：
 * - recharts 饼图 → MiniPie
 * - <select> → 按钮组选择
 * - confirm/alert → confirmAsync/alertAsync
 * - div/input/textarea/button → View/Input/Textarea/Motion
 * - storage 原样复用（KEYS.STOCKS，跨端注入后自动适配）
 */

interface StockHolding {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  marketType: 'A股' | '港股' | '美股';
  assetType: '股票' | '基金' | 'ETF';
  dividendYield: number;
  investmentNote: string;
}

const DEFAULT_HOLDINGS: StockHolding[] = [
  { id: '1', symbol: '600519', name: '贵州茅台', shares: 100, avgPrice: 1600, currentPrice: 1645.5, marketType: 'A股', assetType: '股票', dividendYield: 1.8, investmentNote: '消费龙头，白酒护城河极深，逢低定投。' },
  { id: '2', symbol: '00700', name: '腾讯控股', shares: 400, avgPrice: 320, currentPrice: 382.4, marketType: '港股', assetType: '股票', dividendYield: 2.9, investmentNote: '互联网硬核社交底座，SAAS重估与游戏回暖。' },
  { id: '3', symbol: 'VOO', name: '标普500 ETF', shares: 25, avgPrice: 420, currentPrice: 512.2, marketType: '美股', assetType: 'ETF', dividendYield: 1.4, investmentNote: '国运红利，懒人定投之王。' },
];

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

function getExchangeRate(mType: 'A股' | '港股' | '美股') {
  if (mType === '美股') return 7.25;
  if (mType === '港股') return 0.93;
  return 1.0;
}
function getCurrencySymbol(mType: 'A股' | '港股' | '美股') {
  if (mType === '美股') return '$';
  if (mType === '港股') return 'HK$';
  return '¥';
}

export default function Stocks() {
  const [holdings, setHoldings] = useState<StockHolding[]>(
    () => storage.get<StockHolding[]>(KEYS.STOCKS) ?? DEFAULT_HOLDINGS,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [shares, setShares] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [marketType, setMarketType] = useState<'A股' | '港股' | '美股'>('A股');
  const [assetType, setAssetType] = useState<'股票' | '基金' | 'ETF'>('股票');
  const [dividendRate, setDividendRate] = useState('');
  const [note, setNote] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const persist = (next: StockHolding[]) => {
    setHoldings(next);
    storage.set(KEYS.STOCKS, next);
  };

  const handleSave = () => {
    if (!symbol || !name || !shares || !avgPrice || !currentPrice) {
      alertAsync('请填写完整所有基本交易参数');
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
      investmentNote: note,
    };
    if (editingId) {
      persist(holdings.map((h) => (h.id === editingId ? item : h)));
    } else {
      persist([...holdings, item]);
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

  const handleDelete = async (id: string) => {
    if (!(await confirmAsync('确认删除此项持仓记录吗？'))) return;
    persist(holdings.filter((h) => h.id !== id));
  };

  const handleMockRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      persist(
        holdings.map((h) => ({
          ...h,
          currentPrice: parseFloat((h.currentPrice * (1 + (Math.random() * 0.05 - 0.02))).toFixed(2)),
        })),
      );
      setIsRefreshing(false);
    }, 800);
  };

  // 组合总览
  let totalCostCNY = 0;
  let totalValueCNY = 0;
  let totalAnnualDividendsCNY = 0;
  holdings.forEach((h) => {
    const rate = getExchangeRate(h.marketType);
    totalCostCNY += h.avgPrice * h.shares * rate;
    totalValueCNY += h.currentPrice * h.shares * rate;
    totalAnnualDividendsCNY += h.currentPrice * h.shares * (h.dividendYield / 100) * rate;
  });
  const totalProfitCNY = totalValueCNY - totalCostCNY;
  const portfolioProfitPercent = totalCostCNY > 0 ? (totalProfitCNY / totalCostCNY) * 100 : 0;
  const avgDividendRate = totalValueCNY > 0 ? (totalAnnualDividendsCNY / totalValueCNY) * 100 : 0;

  const pieData = holdings
    .map((h) => ({
      name: h.name,
      value: Math.round(h.currentPrice * h.shares * getExchangeRate(h.marketType)),
    }))
    .filter((v) => v.value > 0)
    .map((d, i) => ({ ...d, color: COLORS[i % COLORS.length] }));

  return (
    <View className='p-4 space-y-4 max-w-md mx-auto w-full text-left min-h-screen bg-slate-50 pb-6'>
      {/* 标题栏 */}
      <View className='flex justify-between items-center'>
        <View>
          <Text className='text-xl font-bold text-slate-800 block'>多市场持仓</Text>
          <Text className='text-xs text-slate-400 block'>一盘棋纵览 A股、美股、港股及公募基金</Text>
        </View>
        <View className='flex gap-1.5'>
          <Motion
            tapScale={0.95}
            onClick={handleMockRefresh}
            className={`p-1.5 bg-slate-100 text-slate-600 rounded-xl flex items-center ${isRefreshing ? 'opacity-50' : ''}`}
          >
            <Icon name='loader' size={14} />
          </Motion>
          <Motion
            tapScale={0.95}
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className='px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1'
          >
            <Icon name='plus' size={14} /> 新建持仓
          </Motion>
        </View>
      </View>

      {/* 总览卡片 */}
      <Card className='border border-slate-100 bg-white overflow-hidden'>
        <CardContent className='p-4 bg-slate-950 text-slate-100 rounded-2xl'>
          <Text className='text-[10px] text-slate-400 font-bold uppercase tracking-wider block'>
            跨市场投资总市值 (等值人民币)
          </Text>
          <View className='flex items-baseline gap-2 mt-0.5'>
            <Text className='text-2xl font-black font-mono'>¥{Math.round(totalValueCNY).toLocaleString()}</Text>
            <Text className={`text-xs font-bold font-mono ${totalProfitCNY >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {totalProfitCNY >= 0 ? '▲' : '▼'}{portfolioProfitPercent.toFixed(2)}%
            </Text>
          </View>
          <View className='grid grid-cols-2 gap-4 pt-3.5 border-t border-slate-800 text-[11px] mt-3'>
            <View>
              <Text className='text-slate-400 font-medium block'>累计浮动盈亏:</Text>
              <Text className={`font-bold font-mono text-xs block ${totalProfitCNY >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {totalProfitCNY >= 0 ? '+' : ''}¥{Math.round(totalProfitCNY).toLocaleString()}
              </Text>
            </View>
            <View>
              <Text className='text-slate-400 font-medium block'>预估年股息红利:</Text>
              <Text className='font-bold text-amber-400 font-mono text-xs block'>
                ¥{Math.round(totalAnnualDividendsCNY).toLocaleString()}{' '}
                <Text className='font-normal text-[9px] text-slate-400'>(平均 {avgDividendRate.toFixed(1)}%)</Text>
              </Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* 持仓列表 */}
      <View className='space-y-3'>
        <Text className='text-[10px] font-bold text-slate-500 px-1 uppercase block tracking-wider'>
          当前持仓与投资备忘
        </Text>
        {holdings.length === 0 ? (
          <Text className='text-xs text-slate-400 text-center py-6 bg-slate-100 rounded-xl block'>
            暂无底仓，点击新建持仓录入第一笔投资
          </Text>
        ) : (
          holdings.map((h) => {
            const localValue = h.currentPrice * h.shares;
            const diffLocal = h.currentPrice - h.avgPrice;
            const diffPct = (diffLocal / h.avgPrice) * 100;
            const isProfit = diffLocal >= 0;
            return (
              <Card key={h.id}>
                <CardContent className='p-3.5 space-y-3'>
                  <View className='flex justify-between items-start'>
                    <View className='space-y-0.5 flex-1 min-w-0'>
                      <View className='flex items-center gap-1.5 flex-wrap'>
                        <Text className='font-extrabold text-slate-800 text-sm'>{h.name}</Text>
                        <Text className='text-[8px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold font-mono'>
                          {h.symbol}
                        </Text>
                        <Text className='text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-semibold'>
                          {h.marketType} · {h.assetType}
                        </Text>
                      </View>
                      <Text className='text-[10px] text-slate-400 font-semibold font-mono block'>
                        {h.shares} 股 @ 成本 {getCurrencySymbol(h.marketType)}{h.avgPrice} ➔ 现价 {h.currentPrice}
                      </Text>
                    </View>
                    <View className='text-right shrink-0'>
                      <Text className='text-xs font-black text-slate-900 font-mono block'>
                        {getCurrencySymbol(h.marketType)}{localValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </Text>
                      <Text className={`text-[10px] font-bold font-mono block ${isProfit ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isProfit ? '+' : ''}{diffPct.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  {h.investmentNote && (
                    <View className='bg-slate-50 p-2 rounded-xl text-[9px] text-slate-500 border border-slate-100 flex gap-1 items-start'>
                      <Icon name='info' size={11} className='text-slate-400 shrink-0 mt-0.5' />
                      <Text className='flex-1'>{h.investmentNote}</Text>
                    </View>
                  )}

                  <View className='flex justify-between items-center pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-medium'>
                    <Text>股息率: <Text className='font-bold'>{h.dividendYield}%</Text></Text>
                    <View className='flex gap-3'>
                      <Text className='text-indigo-600 font-bold' onClick={() => startEdit(h)}>编辑</Text>
                      <Text className='text-rose-600 font-bold' onClick={() => handleDelete(h.id)}>删除</Text>
                    </View>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </View>

      {/* 持仓占比饼图 */}
      {pieData.length > 0 && (
        <Card>
          <CardContent className='p-4 space-y-3 text-center'>
            <Text className='font-extrabold text-slate-700 block text-xs'>持仓组合结构占比 (等效人民币)</Text>
            <View className='flex items-center justify-around'>
              <EChart
                height={130}
                option={{
                  tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
                  series: [{
                    type: 'pie',
                    radius: ['45%', '72%'],
                    center: ['35%', '50%'],
                    label: { show: false },
                    labelLine: { show: false },
                    data: pieData.map((ent) => ({ name: ent.name, value: ent.value, itemStyle: { color: ent.color } })),
                  }],
                }}
              />
              <View className='flex flex-col gap-1.5'>
                {pieData.map((ent) => (
                  <View key={ent.name} className='flex items-center gap-1'>
                    <View style={{ width: '8px', height: '8px', borderRadius: '50%', background: ent.color }} />
                    <Text className='text-[9px] text-slate-500'>{ent.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </CardContent>
        </Card>
      )}

      {/* 新增/编辑 Modal */}
      {showAddModal && (
        <View className='fixed inset-0 bg-slate-900/60 z-50 flex items-end'>
          <View className='w-full bg-white rounded-t-3xl p-5 space-y-3 max-h-[85vh] overflow-y-auto'>
            <View className='flex justify-between items-center border-b border-slate-100 pb-2'>
              <Text className='font-bold text-slate-900 flex items-center gap-1.5 text-sm'>
                <Icon name='plus' size={16} className='text-indigo-600' />
                {editingId ? '修改证券持仓' : '建立跨市证券底账'}
              </Text>
              <Text className='text-slate-400 text-xl' onClick={() => setShowAddModal(false)}>✕</Text>
            </View>

            <View className='grid grid-cols-2 gap-2'>
              <View>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>代码</Text>
                <Input value={symbol} onInput={(e) => setSymbol(e.detail.value)} placeholder='如AAPL, 600519' className='w-full p-2 bg-slate-100 rounded-xl text-xs font-bold' />
              </View>
              <View>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>名称</Text>
                <Input value={name} onInput={(e) => setName(e.detail.value)} placeholder='如茅台' className='w-full p-2 bg-slate-100 rounded-xl text-xs font-bold' />
              </View>
            </View>

            <View>
              <Text className='block text-[9px] font-bold text-slate-500 mb-1'>市场</Text>
              <View className='flex gap-1'>
                {(['A股', '港股', '美股'] as const).map((m) => (
                  <Motion key={m} tapScale={0.95} onClick={() => setMarketType(m)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg text-center ${marketType === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {m}
                  </Motion>
                ))}
              </View>
            </View>
            <View>
              <Text className='block text-[9px] font-bold text-slate-500 mb-1'>类别</Text>
              <View className='flex gap-1'>
                {(['股票', '基金', 'ETF'] as const).map((a) => (
                  <Motion key={a} tapScale={0.95} onClick={() => setAssetType(a)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg text-center ${assetType === a ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {a}
                  </Motion>
                ))}
              </View>
            </View>

            <View className='grid grid-cols-2 gap-2'>
              <View>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>持仓量 (股)</Text>
                <Input type='digit' value={shares} onInput={(e) => setShares(e.detail.value)} placeholder='100' className='w-full p-2 bg-slate-100 rounded-xl text-xs font-bold' />
              </View>
              <View>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>股息率 (%)</Text>
                <Input type='digit' value={dividendRate} onInput={(e) => setDividendRate(e.detail.value)} placeholder='如2.5' className='w-full p-2 bg-slate-100 rounded-xl text-xs font-bold' />
              </View>
            </View>
            <View className='grid grid-cols-2 gap-2'>
              <View>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>平均买入价</Text>
                <Input type='digit' value={avgPrice} onInput={(e) => setAvgPrice(e.detail.value)} placeholder='0.00' className='w-full p-2 bg-slate-100 rounded-xl text-xs font-bold' />
              </View>
              <View>
                <Text className='block text-[9px] font-bold text-slate-500 mb-1'>当前行情价</Text>
                <Input type='digit' value={currentPrice} onInput={(e) => setCurrentPrice(e.detail.value)} placeholder='0.00' className='w-full p-2 bg-slate-100 rounded-xl text-xs font-bold' />
              </View>
            </View>

            <View>
              <Text className='block text-[9px] font-bold text-slate-500 mb-1'>投资笔记</Text>
              <Textarea value={note} onInput={(e) => setNote(e.detail.value)} placeholder='买入逻辑、止盈线...' className='w-full p-2 bg-slate-100 rounded-xl text-xs' style={{ height: '50px' }} />
            </View>

            <Motion tapScale={0.98} onClick={handleSave} className='w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs text-center'>
              保存证券持仓
            </Motion>
          </View>
        </View>
      )}
    </View>
  );
}
