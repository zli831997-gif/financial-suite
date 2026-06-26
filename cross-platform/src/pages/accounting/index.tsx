import { useState } from 'react';
import { View, Text, Input, Textarea } from '@tarojs/components';
import type { Transaction } from '@finance/types';
import type { Account } from '@finance/logic/domain/accounts';
import type { Template } from '@finance/logic/domain/templates';
import { isAutoLoggedToday } from '@finance/logic/domain/templates';
import { getRecords, addRecord, deleteRecord, ensureRecords } from '@finance/logic/domain/records';
import { getTemplates, updateTemplate, ensureTemplates } from '@finance/logic/domain/templates';
import { getAccounts, ensureAccounts } from '@finance/logic/domain/accounts';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import { confirmAsync, alertAsync } from '../../utils/platform';
import './index.css';

/**
 * 跨端记账页（移植自上游 AccountingView）。
 * 改造点：
 * - 数据从 domain 层自取（上游从 props 拿），跨端 storage 注入后自动适配
 * - window.prompt → 异步 confirmAsync/自定义编辑（这里用 modal 内输入框）
 * - 手势拖拽删除 → 长按确认删除（小程序手势复杂）
 * - motion/AnimatePresence → 简单条件渲染
 * - input/textarea → Taro Input/Textarea；button/div/span → View/Text
 * - 三大子页：日常明细 / 固定账单 / CSV 导入（CSV 用 Textarea 粘贴）
 */
