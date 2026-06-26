import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { 
  Calculator, HelpCircle, ArrowRightLeft, Sparkles, Check, Info, 
  Percent, Coins, Briefcase, Award, Milestone, Lightbulb 
} from 'lucide-react';
import { FinanceAppState, reverseNetSalaryToGross } from '../utils/financeState';

interface TaxViewProps {
  financeState: FinanceAppState;
}

export function TaxView({ financeState }: TaxViewProps) {
  const [activeTab, setActiveTab] = useState<'salary_bonus' | 'part_time_labor' | 'options_equity'>('salary_bonus');

  // Tab 1: Salary & Bonus
  const [inputMode, setInputMode] = useState<'gross' | 'net'>('net');
  const [salaryVal, setSalaryVal] = useState<string>('');
  const [bonus, setBonus] = useState<string>('30000');
  const [monthlyDeduction, setMonthlyDeduction] = useState<string>('2000'); // Special Additional Deductions (专项附加)
  
  // Tab 2: Part-time / Labor Remuneration
  const [laborAmount, setLaborAmount] = useState<string>('8000');
  const [royaltyAmount, setRoyaltyAmount] = useState<string>('5000');

  // Tab 3: Options / RSU equity Tax
  const [equityValue, setEquityValue] = useState<string>('150000'); // Market value upon exercise/vesting
  const [grantPrice, setGrantPrice] = useState<string>('50000'); // Price user paid

  // Synchronize base values with user profile defaults dynamically on load
  useEffect(() => {
    if (financeState.profile.monthlyNetSalary) {
      if (inputMode === 'net') {
        setSalaryVal(financeState.profile.monthlyNetSalary.toString());
      } else {
        const gross = reverseNetSalaryToGross(financeState.profile.monthlyNetSalary);
        setSalaryVal(Math.round(gross).toString());
      }
    }
  }, [financeState.profile.monthlyNetSalary, inputMode]);

  // Tax calculation algorithms
  const calculateSalaryAndBonus = () => {
    const rawVal = parseFloat(salaryVal) || 0;
    const b = parseFloat(bonus) || 0;
    const specDeduct = parseFloat(monthlyDeduction) || 0;

    let grossSalary = 0;
    let netSalary = 0;

    if (inputMode === 'net') {
      netSalary = rawVal;
      grossSalary = reverseNetSalaryToGross(rawVal);
    } else {
      grossSalary = rawVal;
    }

    const socialDeduction = Math.min(grossSalary * 0.105, 3000); 
    const annualGross = grossSalary * 12;
    const threshold = 60000; // 5000 * 12
    const totalSocialDiff = socialDeduction * 12;
    const totalSpecDiff = specDeduct * 12;

    // Helper to calculate Comprehensive Tax
    const calcComprehensiveTax = (amount: number) => {
      let tax = 0;
      let rate = 0;
      if (amount <= 36000) {
        tax = amount * 0.03;
        rate = 3;
      } else if (amount <= 144000) {
        tax = amount * 0.1 - 2520;
        rate = 10;
      } else if (amount <= 300000) {
        tax = amount * 0.2 - 16920;
        rate = 20;
      } else if (amount <= 420000) {
        tax = amount * 0.25 - 31920;
        rate = 25;
      } else if (amount <= 660500) {
        tax = amount * 0.3 - 52920;
        rate = 30;
      } else {
        tax = amount * 0.35 - 85920;
        rate = 35;
      }
      return { tax: Math.max(0, tax), rate };
    };

    // Option A: Year-end bonus calculated SEPARATELY (全年一次性奖金单独计税)
    // Formula: bonus / 12 determines the bracket
    const monthlyBonus = b / 12;
    let bonusTax = 0;
    let bonusRate = 0;
    if (b > 0) {
      if (monthlyBonus <= 3000) {
        bonusTax = b * 0.03;
        bonusRate = 3;
      } else if (monthlyBonus <= 12000) {
        bonusTax = b * 0.1 - 210;
        bonusRate = 10;
      } else if (monthlyBonus <= 25000) {
        bonusTax = b * 0.2 - 1410;
        bonusRate = 20;
      } else if (monthlyBonus <= 35000) {
        bonusTax = b * 0.25 - 2660;
        bonusRate = 25;
      } else {
        bonusTax = b * 0.3 - 4410;
        bonusRate = 30;
      }
    }
    
    const salaryTaxable = annualGross - threshold - totalSocialDiff - totalSpecDiff;
    const salaryTaxResult = calcComprehensiveTax(salaryTaxable);

    const totalTaxSeparate = salaryTaxResult.tax + bonusTax;

    // Option B: Year-end bonus MERGED with comprehensive income (并入综合所得计税)
    const totalTaxableMerged = salaryTaxable + b;
    const mergedTaxResult = calcComprehensiveTax(totalTaxableMerged);
    const totalTaxMerged = mergedTaxResult.tax;

    // Strategy recommendation
    const isSeparateBetter = totalTaxSeparate <= totalTaxMerged;
    const savedAmount = Math.abs(totalTaxMerged - totalTaxSeparate);

    if (inputMode === 'gross') {
      netSalary = grossSalary - socialDeduction - (salaryTaxResult.tax / 12);
    }

    return {
      grossSalary,
      netSalary,
      socialDeduction,
      annualTaxable: salaryTaxable,
      salaryTax: salaryTaxResult.tax,
      bonusTax,
      totalTaxSeparate,
      totalTaxMerged,
      isSeparateBetter,
      savedAmount,
      bracketRate: salaryTaxResult.rate,
      bonusRate
    };
  };

  const calculateLaborRemuneration = () => {
    const rawLabor = parseFloat(laborAmount) || 0;
    const rawRoyalty = parseFloat(royaltyAmount) || 0;

    // Labor Remuneration (劳务报酬) Chinese Tax Rule:
    // If <= 4000: taxable = amount - 800.
    // If > 4000: taxable = amount * 80%.
    // Progressive rates: <= 20000: 20%. <= 50000: 30% - 2000. > 50000: 40% - 7000.
    let laborTaxable = 0;
    if (rawLabor <= 4000) {
      laborTaxable = Math.max(0, rawLabor - 800);
    } else {
      laborTaxable = rawLabor * 0.8;
    }

    let laborTax = 0;
    if (laborTaxable <= 20000) {
      laborTax = laborTaxable * 0.2;
    } else if (laborTaxable <= 50000) {
      laborTax = laborTaxable * 0.3 - 2000;
    } else {
      laborTax = laborTaxable * 0.4 - 7000;
    }

    // Royalty / Manuscript Fee (稿酬) Chinese Tax Rule:
    // If <= 4000: taxable = (amount - 800) * 70%.
    // If > 4000: taxable = amount * 80% * 70%.
    // Flat tax rate: 20%
    let royaltyTaxable = 0;
    if (rawRoyalty <= 4000) {
      royaltyTaxable = Math.max(0, rawRoyalty - 800) * 0.7;
    } else {
      royaltyTaxable = rawRoyalty * 0.8 * 0.7;
    }
    const royaltyTax = royaltyTaxable * 0.2;

    return {
      laborTax,
      laborNet: rawLabor - laborTax,
      royaltyTax,
      royaltyNet: rawRoyalty - royaltyTax,
      totalTax: laborTax + royaltyTax
    };
  };

  const calculateEquityTax = () => {
    const rawVal = parseFloat(equityValue) || 0;
    const rawPrice = parseFloat(grantPrice) || 0;

    const gain = Math.max(0, rawVal - rawPrice);
    
    // Chinese Individual Income Tax for Stocks Options / RSUs:
    // Taxed independently as composite personal income (单独适用综合税率，不与月薪合并，非常优惠)
    // Formula: tax = gain * comprehensiveRate - quickDeduct
    let tax = 0;
    let rate = 0;
    if (gain <= 36000) {
      tax = gain * 0.03;
      rate = 3;
    } else if (gain <= 144000) {
      tax = gain * 0.1 - 2520;
      rate = 10;
    } else if (gain <= 300500) {
      tax = gain * 0.2 - 16920;
      rate = 20;
    } else if (gain <= 420000) {
      tax = gain * 0.25 - 31920;
      rate = 25;
    } else {
      tax = gain * 0.3 - 52920;
      rate = 30;
    }

    return {
      gain,
      tax,
      netValue: rawVal - tax,
      effectiveRate: gain > 0 ? (tax / gain) * 100 : 0,
      bracketRate: rate
    };
  };

  const salRep = calculateSalaryAndBonus();
  const laborRep = calculateLaborRemuneration();
  const eqRep = calculateEquityTax();

  return (
    <div className="p-4 space-y-4 max-w-sm mx-auto w-full text-left">
      
      {/* City & Base Header Context */}
      {financeState.profile.monthlyNetSalary > 0 && (
        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600 shrink-0" />
          <p className="text-[10px] text-indigo-900 leading-tight font-medium">
            已自动同步 <b>{financeState.profile.city}</b> 理财生命档案。月薪基数 <b>¥{financeState.profile.monthlyNetSalary}</b> 二分高精反推折抵。
          </p>
        </div>
      )}

      {/* Primary Category Selector */}
      <div className="flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100">
        <button 
          onClick={() => setActiveTab('salary_bonus')}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl transition ${activeTab === 'salary_bonus' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          月薪/年终奖计税
        </button>
        <button 
          onClick={() => setActiveTab('part_time_labor')}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl transition ${activeTab === 'part_time_labor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          兼职劳务与稿酬
        </button>
        <button 
          onClick={() => setActiveTab('options_equity')}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl transition ${activeTab === 'options_equity' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          股权期权个税
        </button>
      </div>

      {activeTab === 'salary_bonus' && (
        <div className="space-y-4">
          <Card className="shadow-sm border border-slate-100 bg-white">
            <CardContent className="p-4 space-y-3.5">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-800">计税输入标准</h3>
                <button 
                  onClick={() => setInputMode(prev => prev === 'net' ? 'gross' : 'net')}
                  className="text-[9px] text-indigo-600 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition"
                >
                  <ArrowRightLeft size={10} />
                  <span>切换至: {inputMode === 'net' ? '税前协议薪资' : '到手反推'}</span>
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-10 border-slate-200/50 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {inputMode === 'net' ? '💰 每月实收到手薪资 (元)' : '💼 每月协议税前薪资 (元)'}
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={salaryVal} 
                      onChange={e => setSalaryVal(e.target.value)} 
                      placeholder="如 12000"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none" 
                    />
                    <span className="absolute right-3.5 top-3 text-[10px] text-slate-400 font-bold font-mono">元/月</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">🎁 年终奖总额 (元)</label>
                    <input 
                      type="number" 
                      value={bonus} 
                      onChange={e => setBonus(e.target.value)} 
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">🛡️ 专项附加扣除 (元)</label>
                    <input 
                      type="number" 
                      value={monthlyDeduction} 
                      onChange={e => setMonthlyDeduction(e.target.value)} 
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold" 
                    />
                  </div>
                </div>
              </div>

              {/* TWO OPTIONS TAX OPTIMIZATION COMPARE BAR */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-1.5">
                <div className="flex gap-1.5 items-center text-indigo-900 font-bold text-xs">
                  <Lightbulb size={14} className="text-indigo-600 shrink-0" />
                  <span>年终奖最优规划决策</span>
                </div>
                <div className="text-[10px] text-indigo-950 leading-relaxed font-semibold">
                  {salRep.isSeparateBetter ? (
                    <span>
                      💡 【单独计税更划算】年终奖单独计税，相比于并入综合所得，可以为您省下个税支出 <b className="text-red-600">¥{Math.round(salRep.savedAmount).toLocaleString()}</b>！建议采取方案一。
                    </span>
                  ) : (
                    <span>
                      💡 【合并报税更划算】年终奖并入综合所得一并计税，相比于单独计税能够让您多保留 <b className="text-emerald-700">¥{Math.round(salRep.savedAmount).toLocaleString()}</b> 的纯利！建议采取方案二。
                    </span>
                  )}
                </div>
              </div>

              {/* REPORT METRICS CORES */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-500 block uppercase px-1">并入 vs 单独测算明细</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3.5 bg-slate-55 bg-indigo-50/20 border border-indigo-100 rounded-xl space-y-1 text-center">
                    <span className="text-[9px] text-indigo-600 font-bold block">方案一：单独计税 (推荐)</span>
                    <p className="text-sm font-black text-indigo-950 font-mono">¥{Math.round(salRep.totalTaxSeparate).toLocaleString()}</p>
                    <span className="text-[8px] text-slate-400 block font-medium">月薪个税: ¥{Math.round(salRep.salaryTax)} + 奖税: ¥{Math.round(salRep.bonusTax)}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-1 text-center">
                    <span className="text-[9px] text-slate-500 font-medium block">方案二：合并所得计税</span>
                    <p className="text-sm font-black text-slate-700 font-mono">¥{Math.round(salRep.totalTaxMerged).toLocaleString()}</p>
                    <span className="text-[8px] text-slate-400 block font-medium font-mono">起征阶梯挡位: {salRep.bracketRate}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Special Deductions Checklist */}
          <div className="p-3.5 bg-amber-50/60 border border-amber-100 text-[10px] text-amber-900 rounded-2xl space-y-1">
            <span className="font-extrabold flex items-center gap-1"><Milestone size={11} /> 年度汇算清缴专项附带加分项：</span>
            <p className="leading-relaxed">本年度个税汇算将于次年3月至6月开放。除了子女教育、赡养老人、房贷利息抵税之外，千万记得在<b>【个人所得税APP】</b>申报大病医疗和个人养老金账户，以获取额外大额返税结余！</p>
          </div>
        </div>
      )}

      {activeTab === 'part_time_labor' && (
        <div className="space-y-4">
          <Card className="shadow-sm border border-slate-100 bg-white">
            <CardContent className="p-4 space-y-4 text-xs">
              <h3 className="font-bold text-slate-800 text-xs">劳务与副业酬劳个税估算</h3>

              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">💼 劳务报酬性收入 (如副业接单、演讲咨询 Fee)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={laborAmount} 
                      onChange={e => setLaborAmount(e.target.value)} 
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-bold">元/单</span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">适用 20%-40% 比例税率。单笔超4000扣减 20% 费用免税额。</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">✍️ 稿酬与著作费收益 (如写书、自媒体投稿所得)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={royaltyAmount} 
                      onChange={e => setRoyaltyAmount(e.target.value)} 
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-bold">元/单</span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">在 80% 计税基础上额外再折上折扣减 30%，相当于享 5.6 折税扣降维待遇！</p>
                </div>
              </div>

              {/* REPORT OUTS */}
              <div className="bg-slate-100 p-3.5 rounded-2xl space-y-2 text-[11px] text-slate-700">
                <div className="flex justify-between font-medium">
                  <span>劳务所得预缴个税 (按次)</span>
                  <span className="font-bold font-mono text-rose-600">¥{Math.round(laborRep.laborTax).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>副业到手净收入金额</span>
                  <span className="font-bold font-mono text-emerald-600">¥{Math.round(laborRep.laborNet).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium pt-1.5 border-t border-slate-200">
                  <span>稿费专属纳税额度</span>
                  <span className="font-bold font-mono text-rose-600">¥{Math.round(laborRep.royaltyTax).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>著作稿税后收益率</span>
                  <span className="font-bold font-mono text-slate-800">¥{Math.round(laborRep.royaltyNet).toLocaleString()} ({(laborRep.royaltyNet / (parseFloat(royaltyAmount)||1) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'options_equity' && (
        <div className="space-y-4">
          <Card className="shadow-sm border border-slate-150 bg-white">
            <CardContent className="p-4 space-y-4 text-xs font-medium">
              <div>
                <h3 className="font-extrabold text-slate-800">大厂期权 (Options) 与股票 (RSU) 个税</h3>
                <p className="text-[9px] text-slate-400 mt-0.5">我国税法对股权激励实行单独优惠综合阶梯计税，不与月度常规工资累加！</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] text-slate-500 font-bold mb-1">🎁 结算期权行权市价 (元)</label>
                  <input 
                    type="number" 
                    value={equityValue} 
                    onChange={e => setEquityValue(e.target.value)} 
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 font-bold mb-1">💸 个人买入买持协议价</label>
                  <input 
                    type="number" 
                    value={grantPrice} 
                    onChange={e => setGrantPrice(e.target.value)} 
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-xl space-y-2 text-[10px]">
                <div className="flex justify-between">
                  <span>期权套现所得差利收入</span>
                  <span className="font-bold font-mono text-slate-800">¥{Math.round(eqRep.gain).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>对应单独优惠综合税率档</span>
                  <span className="bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-extrabold font-mono">{eqRep.bracketRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span>期权个税应扣缴税率差</span>
                  <span className="font-bold font-mono text-red-600 font-black">¥{Math.round(eqRep.tax).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                  <span>最终期权变现实得净值额</span>
                  <span className="text-emerald-600 font-mono">¥{Math.round(eqRep.netValue).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
