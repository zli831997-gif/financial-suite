import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { 
  Calculator, HelpCircle, Sparkles, Scale, Info, Landmark, 
  TrendingUp, TrendingDown, Hourglass, ShieldCheck 
} from 'lucide-react';
import { FinanceAppState, reverseNetSalaryToGross } from '../utils/financeState';
import { calcEmployeePension as calcEmpPension, calcResidentPension as calcResPension, calcPersonalPension as calcPerPension, PERSONAL_PENSION_TAX_BRACKETS, getProvincePensionBase } from '../logic/calc/pension';

interface PensionViewProps {
  financeState: FinanceAppState;
}

export function PensionView({ financeState }: PensionViewProps) {
  const [activeTab, setActiveTab] = useState<'employee' | 'resident' | 'tax_incentive'>('employee');

  // Employee Pension states
  const [currentAge, setCurrentAge] = useState('30');
  const [retireAge, setRetireAge] = useState('60');
  const [salary, setSalary] = useState('12000');
  const [localSalary, setLocalSalary] = useState('9307'); // Default matching standard Cantonese 9307 base
  const [years, setYears] = useState('25');

  // Resident Pension states (D: 父母农保/城居保)
  const [parentContrib, setParentContrib] = useState<string>('2000'); // Annual contribution standard (e.g. 500-8000)
  const [parentYears, setParentYears] = useState<string>('15'); // Contribution years
  const [residentCity, setResidentCity] = useState<string>('粤'); // Subsidies differ by prov

  // Tax Incentive states (C: 第三支柱个人养老金)
  const [annualThirdPillar, setAnnualThirdPillar] = useState<string>('12000'); // Standard cap ¥12,000

  // Load from master financeState profile variables
  useEffect(() => {
    if (financeState.profile) {
      setCurrentAge(financeState.profile.age.toString());
      setRetireAge(financeState.profile.retireAge.toString());
      
      const gross = reverseNetSalaryToGross(financeState.profile.monthlyNetSalary || 12000);
      setSalary(Math.round(gross).toString());
      
      setLocalSalary(String(getProvincePensionBase(financeState.profile.city)));
      
      const diffYears = Math.max(15, financeState.profile.retireAge - financeState.profile.age);
      setYears(diffYears.toString());
    }
  }, [financeState.profile]);

  const calcEmployeePension = () => {
    const retAge = parseInt(retireAge) || 60;
    const baseSpl = parseFloat(salary) || 0;
    const contribYears = parseInt(years) || 15;
    const accumAccount = baseSpl * 0.08 * 12 * contribYears;
    const r = calcEmpPension({
      avgSocialSalary: parseFloat(localSalary) || undefined,
      province: financeState.profile.city,
      personalSalary: baseSpl,
      contributionYears: contribYears,
      personalAccountBalance: accumAccount,
      retireAge: retAge,
    });
    return { basicPension: r.basePension, personalPension: r.accountPension, total: r.monthlyPension, accumAccount };
  };

  const calcResidentPension = () => {
    const annualPay = parseFloat(parentContrib) || 2000;
    const payYears = parseInt(parentYears) || 15;
    const provinceMap: Record<string, string> = { '京': '北京', '沪': '上海', '粤': '广东' };
    const govMap: Record<string, number> = { '京': 150, '沪': 200, '粤': 120 };
    const prov = provinceMap[residentCity] || '';
    const gov = govMap[residentCity] ?? 80;
    const r = calcResPension({ province: prov, annualPayment: annualPay, years: payYears, govSubsidy: gov, interestRate: 0.025, retireAge: 60 });
    return { basePension: Math.round(r.basePension), personalPension: Math.round(r.accountPension), total: Math.round(r.monthlyPension), accumPool: Math.round(r.accountBalance) };
  };

  const calcThirdPillarTaxSaving = () => {
    const rawVal = parseFloat(annualThirdPillar) || 0;
    const s = parseFloat(salary) || 0;
    const annualEstTaxable = Math.max(0, s * 12 - 60000);
    let rate = 0.03;
    for (const b of PERSONAL_PENSION_TAX_BRACKETS) {
      if (annualEstTaxable <= b.upper) { rate = b.rate; break; }
    }
    const contribYears = Math.max(5, (parseInt(retireAge) || 60) - (parseInt(currentAge) || 30));
    const r = calcPerPension({ annualContribution: rawVal, marginalTaxRate: rate, years: contribYears, returnRate: 0.038 });
    return {
      taxSaved: Math.round(r.annualTaxSaving),
      bracketRate: Math.round(rate * 100),
      futureBalance: Math.round(r.accountBalance),
      yearsOfCompounding: contribYears
    };
  };

  const empRes = calcEmployeePension();
  const resRes = calcResidentPension();
  const tpRes = calcThirdPillarTaxSaving();

  // Lifespan Analysis: Early Retirement vs Normal Delayed Delta (E)
  const averageLifespan = 82;
  const normalRetireAge = parseInt(retireAge) || 60;
  
  // Simulated early retirement package
  const earlyRetireYearsLimit = Math.max(15, (parseInt(years) || 25) - 5);
  const earlyBasic = ((parseFloat(localSalary) + parseFloat(salary)) / 2) * earlyRetireYearsLimit * 0.01;
  const earlyPersonal = (parseFloat(salary) * 0.08 * 12 * earlyRetireYearsLimit) / 170; // lower age divisor
  const earlyTotal = earlyBasic + earlyPersonal;

  const normalMonths = (averageLifespan - normalRetireAge) * 12;
  const earlyMonths = (averageLifespan - (normalRetireAge - 5)) * 12;

  const totalNormalEarnings = empRes.total * normalMonths;
  const totalEarlyEarnings = earlyTotal * earlyMonths;
  const earningsDelta = totalNormalEarnings - totalEarlyEarnings;

  return (
    <div className="p-4 space-y-4 max-w-sm mx-auto w-full text-left">
      
      {/* Tab selection menu */}
      <div className="flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100 gap-0.5">
        <button 
          onClick={() => setActiveTab('employee')}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl transition ${activeTab === 'employee' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          城镇职工统筹
        </button>
        <button 
          onClick={() => setActiveTab('resident')}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl transition ${activeTab === 'resident' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          城乡居民养老 (爸妈)
        </button>
        <button 
          onClick={() => setActiveTab('tax_incentive')}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl transition ${activeTab === 'tax_incentive' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          第3支柱税优 (个人)
        </button>
      </div>

      {activeTab === 'employee' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <Card className="shadow-sm border border-slate-100 bg-white">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">当前年龄 (岁)</label>
                  <input type="number" value={currentAge} onChange={e => setCurrentAge(e.target.value)} className="w-full p-2 text-xs bg-slate-50 border border-slate-250 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">法定退休年龄 (岁)</label>
                  <input type="number" value={retireAge} onChange={e => setRetireAge(e.target.value)} className="w-full p-2 text-xs bg-slate-50 border border-slate-250 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold" />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 mb-1">月个人缴存社保基数 (元)</label>
                <input type="number" value={salary} onChange={e => setSalary(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">社平月综合平均薪 (本地)</label>
                  <input type="number" value={localSalary} onChange={e => setLocalSalary(e.target.value)} className="w-full p-2 text-xs bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">累计预缴基本年数 (年)</label>
                  <input type="number" value={years} onChange={e => setYears(e.target.value)} className="w-full p-2 text-xs bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold focus:outline-none" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BASIC PENSION OUTPUT CARD */}
          <Card className="bg-emerald-50/40 border border-emerald-100 shadow-sm bg-white">
            <CardContent className="p-4 space-y-3.5">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                <Landmark size={15} />
                <span>预计国家统筹发放月领退休资</span>
              </div>
              
              <div className="text-center bg-white py-3 rounded-2xl border border-dashed border-emerald-200">
                 <div className="text-[10px] text-slate-400 font-semibold">退休后每月领取养老金 (元/月)</div>
                 <div className="text-2xl font-black text-emerald-600 font-mono">¥{empRes.total.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
              </div>

              <div className="space-y-1.5 text-[10px] text-slate-600 bg-slate-50/50 p-2.5 rounded-xl font-medium">
                 <div className="flex justify-between">
                   <span>基础养老金部分 (统筹池分配):</span>
                   <span className="font-bold text-slate-800">¥{Math.round(empRes.basicPension).toLocaleString()} / 月</span>
                 </div>
                 <div className="flex justify-between">
                   <span>个人账户累滚返还资金:</span>
                   <span className="font-bold text-slate-800">¥{Math.round(empRes.personalPension).toLocaleString()} / 月</span>
                 </div>
                 <div className="flex justify-between pt-1 border-t border-slate-100 text-[10px]">
                   <span>法定退休时个人账户本息和:</span>
                   <span className="font-bold text-slate-800 font-mono">¥{Math.round(empRes.accumAccount).toLocaleString()}</span>
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* DELAYED / LIFE DELTA ANALYSIS (B & E) */}
          <Card className="border border-slate-150 bg-white">
            <CardContent className="p-4 space-y-3 text-xs">
              <span className="font-extrabold text-slate-800 flex items-center gap-1 text-xs">
                <Scale size={14} className="text-indigo-650" />
                <span>正常退休 vs 提前退休终生命领取 delta 比照</span>
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">
                假定平均长寿生命至 <b>{averageLifespan} 岁</b>。相较于若提前 5 年退休：
              </p>

              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span>正常退休终身总领取 (领 {normalMonths} 个月):</span>
                  <span className="font-semibold text-indigo-950 font-mono text-xs">
                    ¥{Math.round(totalNormalEarnings).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>提前退休终身总领取 (领 {earlyMonths} 个月):</span>
                  <span className="font-semibold text-slate-600 font-mono text-xs">
                    ¥{Math.round(totalEarlyEarnings).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-indigo-200 font-bold text-slate-900">
                  <span>累计少领净差值 Delta 损失:</span>
                  <span className="text-red-600 font-mono text-xs">
                    -¥{Math.round(Math.abs(earningsDelta)).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'resident' && (
        <div className="space-y-4 animate-in fade-in duration-200 text-xs">
          <Card className="shadow-sm border border-slate-100 bg-white">
            <CardContent className="p-4 space-y-3.5">
              <div>
                <h4 className="font-extrabold text-slate-800 text-xs">城乡居民养老金估算（父母辈无社保参投）</h4>
                <p className="text-[9px] text-slate-400 mt-0.5">帮助父母家人缴纳新型农村合作保障 (新农保) / 城乡居民社会养老金测算。</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">地区自缴档位 (年)</label>
                  <select 
                    value={residentCity} 
                    onChange={e => setResidentCity(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-205 rounded-lg text-xs font-bold"
                  >
                    <option value="京">北京地区 (最高)</option>
                    <option value="沪">上海地区 (首善)</option>
                    <option value="粤">广东省标准</option>
                    <option value="中">中西部及一般内陆</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">父母年参存标准 (元/年)</label>
                  <input 
                    type="number" 
                    value={parentContrib} 
                    onChange={e => setParentContrib(e.target.value)} 
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-slate-500 mb-1">父母累计定投年限 (通常需15年)</label>
                  <input 
                    type="number" 
                    value={parentYears} 
                    onChange={e => setParentYears(e.target.value)} 
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                  />
                </div>
              </div>

              {/* OUT */}
              <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/60 text-center">
                 <span className="text-[9px] font-bold text-emerald-800 block">父母到达60岁基础领取养老金</span>
                 <p className="text-xl font-black text-emerald-600 font-mono mt-0.5">
                   ¥{resRes.total} <span className="text-[10px] font-medium text-slate-400">元/月</span>
                 </p>
                 <span className="text-[8px] text-slate-400 font-medium block mt-1">
                   含当地政府基础普惠金: ¥{resRes.basePension} + 自参滚存年返还: ¥{resRes.personalPension}
                 </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'tax_incentive' && (
        <div className="space-y-4 animate-in fade-in duration-200 text-xs">
          <Card className="shadow-sm border border-slate-150 bg-white">
            <CardContent className="p-4 space-y-3.5">
              <div>
                <h4 className="font-extrabold text-slate-800 text-xs text-left">第3支柱个人养老金 (专属节税省税理财)</h4>
                <p className="text-[9px] text-slate-400 mt-0.5">在我国存入专属个人养老金理财账户，每年最高 1.2 万元申报抵扣起税点！</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
                <label className="block text-[10px] text-slate-500 font-bold mb-1">🛠️ 精制定投额额度 (上限 ¥12,000 /年)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={annualThirdPillar} 
                    onChange={e => setAnnualThirdPillar(e.target.value)} 
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none" 
                  />
                  <span className="absolute right-3 top-2 text-[10px] font-bold text-slate-400">元/年</span>
                </div>
              </div>

              {/* ESTIMATE RET */}
              <div className="p-3 bg-indigo-50/50 rounded-xl space-y-2 border border-indigo-100/60 font-semibold text-[11px] leading-relaxed">
                <div className="flex justify-between">
                  <span>根据月薪估计个税阶位:</span>
                  <span className="font-bold text-indigo-700 font-mono font-black">{tpRes.bracketRate}% 档位</span>
                </div>
                <div className="flex justify-between">
                  <span>每年为您直接减免/少交个税:</span>
                  <span className="text-red-650 font-mono font-extrabold">¥{tpRes.taxSaved} 元</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-indigo-200 text-slate-900 font-bold text-[11px]">
                  <span>退休离岗时此笔滚存总富留 (年限 {tpRes.yearsOfCompounding}年 3.8%复利):</span>
                  <span className="text-emerald-600 font-mono font-extrabold">
                    ¥{tpRes.futureBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
