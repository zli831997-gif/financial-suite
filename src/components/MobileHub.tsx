import { useState, useEffect } from 'react';
import { ModuleType } from '../types';
import { 
  Receipt, 
  BriefcaseMedical, 
  Landmark, 
  PiggyBank, 
  PieChart, 
  TrendingUp, 
  Banknote, 
  ChevronRight, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  TrendingUp as TrendUpIcon,
  Home,
  CheckCircle2,
  HelpCircle,
  Coins
} from 'lucide-react';
import { 
  FinanceAppState, 
  reverseNetSalaryToGross, 
  reverseSocialSecurityBase
} from '../utils/financeState';
import { calcNetAssets } from '../logic/calc/netAssets';
import { simulatePrepayment } from '../logic/calc/loan';
import { getAccountsNetBalance } from '../logic/domain/accounts';
import { calcEmployeePension } from '../logic/calc/pension';
import { calcAnnualSalaryTax } from '../logic/calc/tax';
import { getCityRates } from '../logic/calc/social';
import { storage } from '../storage';
import { KEYS } from '../storage/keys';
import { motion } from 'motion/react';
import { Card, CardContent } from './ui/card';

interface MobileHubProps {
  financeState: FinanceAppState;
  onSelectModule: (module: ModuleType) => void;
}