export default function Accounting() {
  // 初始化数据（首次进入确保有默认账户/模板/示例账单）
  ensureAccounts();
  ensureTemplates();
  ensureRecords();

  const [activeSubTab, setActiveSubTab] = useState<'list' | 'auto_template' | 'csv_import'>('list');
  const [billView, setBillView] = useState<'all' | 'expense' | 'income'>('all');
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('餐饮');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('acc_wechat');

  // 触发重渲染的版本号（domain 层直接改 storage，需手动刷新视图）
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  // CSV 状态
  const [csvText, setCsvText] = useState('');

  const transactions: Transaction[] = getRecords();
  const accounts: Account[] = getAccounts();
  const templates: Template[] = getTemplates();
  void version; // 依赖 version 触发重渲染

  const handleSave = () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    const now = new Date();
    const acc = accounts.find((a) => a.id === accountId);
    const newTx: Transaction = {
      id: Date.now().toString(),
      type,
      amount: parseFloat(amount),
      category,
      accountId,
      accountName: acc?.name,
      date: now.toISOString().split('T')[0],
      time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      note: note || category,
    };
    addRecord(newTx);
    setShowModal(false);
    setAmount('');
    setNote('');
    refresh();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmAsync('确定删除这笔账单？');
    if (!ok) return;
    deleteRecord(id);
    refresh();
  };

  const handleToggleTemplate = (id: string, enabled: boolean) => {
    updateTemplate(id, { enabled });
    refresh();
  };

  // CSV 解析（与上游 parseCSV 逻辑一致，纯逻辑跨端复用）
  const parseCSV = () => {
    if (!csvText.trim()) return;
    const lines = csvText.split('\n');
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

      let nativeCategory = '其他';
      if (categoryPart.includes('食') || categoryPart.includes('餐')) nativeCategory = '餐饮';
      else if (categoryPart.includes('行') || categoryPart.includes('交')) nativeCategory = '交通';
      else if (categoryPart.includes('玩') || categoryPart.includes('乐')) nativeCategory = '娱乐';
      else if (categoryPart.includes('雇') || categoryPart.includes('资')) nativeCategory = '工资';
      else if (categoryPart.includes('购') || categoryPart.includes('买')) nativeCategory = '购物';

      addRecord({
        id: `csv-${i}-${Date.now()}`,
        type: isIncome ? 'income' : 'expense',
        amount: Math.abs(parseFloat(valueRaw)) || 0,
        category: nativeCategory,
        accountId: 'acc_wechat',
        accountName: '微信',
        date: datePart.split(' ')[0],
        note: `${opposite || ''} - ${prodName || categoryPart}`,
      });
    }
    alertAsync(`🎉 成功导入 ${lines.length - 1} 条明细`);
    setCsvText('');
    setActiveSubTab('list');
    refresh();
  };

  const loadDemoCSV = () => {
    setCsvText(
      `交易时间,交易分类,交易对方,商品名称,金额,收/支
2026-06-22 12:45:00,餐饮美食,麦当劳中国,双层吉士牛套餐,28.50,支出
2026-06-22 18:30:00,交通出行,滴滴出行,打车车费,36.40,支出
2026-06-21 19:15:00,休闲娱乐,爱奇艺科技,黄金VIP续费,68.00,支出
2026-06-21 10:10:00,其他收入,社交红包,来自张三转账,200.00,收入`,
    );
  };

  const categories =
    type === 'expense'
      ? ['餐饮', '交通', '购物', '娱乐', '住房', '医疗', '其他']
      : ['工资', '投资理财', '分红', '兼职', '其他'];

  const list = billView === 'all' ? transactions : transactions.filter((t) => t.type === billView);

  return (
    <View className='p-4 space-y-4 max-w-md mx-auto w-full min-h-screen bg-slate-50'>
      {/* 标题栏 */}
      <View className='flex justify-between items-center'>
        <View>
          <Text className='text-xl font-bold text-slate-800 block'>记账账簿</Text>
          <Text className='text-xs text-slate-400 block'>日常明细、固定账单与自动对账</Text>
        </View>
        <Motion
          tapScale={0.95}
          onClick={() => setShowModal(true)}
          className='px-3 py-1.5 bg-indigo-600 text-white rounded-xl font-semibold text-xs flex items-center gap-1'
        >
          <Icon name='plus' size={14} /> 记一笔
        </Motion>
      </View>

      {/* 账户余额 */}
      <View className='flex gap-2 overflow-x-auto pb-1'>
        {accounts.map((acc) => (
          <View
            key={acc.id}
            className={`shrink-0 px-3 py-2 rounded-xl border ${acc.type === 'credit' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}
          >
            <Text className='text-[9px] text-slate-400 font-bold block'>
              {acc.icon} {acc.name}
            </Text>
            <Text
              className={`text-xs font-black font-mono block ${acc.balance < 0 ? 'text-rose-600' : 'text-slate-800'}`}
            >
              ¥{acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>
        ))}
      </View>

      {/* 子 Tab */}
      <View className='flex bg-slate-200/60 p-1 rounded-2xl w-full border border-slate-100'>
        {[
          { key: 'list', label: '日常明细' },
          { key: 'auto_template', label: `固定账单 (${templates.filter((x) => x.enabled).length})` },
          { key: 'csv_import', label: 'CSV 导入' },
        ].map((tab) => (
          <Motion
            key={tab.key}
            tapScale={0.95}
            onClick={() => setActiveSubTab(tab.key as any)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl text-center ${activeSubTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {tab.label}
          </Motion>
        ))}
      </View>

      {/* 日常明细 */}
      {activeSubTab === 'list' && (
        <View className='space-y-3'>
          <View className='flex bg-slate-100 p-1 rounded-xl gap-1'>
            {[
              { key: 'all', label: '全部' },
              { key: 'expense', label: '支出' },
              { key: 'income', label: '收入' },
            ].map((bv) => (
              <Motion
                key={bv.key}
                tapScale={0.95}
                onClick={() => setBillView(bv.key as any)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg text-center ${billView === bv.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {bv.label}
              </Motion>
            ))}
          </View>

          {list.length === 0 ? (
            <Card>
              <CardContent className='p-12 text-center text-slate-400 text-xs'>
                暂无明细，点击右上角「记一笔」
              </CardContent>
            </Card>
          ) : (
            <View className='space-y-2.5'>
              <Text className='text-[10px] text-slate-400 text-center block'>
                💡 点击账单右侧按钮删除
              </Text>
              {list.map((t) => (
                <View
                  key={t.id}
                  className={`relative bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between ${t.important ? 'border-l-4 border-amber-500' : ''}`}
                >
                  <View className='flex items-center gap-3'>
                    <View
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                    >
                      {t.type === 'income' ? '💰' : '☕'}
                    </View>
                    <View>
                      <Text className='font-semibold text-slate-800 text-sm block'>{t.note}</Text>
                      <Text className='text-[10px] text-slate-400 block'>
                        {t.date} · {t.category}
                      </Text>
                    </View>
                  </View>
                  <View className='flex items-center gap-2 shrink-0'>
                    <Text
                      className={`font-bold text-sm block ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}
                    >
                      {t.type === 'income' ? '+' : '-'}¥
                      {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                    <Text
                      className='text-rose-400 text-lg px-1'
                      onClick={() => handleDelete(t.id)}
                    >
                      ✕
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 固定账单 */}
      {activeSubTab === 'auto_template' && (
        <View className='space-y-3'>
          <Text className='text-xs font-bold text-slate-700 uppercase tracking-wider px-1 block'>
            固定收支（启用后按周期自动入账）
          </Text>
          {templates.map((tpl) => {
            const loggedToday = isAutoLoggedToday(tpl.id);
            return (
              <Card key={tpl.id} className={tpl.enabled ? '' : 'opacity-60'}>
                <CardContent className='p-4 flex justify-between items-center'>
                  <View className='flex-1 min-w-0'>
                    <View className='flex items-center gap-2 flex-wrap'>
                      <Text className='font-extrabold text-slate-800 text-xs'>{tpl.name}</Text>
                      <Text className='bg-slate-100 text-slate-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full font-mono'>
                        每月 {tpl.day ?? 1} 日
                      </Text>
                      {loggedToday && tpl.enabled && (
                        <Text className='bg-emerald-100 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded-full'>
                          今日已自动
                        </Text>
                      )}
                    </View>
                    <Text className='text-[10px] text-slate-400 font-medium block mt-0.5'>
                      {tpl.note} · {tpl.category}
                    </Text>
                  </View>
                  <View className='flex items-center gap-1.5 shrink-0'>
                    <Text
                      className={`text-xs font-black font-mono block ${tpl.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}
                    >
                      {tpl.type === 'income' ? '+' : '-'}¥{tpl.amount}
                    </Text>
                    <Motion
                      tapScale={0.95}
                      onClick={() => handleToggleTemplate(tpl.id, !tpl.enabled)}
                      className={`px-2 py-1 rounded-lg text-[9px] font-bold ${tpl.enabled ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}
                    >
                      {tpl.enabled ? '开' : '关'}
                    </Motion>
                  </View>
                </CardContent>
              </Card>
            );
          })}
        </View>
      )}

      {/* CSV 导入 */}
      {activeSubTab === 'csv_import' && (
        <View className='space-y-4'>
          <View className='p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex gap-1.5 items-start'>
            <Icon name='sparkles' size={16} className='text-indigo-600 shrink-0 mt-0.5' />
            <View>
              <Text className='text-xs font-bold text-indigo-950 block'>微信/支付宝 CSV 对账</Text>
              <Text className='text-[10px] text-indigo-900 leading-normal block'>
                粘贴 CSV 文本，系统智能分词并映射标准分类。
              </Text>
            </View>
          </View>
          <View className='space-y-2 bg-slate-100/50 p-3 rounded-2xl border border-slate-200/50'>
            <View className='flex justify-between items-center mb-1'>
              <Text className='text-[10px] font-bold text-slate-600 block'>CSV 文本粘贴区</Text>
              <Motion
                tapScale={0.95}
                onClick={loadDemoCSV}
                className='text-[9px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5'
              >
                载入样例
              </Motion>
            </View>
            <Textarea
              value={csvText}
              onInput={(e) => setCsvText(e.detail.value)}
              placeholder='交易时间,交易分类,交易对方,商品名称,金额,收/支...'
              className='w-full bg-white border border-slate-200 rounded-xl p-2.5 font-mono text-[10px] text-slate-700'
              style={{ height: '100px' }}
            />
            <Motion
              tapScale={0.95}
              onClick={parseCSV}
              className={`w-full py-2 text-white font-bold rounded-xl text-xs text-center ${csvText.trim() ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              解析并导入
            </Motion>
          </View>
        </View>
      )}

      {/* 记一笔 Modal */}
      {showModal && (
        <View className='fixed inset-0 bg-slate-900/60 z-50 flex items-end'>
          <View className='w-full bg-white rounded-t-3xl p-6 space-y-4'>
            <View className='flex justify-between items-center pb-2 border-b border-slate-100'>
              <Text className='font-bold text-slate-900 flex items-center gap-1.5'>
                <Icon name='wallet' size={20} className='text-indigo-500' /> 记录一笔收支
              </Text>
              <Text className='p-1 text-slate-400 text-xl' onClick={() => setShowModal(false)}>
                ✕
              </Text>
            </View>

            <View className='flex bg-slate-100 p-1 rounded-xl'>
              {[
                { key: 'expense', label: '支出' },
                { key: 'income', label: '收入' },
              ].map((tb) => (
                <Motion
                  key={tb.key}
                  tapScale={0.95}
                  onClick={() => {
                    setType(tb.key as any);
                    setCategory(tb.key === 'expense' ? '餐饮' : '工资');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg text-center ${type === tb.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  {tb.label}
                </Motion>
              ))}
            </View>

            <View className='space-y-1'>
              <Text className='text-xs font-semibold text-slate-500 block'>金额 (元)</Text>
              <Input
                type='digit'
                placeholder='0.00'
                value={amount}
                onInput={(e) => setAmount(e.detail.value)}
                className='w-full bg-slate-100 rounded-xl px-4 py-3 text-lg font-bold text-slate-900'
              />
            </View>

            <View className='space-y-1'>
              <Text className='text-xs font-semibold text-slate-400 block'>分类</Text>
              <View className='flex flex-wrap gap-1.5'>
                {categories.map((cat) => (
                  <Motion
                    key={cat}
                    tapScale={0.95}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1 text-xs font-medium border rounded-lg ${category === cat ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                  >
                    {cat}
                  </Motion>
                ))}
              </View>
            </View>

            <View className='space-y-1'>
              <Text className='text-xs font-semibold text-slate-400 block'>支付账户</Text>
              <View className='flex flex-wrap gap-1.5'>
                {accounts.map((acc) => (
                  <Motion
                    key={acc.id}
                    tapScale={0.95}
                    onClick={() => setAccountId(acc.id)}
                    className={`px-3 py-1 text-xs font-medium border rounded-lg ${accountId === acc.id ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                  >
                    {acc.icon} {acc.name}
                  </Motion>
                ))}
              </View>
            </View>

            <View className='space-y-1'>
              <Text className='text-xs font-semibold text-slate-500 block'>备注</Text>
              <Input
                placeholder='添加说明...'
                value={note}
                onInput={(e) => setNote(e.detail.value)}
                className='w-full bg-slate-100 rounded-xl px-4 py-3 text-sm text-slate-800'
              />
            </View>

            <Motion
              tapScale={0.98}
              onClick={handleSave}
              className='w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl text-sm text-center'
            >
              保存账单
            </Motion>
          </View>
        </View>
      )}
    </View>
  );
}
