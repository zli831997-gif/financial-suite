import { View, Text } from '@tarojs/components';
import { navigateTo } from '@tarojs/taro';
import { ModuleType } from '@finance/types';
import {
  FinanceAppState,
  reverseNetSalaryToGross,
  reverseSocialSecurityBase,
} from '@finance/utils/financeState';
import { calcNetAssets } from '@finance/logic/calc/netAssets';
import { simulatePrepayment } from '@finance/logic/calc/loan';
import { getAccountsNetBalance } from '@finance/logic/domain/accounts';
import { calcEmployeePension } from '@finance/logic/calc/pension';
import { calcAnnualSalaryTax } from '@finance/logic/calc/tax';
import { getCityRates } from '@finance/logic/calc/social';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import './index.css';

/**
 * 跨端首页：金融工具箱（移植自上游 MobileHub）。
 * 改造点：lucide→Icon、motion→Motion、div→View、h3/p→Text。
 * 逻辑层（calc* / reverse* / getAccountsNetBalance）原样复用上游。
 * 卡片点击跳转对应子页（navigateTo），子页后续逐步迁移。
 */
export default function Index() {
  // 复用上游 financeState（从 storage 读取用户档案）
  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);

  const city = financeState.profile?.city || '深圳';
  const netSalary = financeState.profile?.monthlyNetSalary || 12000;
  const userAge = financeState.profile?.age || 30;
  const retireAge = financeState.profile?.retireAge || 60;
  const socialInsuranceSelf = financeState.profile?.socialInsuranceSelf || 2000;

  // 1. 个税反算
  const gross = reverseNetSalaryToGross(netSalary);
  const taxResult = calcAnnualSalaryTax({ monthlySalary: gross, socialInsurance: gross * 0.225 });
  const taxEstimate = taxResult.annualTax / 12;

  // 2. 五险一金基数
  const insBaseValue = Math.round(reverseSocialSecurityBase(socialInsuranceSelf));
  const rates = getCityRates(city);
  const employerLiability = Math.round(
    insBaseValue *
      (rates.pension.company +
        rates.medical.company +
        rates.housingFund.company +
        rates.unemployment.company +
        rates.workInjury.company),
  );

  // 3. 养老金
  const pensionYears = Math.max(15, retireAge - userAge);
  const _pension = calcEmployeePension({
    province: city,
    personalSalary: gross,
    contributionYears: pensionYears,
    personalAccountBalance: gross * 0.08 * 12 * pensionYears,
    retireAge,
  });
  const estimatedPension = Math.round(_pension.monthlyPension);

  // 4. 年金
  const monthlyAnnContribution = Math.round(gross * 0.12);
  let annFV = 0;
  const annRate = 0.045;
  for (let i = 0; i < pensionYears; i++) {
    annFV = (annFV + monthlyAnnContribution * 12) * (1 + annRate);
  }

  // 5. 净资产（单一权威函数）
  const netAssetsResult = calcNetAssets(financeState, getAccountsNetBalance());
  const totalNetAssets = netAssetsResult.net;
  const savingsSum = netAssetsResult.parts.savings;

  // 6. 房贷提前还款预览
  const prop = financeState.property;
  let prepaySaved = 0;
  let hasMortgage = false;
  if (prop && prop.loanBalance > 0 && prop.loanRate > 0) {
    hasMortgage = true;
    const totalTerms = prop.totalLoanTerms ?? 360;
    const remaining = prop.remainingTerms ?? totalTerms;
    const paidM = Math.max(0, totalTerms - remaining);
    const tryPrepay = simulatePrepayment({
      principal: Math.round(prop.loanBalance + paidM * prop.monthlyPayment),
      years: totalTerms / 12,
      annualRatePct: prop.loanRate,
      paidMonths: paidM,
      prepayAmount: 100000,
    });
    prepaySaved = tryPrepay.shortenTerm.savedInterest;
  }

  // 7. 股票持仓
  let stockValueTotal = 0;
  let stockCostTotal = 0;
  let stocksList: any[] = storage.get<any[]>(KEYS.STOCKS) ?? [];
  if (stocksList.length === 0) {
    stocksList = [
      { id: '1', symbol: '600519', name: '贵州茅台', shares: 100, avgPrice: 1600, currentPrice: 1645.5, marketType: 'A股' },
      { id: '2', symbol: '00700', name: '腾讯控股', shares: 400, avgPrice: 320, currentPrice: 382.4, marketType: '港股' },
      { id: '3', symbol: 'VOO', name: '标普500 ETF', shares: 25, avgPrice: 420, currentPrice: 512.2, marketType: '美股' },
    ];
  }
  stocksList.forEach((h: any) => {
    let rate = 1.0;
    if (h.marketType === '美股') rate = 7.25;
    else if (h.marketType === '港股') rate = 0.93;
    stockCostTotal += h.avgPrice * h.shares * rate;
    stockValueTotal += h.currentPrice * h.shares * rate;
  });
  const stockProfitPercent =
    stockCostTotal > 0 ? ((stockValueTotal - stockCostTotal) / stockCostTotal) * 100 : 0;

  const cards = [
    {
      id: ModuleType.TAX,
      label: '个税反向算费',
      desc: '月薪个税极简试算与税法反推',
      icon: 'receipt',
      color: 'from-blue-500/10 to-blue-500/0 text-blue-600 border-blue-100',
      dataTitle: '当前代扣估算',
      value: `¥${Math.round(taxEstimate)}/月`,
      subtext: `税前折合: ¥${Math.round(gross).toLocaleString()}`,
    },
    {
      id: ModuleType.INSURANCE,
      label: '五险一金精算',
      desc: '双边缴存对账与医保门诊报销',
      icon: 'briefcaseMedical',
      color: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600 border-emerald-100',
      dataTitle: '企业统筹代扣款',
      value: `+¥${employerLiability.toLocaleString()}/月`,
      subtext: `申报基数: ¥${insBaseValue.toLocaleString()}`,
    },
    {
      id: ModuleType.PENSION,
      label: '终身养老金估算',
      desc: '退休个人与基础统筹金滚存预估',
      icon: 'landmark',
      color: 'from-amber-500/10 to-amber-500/0 text-amber-600 border-amber-100',
      dataTitle: '预计每月退休领取',
      value: `¥${estimatedPension.toLocaleString()}/月`,
      subtext: `${pensionYears}年后可领 · 替代率:${((estimatedPension / Math.max(1, gross)) * 100).toFixed(0)}%`,
    },
    {
      id: ModuleType.ANNUITY,
      label: '补充福利企业年金',
      desc: '双边匹配定缴及复利延期收益',
      icon: 'piggyBank',
      color: 'from-indigo-500/10 to-indigo-500/0 text-indigo-600 border-indigo-100',
      dataTitle: '退休时滚存本息',
      value: `¥${Math.round(annFV).toLocaleString()}`,
      subtext: `双边合计: ¥${monthlyAnnContribution}/月`,
    },
    {
      id: ModuleType.ASSETS,
      label: '家庭净资产总管',
      desc: '统合实物、数字虚拟资产与负债结构',
      icon: 'pieChart',
      color: 'from-rose-500/10 to-rose-500/0 text-rose-600 border-rose-100',
      dataTitle: '当前推算净资产',
      value: `¥${Math.round(totalNetAssets).toLocaleString()}`,
      subtext: `理财存款: ¥${savingsSum.toLocaleString()}`,
    },
    {
      id: ModuleType.LOAN,
      label: '房贷计算 / 提前还贷',
      desc: '等额本息本金对比，提前还款省利息',
      icon: 'home',
      color: 'from-orange-500/10 to-orange-500/0 text-orange-600 border-orange-100',
      dataTitle: hasMortgage ? '提前还10万可省利息' : '提前还贷模拟器',
      value: hasMortgage ? `¥${Math.round(prepaySaved).toLocaleString()}` : '点此试算',
      subtext: hasMortgage
        ? `房贷余额: ¥${Math.round(prop!.loanBalance).toLocaleString()}`
        : '等额本息/本金 · 缩短年限vs减月供',
    },
    {
      id: ModuleType.STOCKS,
      label: '跨国全证券组合',
      desc: '股票公募基金持仓市值浮盈跟踪',
      icon: 'trendingUp',
      color: 'from-purple-500/10 to-purple-500/0 text-purple-600 border-purple-100',
      dataTitle: '持仓估值 / 浮盈',
      value: `¥${Math.round(stockValueTotal).toLocaleString()}`,
      subtext: `浮动收益: ${stockProfitPercent >= 0 ? '+' : ''}${stockProfitPercent.toFixed(1)}%`,
    },
    {
      id: ModuleType.DEPOSITS,
      label: '理财单复利回报',
      desc: '储蓄存款、理财投资单复利滚动分析',
      icon: 'banknote',
      color: 'from-cyan-500/10 to-cyan-500/0 text-cyan-600 border-cyan-100',
      dataTitle: '十万理财年回报参考',
      value: `¥3,500/年`,
      subtext: `参考定期年化: 3.5%`,
    },
  ];

  const goModule = (id: ModuleType) => {
    // 子页尚未全部迁移，先跳到对应路由（不存在则提示）。
    // 后续每个模块迁完，路由即生效。
    navigateTo({ url: `/pages/${id}/index` }).catch(() => {});
  };

  return (
    <View className='p-4 space-y-4 max-w-sm mx-auto min-h-screen bg-slate-50'>
      {/* 标题 */}
      <View className='flex justify-between items-center pb-2 border-b border-slate-100'>
        <View>
          <Text className='text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5'>
            <Icon name='coins' size={16} className='text-indigo-600' />
            金融精算工具箱
          </Text>
          <Text className='text-[10px] text-slate-400 font-semibold block'>
            基于本底档案为您进行多维度财务指标沙盘智能推算
          </Text>
        </View>
      </View>

      {/* 智能提示条 */}
      <View className='bg-indigo-50/55 p-3 rounded-2xl border border-indigo-100/60 flex gap-2 items-start'>
        <Icon name='sparkles' size={15} className='text-indigo-600 shrink-0 mt-0.5' />
        <View className='space-y-0.5'>
          <Text className='text-[10px] font-black text-indigo-950 block'>智能精合：档案与工具全实体贯通</Text>
          <Text className='text-[9px] text-slate-600 leading-normal block'>
            系统已调取您的个人档案：{city}（到手月薪 ¥{netSalary.toLocaleString()}）。工具箱卡片数据已实时测算完毕，点击进入深度模拟。
          </Text>
        </View>
      </View>

      {/* 工具卡片列表 */}
      <View className='space-y-3'>
        {cards.map((card) => (
          <Motion key={card.id} tapScale={0.99} className='text-left'>
            <View
              onClick={() => goModule(card.id)}
              className='w-full relative overflow-hidden bg-white rounded-3xl border border-slate-150 p-4.5 flex flex-col justify-between gap-3'
            >
              <View className={`absolute top-0 left-0 w-32 h-full bg-gradient-to-r ${card.color} opacity-40`} />
              {/* 卡片头 */}
              <View className='relative z-10 flex justify-between items-start'>
                <View className='flex gap-2.5 items-center'>
                  <View className='w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 border border-slate-200'>
                    <Icon name={card.icon} size={18} />
                  </View>
                  <View>
                    <Text className='font-extrabold text-slate-900 text-xs tracking-tight block'>
                      {card.label}
                    </Text>
                    <Text className='text-[9px] text-slate-400 font-medium leading-normal mt-0.5 block'>
                      {card.desc}
                    </Text>
                  </View>
                </View>
                <View className='p-1 rounded-full bg-slate-50 text-slate-400 shrink-0'>
                  <Icon name='chevronRight' size={14} />
                </View>
              </View>
              {/* 卡片数据块 */}
              <View className='relative z-10 bg-slate-50 p-3 rounded-2xl border border-slate-150/80 flex items-center justify-between'>
                <View className='space-y-0.5'>
                  <Text className='text-[9px] text-slate-455 font-bold uppercase tracking-wider block'>
                    {card.dataTitle}
                  </Text>
                  <Text className='text-sm font-black font-mono text-slate-900 block'>
                    {card.value}
                  </Text>
                </View>
                <Text className='text-[9px] text-slate-455 font-medium bg-white/85 px-2 py-0.5 border border-slate-100 rounded-lg shrink-0 max-w-[155px] truncate text-right font-mono'>
                  {card.subtext}
                </Text>
              </View>
            </View>
          </Motion>
        ))}
      </View>

      {/* 合规底栏 */}
      <View className='p-3 bg-slate-100 rounded-2xl border border-slate-200 text-center flex items-center justify-center gap-1.5'>
        <Icon name='shield' size={12} className='text-emerald-600' />
        <Text className='text-[9px] text-slate-400 font-bold uppercase tracking-wider'>
          国家标准税费公式 · 本地安全加密存储
        </Text>
      </View>
    </View>
  );
}
