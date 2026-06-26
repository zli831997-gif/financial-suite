import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { ArrowUpRight, Target, Sparkles, Scale, Info, Award, HelpCircle } from 'lucide-react';
import { FinanceAppState, reverseNetSalaryToGross } from '../utils/financeState';

interface AnnuityViewProps {
  financeState: FinanceAppState;
}

export function AnnuityView({ financeState }: AnnuityViewProps) {
  const [activeTab, setActiveTab ] = useState<'compounding' | 'tax_payout'>('compounding');

  const [salary, setSalary] = useState('12000');
  const [personalRate, setPersonalRate] = useState('4'); // 4% default
  const [companyRate, setCompanyRate] = useState('8'); // 8% default
  const [years, setYears] = useState('25');
  const [interestRate, setInterestRate] = useState('4.5'); // 4.5% annual yield expected

  // Load salary & working years dynamically from user profile
  useEffect(() => {
    if (financeState.profile) {
      const gross = reverseNetSalaryToGross(financeState.profile.monthlyNetSalary || 12000);
      setSalary(Math.round(gross).toString());
      
      const diffYears = Math.max(15, financeState.profile.retireAge - financeState.profile.age);
      setYears(diffYears.toString());
    }
  }, [financeState.profile]);

  const calcAnnuity = () => {
    const s = parseFloat(salary) || 0;
    const pr = (parseFloat(personalRate) || 0) / 100;
    const cr = (parseFloat(companyRate) || 0) / 100;
    const y = parseInt(years) || 0;
    const r = (parseFloat(interestRate) || 0) / 100;

    const monthlyContribution = s * (pr + cr);
    const annualContribution = monthlyContribution * 12;

    // Future value of an ordinary annuity compounding annually
    // FV = P * [ (1 + r)^n - 1 ] / r
    let futureValue = 0;
    if (r === 0) {
      futureValue = annualContribution * y;
    } else {
      futureValue = annualContribution * ((Math.pow(1 + r, y) - 1) / r);
    }

    // Monthly payout estimate over 15 years (180 months) of retirement
    const monthlyPayout = futureValue / 180;

    return { 
      monthlyContribution, 
      totalContributions: annualContribution * y, 
      futureValue, 
      monthlyPayout 
    };
  };

  const res = calcAnnuity();

  // Payout tax comparison logics (B)
  const calcTaxPayoutComparison = () => {
    const fv = res.futureValue;
    
    // 1. Lump Sum Option (一次性领取):
    // Treated as comprehensive income for the single taxable year under Chinese taxation laws OR separate flat tax (generally 10% flat under modern rules).
    const lumpSumTaxRate = 0.10; // 10% flat rule
    const lumpSumTax = fv * lumpSumTaxRate;
    const lumpSumNet = fv - lumpSumTax;

    // 2. Installments Option (按月分期):
    // Treated as standard tax-free allocations or taxed individually in separate months. Under current guidelines, pension/annuity paid out dynamically benefits from a lower separate tax brackets (nearly tax-exempt 3% rate).
    const monthlyAmt = res.monthlyPayout;
    const installTaxRate = 0.03; // super favorable 3% bracket
    const installTaxMonthly = monthlyAmt * installTaxRate;
    const installNetMonthly = monthlyAmt - installTaxMonthly;
    const installTotalNet = installNetMonthly * 180;

    const savedTax = Math.max(0, lumpSumTax - (installTaxMonthly * 180));

    return {
      lumpSumTax,
      lumpSumNet: Math.round(lumpSumNet),
      installTaxMonthly: Math.round(installTaxMonthly),
      installNetMonthly: Math.round(installNetMonthly),
      installTotalNet: Math.round(installTotalNet),
      savedTax: Math.round(savedTax)
    };
  };

  const payoutRep = calcTaxPayoutComparison();

  return (
    <div className="p-4 space-y-4 max-w-sm mx-auto w-full text-left">
      
      {/* City Context */}
      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-2">
        <Sparkles size={16} className="text-indigo-600 shrink-0" />
        <p className="text-[10px] text-indigo-900 leading-tight font-medium">
          已对接您的理财生命档案。已预装预计可滚存积累工期 <b>{years}年</b> 等计算参数进行全实体联动。
        </p>
      </div>

      <div className="flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100">
        <button 
          onClick={() => setActiveTab('compounding')}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl transition ${activeTab === 'compounding' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          复利增值追踪 (A, C)
        </button>
        <button 
          onClick={() => setActiveTab('tax_payout')}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl transition ${activeTab === 'tax_payout' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          领取税差比对 (B)
        </button>
      </div>

      {activeTab === 'compounding' && (
        <div className="space-y-4 text-xs animate-in fade-in duration-150">
          <Card className="shadow-sm border border-slate-100 bg-white">
            <CardContent className="p-4 space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 mb-1">每月年金申报缴存基数 (元/月)</label>
                <input type="number" value={salary} onChange={e => setSalary(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">个人缴存比 (%)</label>
                  <input type="number" value={personalRate} onChange={e => setPersonalRate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">企业匹配比 (%)</label>
                  <input type="number" value={companyRate} onChange={e => setCompanyRate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">连续共积累 (年)</label>
                  <input type="number" value={years} onChange={e => setYears(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">历史投资年复合收益率 (%)</label>
                  <input type="number" step="0.1" value={interestRate} onChange={e => setInterestRate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold focus:outline-none" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-indigo-50/50 border border-indigo-100 shadow-sm bg-white">
            <CardContent className="p-4 space-y-3.5 text-left">
              <div className="flex items-center gap-1.5 text-indigo-800 font-bold text-xs">
                <Target size={15} />
                <span>补充企业年金本金利息最终滚存值</span>
              </div>
              
              <div className="text-center bg-white py-3 rounded-2xl border border-dashed border-indigo-300">
                 <div className="text-[10px] text-slate-400 font-semibold mb-0.5">预计退休时一次性累计滚存本息</div>
                 <div className="text-2xl font-black text-indigo-600 font-mono">¥{res.futureValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
              </div>

              <div className="space-y-1.5 text-[10px] text-slate-600 bg-slate-50/50 p-2.5 rounded-xl font-medium">
                 <div className="flex justify-between">
                   <span>每月合计总缴存 (双边):</span>
                   <span className="font-bold text-slate-800 font-mono">¥{Math.round(res.monthlyContribution).toLocaleString()} / 月</span>
                 </div>
                 <div className="flex justify-between">
                   <span>双方投入本金总和:</span>
                   <span className="font-bold text-slate-800 font-mono">¥{Math.round(res.totalContributions).toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between pt-1 text-indigo-600 font-bold border-t border-slate-200">
                   <span>退休分配预估每月增发 (分期):</span>
                   <span className="font-mono">¥{res.monthlyPayout.toFixed(1)} / 月</span>
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'tax_payout' && (
        <div className="space-y-4 animate-in fade-in duration-150 text-xs">
          <Card className="shadow-sm border border-slate-150 bg-white">
            <CardContent className="p-4 space-y-3.5">
              
              <div className="flex gap-2 items-center text-indigo-900 font-bold text-xs">
                <Scale className="text-indigo-600 shrink-0" />
                <span>年金税费差额对比：一次性 vs 按月分期</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                企业/职业年金在退休发放时需要补缴所得税。我国税法对分期按月和一次性领取有不同的计税优惠规则：
              </p>

              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2">
                <p className="font-extrabold text-[10px] text-indigo-950">💡 【分期按月领取】极其推荐！</p>
                <p className="text-[9px] text-indigo-900 leading-normal">
                  分期领取年金可单独享受 <b>3% 优惠直下阶层档</b>，免去合并暴增起征所得额。相比一次性套现，分期计划能为您省税总计高达 <b className="text-red-600">¥{payoutRep.savedTax.toLocaleString()} 元</b> 的真金白银！
                </p>
              </div>

              {/* STATS */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">税费明细对账折算:</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-rose-50/20 border border-rose-100/40 rounded-xl space-y-1">
                    <span className="text-[9px] text-red-700 font-bold block">方案 A：一次套现</span>
                    <span className="text-xs font-bold text-slate-800 font-mono block">到手: ¥{payoutRep.lumpSumNet.toLocaleString()}</span>
                    <span className="text-[8px] text-slate-400 block font-medium">按 10% 优惠代扣所得税</span>
                  </div>
                  
                  <div className="p-3 bg-emerald-50/20 border border-emerald-100/40 rounded-xl space-y-1">
                    <span className="text-[9px] text-emerald-700 font-bold block">方案 B：按月分领</span>
                    <span className="text-xs font-bold text-indigo-950 font-mono block">到手: ¥{payoutRep.installNetMonthly.toLocaleString()} /月</span>
                    <span className="text-[8px] text-slate-400 block font-medium">总得: ¥{payoutRep.installTotalNet.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Safety info note */}
      <div className="p-3 bg-slate-100 border border-slate-200 text-[10px] text-slate-405 rounded-2xl flex gap-1.5 items-start">
        <HelpCircle size={14} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[9px] text-slate-400 leading-normal">
          年金是由于大中型福利国企或优质事业单位设立的延迟补充福利。年投资收益率设在在 4% 左右为稳健估值，具有不可估量的递延福利滚存效果。
        </p>
      </div>

    </div>
  );
}
