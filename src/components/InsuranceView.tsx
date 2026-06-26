import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { 
  Info, BarChart2, ArrowRightLeft, Sparkles, ShieldCheck, 
  MapPin, Landmark, HeartPulse, Scale, Check 
} from 'lucide-react';
import { FinanceAppState } from '../utils/financeState';
import { getCityRates, getCities, reverseBaseFromDeduction } from '../logic/calc/social';

interface InsuranceViewProps {
  financeState: FinanceAppState;
  onUpdateState?: (newState: FinanceAppState) => void;
}

// 城市参数从 calc/social CITY_RATES 构造（23 城真实比例）；医保模拟起付线/报销率用默认
function buildCityParam(city: string) {
  const r = getCityRates(city);
  return {
    pensionP: r.pension.personal, pensionC: r.pension.company,
    medicalP: r.medical.personal, medicalC: r.medical.company,
    unemployedP: r.unemployment.personal, unemployedC: r.unemployment.company,
    housingP: r.housingFund.personal, housingC: r.housingFund.company,
    workInjuryC: r.workInjury.company,
    medThreshold: 1000, medRate: 0.75,
  };
}

export function InsuranceView({ financeState, onUpdateState }: InsuranceViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'calculator' | 'balance' | 'freelance' | 'medical'>('calculator');
  const [selectedCity, setSelectedCity] = useState<string>('深圳');
  const [calcMode, setCalcMode] = useState<'base' | 'deduct'>('deduct');
  const [inputValue, setInputValue] = useState<string>('2400');

  // Balances estimator states (B)
  const [workingYears, setWorkingYears] = useState<string>('6');
  const [currentBase, setCurrentBase] = useState<string>('15000');
  
  // Medical Bill state (E)
  const [medicalBill, setMedicalBill] = useState<string>('4500');

  // Auto synchronize with dynamic user profile from parent state on initialization
  useEffect(() => {
    if (financeState.profile) {
      if (getCities().includes(financeState.profile.city)) {
        setSelectedCity(financeState.profile.city);
      }
      if (calcMode === 'deduct') {
        setInputValue(financeState.profile.socialInsuranceSelf.toString() || '2400');
      } else {
        const deducedBase = reverseBaseFromDeduction(financeState.profile.city || '深圳', financeState.profile.socialInsuranceSelf || 2400).base;
        setInputValue(Math.round(deducedBase).toString());
      }
    }
  }, [financeState.profile, calcMode]);

  const baseValue = calcMode === 'deduct'
    ? reverseBaseFromDeduction(selectedCity, parseFloat(inputValue) || 0).base
    : (parseFloat(inputValue) || 0);

  // Derive parameters from city configuration（23 城真实比例）
  const param = buildCityParam(selectedCity);

  // Individual Columns (P)
  const pPension = baseValue * param.pensionP;
  const pMedical = baseValue * param.medicalP;
  const pUnemployed = baseValue * param.unemployedP;
  const pHousing = baseValue * param.housingP;
  const pTotal = pPension + pMedical + pUnemployed + pHousing;

  // Enterprise/Employer Columns (C)
  const cPension = baseValue * param.pensionC;
  const cMedical = baseValue * param.medicalC;
  const cUnemployed = baseValue * param.unemployedC;
  const cHousing = baseValue * param.housingC;
  const cTotal = cPension + cMedical + cUnemployed + cHousing + (baseValue * param.workInjuryC);

  // Accumulated balances projection calculation (B)
  const calcAllocatedBalances = () => {
    const years = parseFloat(workingYears) || 0;
    const base = parseFloat(currentBase) || 12000;
    
    // Housing fund contribution = Employee + Employer = 2 * base * rate * 12 * years
    const accumHousing = 2 * base * param.housingP * 12 * years;
    
    // Individual Pension account contributions = base * 8% * 12 * years
    const accumPension = base * 0.08 * 12 * years;

    // Estimate interest yield compounding over years (approx 3% standard)
    const yieldFactor = 1.12; 
    
    return {
      housingBalance: Math.round(accumHousing * yieldFactor),
      pensionBalance: Math.round(accumPension * yieldFactor)
    };
  };

  const balances = calcAllocatedBalances();

  // Medical Reimbursement Simulation (E)
  const calcMedicalClaim = () => {
    const bill = parseFloat(medicalBill) || 0;
    const thresh = param.medThreshold;
    const rate = param.medRate;
    
    // Outpatient claim computation: (bill - deductible threshold) * reimbursement rate
    let claimAmount = 0;
    if (bill > thresh) {
      claimAmount = (bill - thresh) * rate;
    }
    const selfPay = bill - claimAmount;

    return {
      claimAmount: Math.round(claimAmount),
      selfPay: Math.round(selfPay)
    };
  };

  const medRep = calcMedicalClaim();

  return (
    <div className="p-4 space-y-4 max-w-sm mx-auto w-full text-left">
      
      {/* Subtab Bar */}
      <div className="flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100 overflow-x-auto gap-0.5">
        <button 
          onClick={() => setActiveSubTab('calculator')}
          className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition shrink-0 ${activeSubTab === 'calculator' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          比例测算 (A)
        </button>
        <button 
          onClick={() => setActiveSubTab('balance')}
          className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition shrink-0 ${activeSubTab === 'balance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          余额估算 (B)
        </button>
        <button 
          onClick={() => setActiveSubTab('freelance')}
          className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition shrink-0 ${activeSubTab === 'freelance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          自雇/企业对比 (D)
        </button>
        <button 
          onClick={() => setActiveSubTab('medical')}
          className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition shrink-0 ${activeSubTab === 'medical' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          医保报销 (E)
        </button>
      </div>

      {activeSubTab === 'calculator' && (
        <div className="space-y-4">
          <Card className="shadow-sm border border-slate-100 bg-white">
            <CardContent className="p-4 space-y-3.5">
              
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <MapPin size={14} className="text-emerald-600" />
                  <span>定位生活城市</span>
                </div>
                <select 
                  value={selectedCity} 
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  {getCities().map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center mb-1">
                <h3 className="text-xs font-bold text-slate-800">计算申报口径</h3>
                <button 
                  onClick={() => setCalcMode(prev => prev === 'base' ? 'deduct' : 'base')}
                  className="text-[9px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg transition"
                >
                  <ArrowRightLeft size={10} />
                  <span>切换至: {calcMode === 'deduct' ? '直接填申报基数' : '扣款倒推'}</span>
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {calcMode === 'deduct' ? '🛡️ 每月主卡扣减五险一金合计额 (元)' : '💼 每月职工申报社保公积金基数 (元)'}
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={inputValue} 
                      onChange={e => setInputValue(e.target.value)} 
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-12" 
                    />
                    <span className="absolute right-3.5 top-2 text-[10px] text-slate-400 font-bold font-mono">元/月</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-100/50 rounded-xl border border-slate-100 text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">由此反推/核定申报缴存基数</span>
                <p className="text-lg font-black text-slate-800 font-mono mt-0.5">
                  ¥{Math.round(baseValue).toLocaleString()} 元
                </p>
              </div>

              {/* SPLIT BREAKDOWNS */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5 bg-rose-50/20 p-2.5 border border-rose-100/40 rounded-xl">
                  <span className="text-[10px] font-extrabold text-red-700">👤 员工扣款 (合计: ¥{Math.round(pTotal)})</span>
                  <ul className="space-y-1 text-[9px] text-slate-600 font-mono">
                    <li className="flex justify-between"><span>养老 (8%)</span><span>¥{Math.round(pPension)}</span></li>
                    <li className="flex justify-between"><span>医疗 (2%)</span><span>¥{Math.round(pMedical)}</span></li>
                    <li className="flex justify-between"><span>公积 ({(param.housingP*100).toFixed(0)}%)</span><span>¥{Math.round(pHousing)}</span></li>
                  </ul>
                </div>

                <div className="space-y-1.5 bg-blue-50/20 p-2.5 border border-blue-100/40 rounded-xl">
                  <span className="text-[10px] font-extrabold text-blue-700">🏢 企业自备 (合计: ¥{Math.round(cTotal)})</span>
                  <ul className="space-y-1 text-[9px] text-slate-600 font-mono">
                    <li className="flex justify-between"><span>养老 ({(param.pensionC*100).toFixed(0)}%)</span><span>¥{Math.round(cPension)}</span></li>
                    <li className="flex justify-between"><span>医疗 ({(param.medicalC*100).toFixed(1)}%)</span><span>¥{Math.round(cMedical)}</span></li>
                    <li className="flex justify-between"><span>公积 ({(param.housingC*100).toFixed(0)}%)</span><span>¥{Math.round(cHousing)}</span></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSubTab === 'balance' && (
        <div className="space-y-4">
          <Card className="shadow-sm border border-slate-100 bg-white">
            <CardContent className="p-4 space-y-3.5 text-xs text-left">
              <div>
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                  <Landmark className="text-emerald-600" size={15} />
                  <span>公积金与养老金个人账户滚存估算</span>
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">一键评估您在国家统筹框架内已积累的潜在核心隐性资产。</p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl">
                <div>
                  <label className="block text-[9px] text-slate-500 font-bold mb-1">累计工龄年数 (年)</label>
                  <input 
                    type="number" 
                    value={workingYears} 
                    onChange={e => setWorkingYears(e.target.value)} 
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 font-bold mb-1">平均缴费基数 (元/月)</label>
                  <input 
                    type="number" 
                    value={currentBase} 
                    onChange={e => setCurrentBase(e.target.value)} 
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                  />
                </div>
              </div>

              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">累计至今年底个人专属账户本金利息:</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-indigo-50/50 rounded-xl space-y-0.5 border border-indigo-100/50">
                  <span className="text-[9px] font-bold text-indigo-600 block">住房公积金存量估额</span>
                  <span className="text-sm font-black font-mono text-indigo-950">
                    ¥{balances.housingBalance.toLocaleString()}
                  </span>
                  <span className="text-[8px] text-slate-400 block font-medium">双边缴存累进</span>
                </div>
                <div className="p-3 bg-emerald-50/50 rounded-xl space-y-0.5 border border-emerald-100/50">
                  <span className="text-[9px] font-bold text-emerald-600 block">养老保险个人账户部分</span>
                  <span className="text-sm font-black font-mono text-emerald-950">
                    ¥{balances.pensionBalance.toLocaleString()}
                  </span>
                  <span className="text-[8px] text-slate-400 block font-medium">随法定利息滚存</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSubTab === 'freelance' && (
        <div className="space-y-4">
          <Card className="shadow-sm border border-slate-100 bg-white">
            <CardContent className="p-4 space-y-3 text-xs">
              <div>
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                  <Scale className="text-emerald-600" size={15} />
                  <span>灵活就业(自雇) vs 职工缴存性价比</span>
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">对于自由职业、副业/灵活就业人员最划算的缴纳决策。</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-2">
                <div className="border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-800 font-extrabold">📌 灵活就业自费缴纳 (无单位)</span>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    养老保险缴存比例降为 <b>20%</b>（其中 8% 计入个人账户，12% 进入统筹统调池）。医疗险根据档次一般缴存 <b>8%</b> 左右。
                  </p>
                </div>
                <div>
                  <span className="text-slate-800 font-extrabold">📌 普通正规单位职工代扣金额</span>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    单位需为职工向统筹水池注水 <b>16% 养老</b> 与 <b>6% 医保</b>，个人只需扣缴部分。
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl">
                <span className="text-amber-900 font-extrabold text-[10px] block">🏆 缴存决策专家建议:</span>
                <p className="text-[9px] text-amber-800 leading-relaxed mt-0.5">
                  自费灵活就业养老保险性价比较低（12%属于无偿统筹），如果不是为了攒城市社保资格，可以通过<b>【第三支柱个人养老金】优惠理财</b>获取高抵税高回报分期，或优先选择按最低基数自缴以防断档。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSubTab === 'medical' && (
        <div className="space-y-4">
          <Card className="shadow-sm border border-slate-150 bg-white">
            <CardContent className="p-4 space-y-3.5 text-xs text-left">
              <div>
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                  <HeartPulse className="text-rose-600 animate-pulse" size={15} />
                  <span>国家基础医疗保险报销模拟</span>
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">输入一次在三甲医院门急诊/住院的医疗费用总支出，核算出大病报销。</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 space-y-3.5">
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1">🏥 发生三甲医院门诊/住院总发票金额 (元)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={medicalBill} 
                      onChange={e => setMedicalBill(e.target.value)} 
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none" 
                    />
                    <span className="absolute right-3 top-2 text-[10px] font-bold text-slate-400">元</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-semibold leading-normal">
                  <div>
                    <span>{selectedCity}本地免赔起征线:</span>
                    <p className="text-slate-800 font-bold">¥{param.medThreshold} / 年</p>
                  </div>
                  <div>
                    <span>报销比例 (统筹比例):</span>
                    <p className="text-slate-800 font-bold">{(param.medRate * 100).toFixed(0)}% </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold text-slate-600">🏥 医保基金统筹为你报销支付:</span>
                  <span className="font-mono text-emerald-600 font-extrabold">¥{medRep.claimAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-rose-100/60 text-slate-800 font-bold">
                  <span>个人自付自负项金额:</span>
                  <span className="font-mono text-rose-600">¥{medRep.selfPay.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Safety note footer */}
      <div className="p-3 bg-indigo-50/40 border border-indigo-100 text-[10px] text-slate-500 rounded-2xl flex gap-1.5 items-start">
        <ShieldCheck size={14} className="text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-slate-800 mb-0.5 mt-0">保障与档案一键核验</p>
          <p className="leading-relaxed">基数参数已完成对【养老金预测】和【个税反向算费】跨页一阶实体联通，极大方便打工族全景沙盘演算。</p>
        </div>
      </div>

    </div>
  );
}