export function MobileHub({ financeState, onSelectModule }: MobileHubProps) {
  // Extract user parameters for dynamic calculations
  const city = financeState.profile.city || '深圳';
  const netSalary = financeState.profile.monthlyNetSalary || 12000;
  const userAge = financeState.profile.age || 30;
  const retireAge = financeState.profile.retireAge || 60;
  const socialInsuranceSelf = financeState.profile.socialInsuranceSelf || 2000;

  // 1. Double-reverse calculation: Net -> Gross -> Taxes
  const gross = reverseNetSalaryToGross(netSalary);
  const taxResult = calcAnnualSalaryTax({ monthlySalary: gross, socialInsurance: gross * 0.225 });
  const taxEstimate = taxResult.annualTax / 12;

  // 2. Insurance Base and Employer Premium Matching
  const insBaseValue = Math.round(reverseSocialSecurityBase(socialInsuranceSelf));
  const rates = getCityRates(city);
  const employerLiability = Math.round(insBaseValue * (rates.pension.company + rates.medical.company + rates.housingFund.company + rates.unemployment.company + rates.workInjury.company));

  // 3. Pension calculation
  const pensionYears = Math.max(15, retireAge - userAge);
  const _pension = calcEmployeePension({
    province: city,
    personalSalary: gross,
    contributionYears: pensionYears,
    personalAccountBalance: gross * 0.08 * 12 * pensionYears,
    retireAge,
  });
  const estimatedPension = Math.round(_pension.monthlyPension);

  // 4. Annuity Calculation
  const monthlyAnnContribution = Math.round(gross * 0.12); // 4% personal + 8% company
  let annFV = 0;
  const annRate = 0.045; // 4.5% standard compound return
  for (let i = 0; i < pensionYears; i++) {
    annFV = (annFV + (monthlyAnnContribution * 12)) * (1 + annRate);
  }

  // 5. 统一净资产口径（单一权威函数）
  const netAssetsResult = calcNetAssets(financeState, getAccountsNetBalance());
  const totalNetAssets = netAssetsResult.net;
  const savingsSum = netAssetsResult.parts.savings;

  // 5b. 房贷提前还款预览（提前还10万能省多少利息）
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

  // 6. Stock Portfolio value
  let stockValueTotal = 0;
  let stockCostTotal = 0;
  let stocksList: any[] = storage.get<any[]>(KEYS.STOCKS) ?? [];
  
  if (stocksList.length === 0) {
    // defaults
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
  const stockProfitPercent = stockCostTotal > 0 ? ((stockValueTotal - stockCostTotal) / stockCostTotal) * 100 : 0;

  // List of formatted toolbox cards with custom UI stats
  const cards = [
    {
      id: ModuleType.TAX,
      label: '个税反向算费',
      desc: '月薪个税极简试算与税法反推',
      icon: Receipt,
      color: 'from-blue-500/10 to-blue-500/0 text-blue-600 border-blue-100',
      tagColor: 'bg-blue-100 text-blue-800',
      dataTitle: '当前代扣估算',
      value: `¥${Math.round(taxEstimate)}/月`,
      subtext: `税前税薪折合: ¥${Math.round(gross).toLocaleString()}`,
    },
    {
      id: ModuleType.INSURANCE,
      label: '五险一金精算',
      desc: '双边缴存对账与医保门诊报销',
      icon: BriefcaseMedical,
      color: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600 border-emerald-100',
      tagColor: 'bg-emerald-100 text-emerald-800',
      dataTitle: '企业统筹代扣款',
      value: `+¥${employerLiability.toLocaleString()}/月`,
      subtext: `申报测算基数: ¥${insBaseValue.toLocaleString()}`,
    },
    {
      id: ModuleType.PENSION,
      label: '终身养老金估算',
      desc: '退休个人与基础统筹金滚存预估',
      icon: Landmark,
      color: 'from-amber-500/10 to-amber-500/0 text-amber-600 border-amber-100',
      tagColor: 'bg-amber-100 text-amber-800',
      dataTitle: '预计每月退休领取',
      value: `¥${estimatedPension.toLocaleString()}/月`,
      subtext: `${pensionYears}年后可领 · 替代率:${((estimatedPension / Math.max(1, gross)) * 100).toFixed(0)}%`,
    },
    {
      id: ModuleType.ANNUITY,
      label: '补充福利企业年金',
      desc: '双边匹配定缴及复利延期收益',
      icon: PiggyBank,
      color: 'from-indigo-500/10 to-indigo-500/0 text-indigo-600 border-indigo-100',
      tagColor: 'bg-indigo-100 text-indigo-800',
      dataTitle: '退休时滚存本息储量',
      value: `¥${Math.round(annFV).toLocaleString()}`,
      subtext: `双边合计定定存: ¥${monthlyAnnContribution}/月`,
    },
    {
      id: ModuleType.ASSETS,
      label: '家庭净资产总管',
      desc: '统合实物、数字虚拟资产与负债结构',
      icon: PieChart,
      color: 'from-rose-500/10 to-rose-500/0 text-rose-600 border-rose-100',
      tagColor: 'bg-rose-100 text-rose-800',
      dataTitle: '当前推算净资产',
      value: `¥${Math.round(totalNetAssets).toLocaleString()}`,
      subtext: `理财存款占: ¥${savingsSum.toLocaleString()}`,
    },
    {
      id: ModuleType.LOAN,
      label: '房贷计算 / 提前还贷',
      desc: '等额本息本金对比，提前还款省利息',
      icon: Home,
      color: 'from-orange-500/10 to-orange-500/0 text-orange-600 border-orange-100',
      tagColor: 'bg-orange-100 text-orange-800',
      dataTitle: hasMortgage ? '提前还10万可省利息' : '提前还贷模拟器',
      value: hasMortgage ? `¥${Math.round(prepaySaved).toLocaleString()}` : '点此试算',
      subtext: hasMortgage ? `当前房贷余额: ¥${Math.round(prop!.loanBalance).toLocaleString()}` : '等额本息/本金 · 缩短年限vs减月供',
    },
    {
      id: ModuleType.STOCKS,
      label: '跨国全证券组合',
      desc: '股票公募基金持仓市值浮盈跟踪',
      icon: TrendingUp,
      color: 'from-purple-500/10 to-purple-500/0 text-purple-600 border-purple-100',
      tagColor: 'bg-purple-100 text-purple-800',
      dataTitle: '持仓估值 / 浮盈',
      value: `¥${Math.round(stockValueTotal).toLocaleString()}`,
      subtext: `浮动收益: ${stockProfitPercent >= 0 ? '+' : ''}${stockProfitPercent.toFixed(1)}%`,
    },
    {
      id: ModuleType.DEPOSITS,
      label: '理财单复利回报',
      desc: '储蓄存款、理财投资单复利滚动分析',
      icon: Banknote,
      color: 'from-cyan-500/10 to-cyan-500/0 text-cyan-600 border-cyan-100',
      tagColor: 'bg-cyan-100 text-cyan-800',
      dataTitle: '十万理财年回报参考',
      value: `¥3,500/年`,
      subtext: `参考定期年化定存收益率: 3.5%`,
    },
  ];

  return (
    <div className="p-4 space-y-4 max-w-sm mx-auto">
      {/* Title & Static contextual widget */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <Coins className="text-indigo-600 w-4 h-4 animate-bounce" />
            金融精算工具箱
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold">基于本底档案为您进行多维度财务指标沙盘智能推算</p>
        </div>
      </div>

      <div className="bg-indigo-50/55 p-3 rounded-2xl border border-indigo-100/60 text-left flex gap-2 items-start">
        <Sparkles size={15} className="text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="text-[10px] font-black text-indigo-950 block">智能精合：档案与工具全实体贯通</span>
          <p className="text-[9px] text-indigo-805 leading-normal">
            系统已调取您的个人档案：<b>{city}（到手月薪 ¥{netSalary.toLocaleString()}）</b>。工具箱卡片数据已实时帮您测算完毕，点击即可进入深度精细化模拟调整。
          </p>
        </div>
      </div>

      {/* Grid of Bento-style widgets */}
      <div className="space-y-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="text-left"
            >
              <button
                onClick={() => onSelectModule(card.id)}
                className="w-full relative overflow-hidden bg-white hover:bg-slate-50/60 active:bg-slate-100 rounded-3xl border border-slate-150 p-4.5 transition-all text-left flex flex-col justify-between shadow-xs gap-3 group"
              >
                {/* Visual gradient background highlight */}
                <div className={`absolute top-0 left-0 w-32 h-full bg-gradient-to-r ${card.color} opacity-40`} />

                {/* Card Title Header */}
                <div className="relative z-10 flex justify-between items-start">
                  <div className="flex gap-2.5 items-center">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-800 shrink-0 shadow-sm border border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">
                      <Icon size={18} className="stroke-[2]" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs tracking-tight">{card.label}</h4>
                      <p className="text-[9px] text-slate-400 font-medium leading-normal mt-0.5">{card.desc}</p>
                    </div>
                  </div>
                  <div className="p-1 rounded-full bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shadow-xs shrink-0">
                    <ChevronRight size={14} className="stroke-[2.5]" />
                  </div>
                </div>

                {/* Card Calculated Data block */}
                <div className="relative z-10 bg-slate-50 p-3 rounded-2xl border border-slate-150/80 flex items-center justify-between group-hover:bg-indigo-50/20 group-hover:border-indigo-100/50 transition-all">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block">{card.dataTitle}</span>
                    <span className="text-sm font-black font-mono text-slate-900 pr-1 group-hover:text-indigo-950 transition-colors">
                      {card.value}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-455 font-medium bg-white/85 px-2 py-0.5 border border-slate-100 shadow-3xs rounded-lg block overflow-hidden shrink-0 max-w-[155px] truncate text-right font-mono">
                    {card.subtext}
                  </span>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Safety Compliance Footer */}
      <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 text-center flex items-center justify-center gap-1.5">
        <ShieldCheck size={12} className="text-emerald-600" />
        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">🔒 国家标准税费公式 · 本地安全加密存储</span>
      </div>
    </div>
  );
}
