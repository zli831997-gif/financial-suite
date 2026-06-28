import { useState, useMemo } from 'react';
import { View, Text, Input } from '@tarojs/components';
import { FinanceAppState, reverseNetSalaryToGross } from '@finance/utils/financeState';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import {
  calcAnnualSettlementTax,
  calcSpecialDeductions,
  calcRentDeduction,
  calcBonusTax,
  RENT_STANDARDS,
  type SpecialDeductionInput,
  type RentCityTier,
} from '@finance/logic/calc/tax';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import './index.css';

/**
 * 跨端退税模拟器（年度汇算 + 专项扣除完整版 + 全年预演）。
 * 复用 calcAnnualSettlementTax / calcSpecialDeductions / calcBonusTax。
 * Tab2 专项扣除为完整版：7项 + 互斥 + 分摊 + 据实。
 * 不持久化填报（纯模拟器），退出即清。
 */

type Tab = 'settlement' | 'special' | 'forecast';

function fmt(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}
function fmtSigned(n: number): string {
  return `${n >= 0 ? '+' : ''}¥${Math.round(Math.abs(n)).toLocaleString()}`;
}

export default function TaxRefund() {
  const financeState: FinanceAppState =
    storage.get<FinanceAppState>(KEYS.APP_STATE) ?? ({} as FinanceAppState);
  const grossSalary = financeState.profile
    ? Math.round(reverseNetSalaryToGross(financeState.profile.monthlyNetSalary || 12000))
    : 12000;

  const [tab, setTab] = useState<Tab>('settlement');

  // ── Tab1 年度汇算 输入 ──
  const [annualSalary, setAnnualSalary] = useState((grossSalary * 12).toString());
  const [annualBonus, setAnnualBonus] = useState('30000');
  const [mergeBonus, setMergeBonus] = useState(false);
  const [laborIncome, setLaborIncome] = useState('0');
  const [royaltyIncome, setRoyaltyIncome] = useState('0');
  const [socialInsurance, setSocialInsurance] = useState('36000');
  const [specialTotal, setSpecialTotal] = useState('36000');
  const [personalPension, setPersonalPension] = useState('0');
  const [alreadyWithheld, setAlreadyWithheld] = useState((grossSalary * 12 * 0.06).toString());

  // ── Tab2 专项扣除 输入（完整版）──
  const [childEdu, setChildEdu] = useState('0');
  const [infant, setInfant] = useState('0');
  const [contEdu, setContEdu] = useState<'none' | 'degree' | 'vocational'>('none');
  const [serious, setSerious] = useState('0');
  const [housingChoice, setHousingChoice] = useState<'none' | 'loan' | 'rent'>('none');
  const [rentTier, setRentTier] = useState<RentCityTier>('municipality');
  const [onlyChild, setOnlyChild] = useState(true);
  const [sharePct, setSharePct] = useState('50');

  const specialInput: SpecialDeductionInput = useMemo(() => ({
    childrenEducationCount: parseInt(childEdu) || 0,
    infantCareCount: parseInt(infant) || 0,
    continuingEducationType: contEdu,
    seriousIllnessExpense: parseFloat(serious) || 0,
    housingLoan: housingChoice === 'loan',
    housingRent: housingChoice === 'rent' ? { tier: rentTier } : null,
    elderlyCare: { onlyChild, sharePercent: onlyChild ? 100 : parseInt(sharePct) || 0 },
  }), [childEdu, infant, contEdu, serious, housingChoice, rentTier, onlyChild, sharePct]);
  const specialResult = useMemo(() => calcSpecialDeductions(specialInput), [specialInput]);

  // ── 年度汇算结果 ──
  const settlement = useMemo(() => {
    const bonus = parseFloat(annualBonus) || 0;
    const bonusTaxRes = mergeBonus
      ? { separate: { tax: 0 } }
      : calcBonusTax(bonus, parseFloat(annualSalary) || 0, parseFloat(socialInsurance) || 0, parseFloat(specialTotal) || 0);
    return calcAnnualSettlementTax({
      annualSalary: parseFloat(annualSalary) || 0,
      annualBonus: bonus,
      mergeBonus,
      laborIncome: parseFloat(laborIncome) || 0,
      royaltyIncome: parseFloat(royaltyIncome) || 0,
      socialInsurance: parseFloat(socialInsurance) || 0,
      specialDeductionsTotal: parseFloat(specialTotal) || 0,
      personalPension: parseFloat(personalPension) || 0,
      alreadyWithheld: parseFloat(alreadyWithheld) || 0,
      bonusSeparateTax: bonusTaxRes.separate.tax,
    });
  }, [annualSalary, annualBonus, mergeBonus, laborIncome, royaltyIncome, socialInsurance, specialTotal, personalPension, alreadyWithheld]);

  // ── Tab3 全年预演（基于当前月份进度）──
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const monthsElapsed = currentMonth;
  const forecast = useMemo(() => {
    const projectedAnnualTax = settlement.annualTax + settlement.bonusTax;
    const projectedWithhold = (parseFloat(alreadyWithheld) || 0) / monthsElapsed * 12;
    return {
      projectedAnnualTax,
      projectedWithhold,
      projectedRefund: projectedWithhold - projectedAnnualTax,
      avgMonthlyTax: projectedAnnualTax / 12,
    };
  }, [settlement, alreadyWithheld, monthsElapsed]);

  return (
    <View className='p-4 space-y-4 max-w-md mx-auto w-full min-h-screen bg-slate-50 pb-6'>
      <View className='pb-1 border-b border-slate-100'>
        <Text className='text-base font-black text-slate-900 flex items-center gap-1.5'>
          <Icon name='receipt' size={18} className='text-emerald-600' /> 年度退税模拟器
        </Text>
        <Text className='text-[10px] text-slate-400 block'>基于{new Date().getFullYear()}年个税法，实际以税务局汇算为准</Text>
      </View>

      {/* Tab 切换 */}
      <View className='flex bg-slate-200/50 p-1 rounded-2xl w-full border border-slate-100 gap-0.5'>
        {[
          { id: 'settlement' as Tab, label: '年度汇算' },
          { id: 'special' as Tab, label: '专项扣除' },
          { id: 'forecast' as Tab, label: '全年预演' },
        ].map((t) => (
          <Motion
            key={t.id}
            tapScale={0.95}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl text-center ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {t.label}
          </Motion>
        ))}
      </View>

      {tab === 'settlement' && <SettlementTab
        annualSalary={annualSalary} setAnnualSalary={setAnnualSalary}
        annualBonus={annualBonus} setAnnualBonus={setAnnualBonus}
        mergeBonus={mergeBonus} setMergeBonus={setMergeBonus}
        laborIncome={laborIncome} setLaborIncome={setLaborIncome}
        royaltyIncome={royaltyIncome} setRoyaltyIncome={setRoyaltyIncome}
        socialInsurance={socialInsurance} setSocialInsurance={setSocialInsurance}
        specialTotal={specialTotal} setSpecialTotal={setSpecialTotal}
        personalPension={personalPension} setPersonalPension={setPersonalPension}
        alreadyWithheld={alreadyWithheld} setAlreadyWithheld={setAlreadyWithheld}
        result={settlement}
      />}

      {tab === 'special' && <SpecialTab
        childEdu={childEdu} setChildEdu={setChildEdu}
        infant={infant} setInfant={setInfant}
        contEdu={contEdu} setContEdu={setContEdu}
        serious={serious} setSerious={setSerious}
        housingChoice={housingChoice} setHousingChoice={setHousingChoice}
        rentTier={rentTier} setRentTier={setRentTier}
        onlyChild={onlyChild} setOnlyChild={setOnlyChild}
        sharePct={sharePct} setSharePct={setSharePct}
        result={specialResult}
        onApply={(total) => { setSpecialTotal(total.toString()); setTab('settlement'); }}
      />}

      {tab === 'forecast' && <ForecastTab
        result={settlement} forecast={forecast}
        currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
      />}
    </View>
  );
}

/* ───────────── Tab1 年度汇算 ───────────── */
function SettlementTab(props: {
  annualSalary: string; setAnnualSalary: (v: string) => void;
  annualBonus: string; setAnnualBonus: (v: string) => void;
  mergeBonus: boolean; setMergeBonus: (v: boolean) => void;
  laborIncome: string; setLaborIncome: (v: string) => void;
  royaltyIncome: string; setRoyaltyIncome: (v: string) => void;
  socialInsurance: string; setSocialInsurance: (v: string) => void;
  specialTotal: string; setSpecialTotal: (v: string) => void;
  personalPension: string; setPersonalPension: (v: string) => void;
  alreadyWithheld: string; setAlreadyWithheld: (v: string) => void;
  result: ReturnType<typeof calcAnnualSettlementTax>;
}) {
  const r = props.result;
  const isRefund = r.refundOrPay >= 0;
  return (
    <View className='space-y-3'>
      <Card>
        <CardContent className='p-4 space-y-3'>
          <Text className='text-xs font-bold text-slate-500 block'>全年收入（综合所得）</Text>
          <Field label='全年税前工资' value={props.annualSalary} onChange={props.setAnnualSalary} hint='月薪×12' />
          <Field label='年终奖' value={props.annualBonus} onChange={props.setAnnualBonus} />
          <View className='flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2'>
            <Text className='text-[10px] font-semibold text-slate-600'>年终奖计税方式</Text>
            <Motion
              tapScale={0.95}
              onClick={() => props.setMergeBonus(!props.mergeBonus)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${props.mergeBonus ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              {props.mergeBonus ? '并入综合' : '单独计税'}
            </Motion>
          </View>
          <Field label='劳务报酬（全年毛额）' value={props.laborIncome} onChange={props.setLaborIncome} hint='按80%计入' />
          <Field label='稿酬（全年毛额）' value={props.royaltyIncome} onChange={props.setRoyaltyIncome} hint='按80%×70%计入' />
        </CardContent>
      </Card>

      <Card>
        <CardContent className='p-4 space-y-3'>
          <Text className='text-xs font-bold text-slate-500 block'>各项扣除</Text>
          <Field label='全年社保公积金' value={props.socialInsurance} onChange={props.setSocialInsurance} />
          <View className='flex items-center justify-between bg-indigo-50/40 rounded-lg px-3 py-2'>
            <Text className='text-[10px] font-semibold text-slate-600'>专项附加扣除</Text>
            <Text className='text-xs font-bold text-indigo-600 font-mono'>{fmt(parseFloat(props.specialTotal) || 0)}</Text>
          </View>
          <Field label='个人养老金缴存' value={props.personalPension} onChange={props.setPersonalPension} hint='上限12000' />
        </CardContent>
      </Card>

      <Card>
        <CardContent className='p-4 space-y-3'>
          <Text className='text-xs font-bold text-slate-500 block'>已预扣预缴</Text>
          <Field label='全年已预扣个税' value={props.alreadyWithheld} onChange={props.setAlreadyWithheld} hint='工资条累计已扣' />
        </CardContent>
      </Card>

      {/* 结果 */}
      <Card className={`${isRefund ? 'border-emerald-200' : 'border-rose-200'}`}>
        <CardContent className={`p-5 text-center ${isRefund ? 'bg-emerald-50/50' : 'bg-rose-50/50'}`}>
          <Text className={`text-[11px] font-bold block mb-1 ${isRefund ? 'text-emerald-700' : 'text-rose-700'}`}>
            {isRefund ? '🎉 预计可退税' : '⚠️ 预计需补税'}
          </Text>
          <Text className={`text-3xl font-black font-mono block ${isRefund ? 'text-emerald-600' : 'text-rose-600'}`}>
            {fmtSigned(r.refundOrPay)}
          </Text>
          <Text className='text-[10px] text-slate-400 mt-1 block'>
            应纳{fmt(r.totalTax)} − 已扣{fmt(r.alreadyWithheld)}
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardContent className='p-4 space-y-2'>
          <Text className='text-[10px] font-bold text-slate-500 block'>计税明细</Text>
          <Row label='综合所得' value={r.comprehensiveIncome} />
          <Row label='工资计税基' value={r.detail.salaryBase} />
          {r.detail.laborBase > 0 && <Row label='劳务(×80%)' value={r.detail.laborBase} />}
          {r.detail.royaltyBase > 0 && <Row label='稿酬(×80%×70%)' value={r.detail.royaltyBase} />}
          <View className='border-t border-slate-100 my-1' />
          <Row label='基本减除(6万)' value={-r.detail.basicDeduction} />
          <Row label='社保公积金' value={-r.detail.socialDeduction} />
          <Row label='专项附加扣除' value={-r.detail.specialDeduction} />
          {r.detail.pensionDeduction > 0 && <Row label='个人养老金' value={-r.detail.pensionDeduction} />}
          <View className='border-t border-slate-100 my-1' />
          <Row label='应纳税所得额' value={r.taxableIncome} bold />
          <Row label='综合所得应纳' value={r.annualTax} bold />
          {r.bonusTax > 0 && <Row label='年终奖应纳(单独)' value={r.bonusTax} />}
          <Row label='边际税率 / 有效税率' valueText={`${(r.marginalRate * 100).toFixed(0)}% / ${(r.effectiveRate * 100).toFixed(1)}%`} />
        </CardContent>
      </Card>

      <View className='p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-[10px] text-amber-800 leading-relaxed flex gap-1.5'>
        <Icon name='info' size={13} className='shrink-0 mt-0.5' />
        <View>
          <Text className='font-bold block'>退补原因分析</Text>
          <Text className='block'>
            {isRefund
              ? '已预扣多于应纳，常见原因：年度中途补填了专项附加扣除、年终奖单独计税、或有劳务稿酬费用扣除。次年3-6月在个税APP申请退税。'
              : '已预扣少于应纳，常见原因：未填专项附加扣除、或多处收入合并后跳档。需在汇算时补缴。'}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ───────────── Tab2 专项附加扣除（完整版）───────────── */
function SpecialTab(props: {
  childEdu: string; setChildEdu: (v: string) => void;
  infant: string; setInfant: (v: string) => void;
  contEdu: 'none' | 'degree' | 'vocational'; setContEdu: (v: 'none' | 'degree' | 'vocational') => void;
  serious: string; setSerious: (v: string) => void;
  housingChoice: 'none' | 'loan' | 'rent'; setHousingChoice: (v: 'none' | 'loan' | 'rent') => void;
  rentTier: RentCityTier; setRentTier: (v: RentCityTier) => void;
  onlyChild: boolean; setOnlyChild: (v: boolean) => void;
  sharePct: string; setSharePct: (v: string) => void;
  result: ReturnType<typeof calcSpecialDeductions>;
  onApply: (total: number) => void;
}) {
  const r = props.result;
  return (
    <View className='space-y-3'>
      {/* 子女教育 */}
      <Card>
        <CardContent className='p-4 space-y-2'>
          <View className='flex items-center gap-1.5'>
            <Icon name='info' size={13} className='text-indigo-600' />
            <Text className='text-xs font-bold text-slate-700'>子女教育 <Text className='text-[9px] text-slate-400 font-normal'>2000/月/人</Text></Text>
          </View>
          <NumStepper label='受教育子女数' value={props.childEdu} onChange={props.setChildEdu} />
        </CardContent>
      </Card>

      {/* 婴幼儿照护 */}
      <Card>
        <CardContent className='p-4 space-y-2'>
          <View className='flex items-center gap-1.5'>
            <Icon name='info' size={13} className='text-indigo-600' />
            <Text className='text-xs font-bold text-slate-700'>3岁以下婴幼儿照护 <Text className='text-[9px] text-slate-400 font-normal'>2000/月/人</Text></Text>
          </View>
          <NumStepper label='婴幼儿人数' value={props.infant} onChange={props.setInfant} />
        </CardContent>
      </Card>

      {/* 继续教育 */}
      <Card>
        <CardContent className='p-4 space-y-2'>
          <View className='flex items-center gap-1.5'>
            <Icon name='info' size={13} className='text-indigo-600' />
            <Text className='text-xs font-bold text-slate-700'>继续教育</Text>
          </View>
          <View className='flex gap-1'>
            {[
              { k: 'none', l: '无' },
              { k: 'degree', l: '学历 400/月' },
              { k: 'vocational', l: '职业证书 3600/年' },
            ].map((o) => (
              <Motion
                key={o.k}
                tapScale={0.95}
                onClick={() => props.setContEdu(o.k as any)}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg text-center ${props.contEdu === o.k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {o.l}
              </Motion>
            ))}
          </View>
        </CardContent>
      </Card>

      {/* 大病医疗（据实）*/}
      <Card>
        <CardContent className='p-4 space-y-2'>
          <View className='flex items-center gap-1.5'>
            <Icon name='info' size={13} className='text-rose-600' />
            <Text className='text-xs font-bold text-slate-700'>大病医疗（据实）<Text className='text-[9px] text-slate-400 font-normal'>超1.5万部分，上限8万</Text></Text>
          </View>
          <Field label='医保目录内自付金额（全年）' value={props.serious} onChange={props.setSerious} hint='据实填写' />
        </CardContent>
      </Card>

      {/* 住房（贷款/租金互斥）*/}
      <Card>
        <CardContent className='p-4 space-y-2'>
          <View className='flex items-center gap-1.5'>
            <Icon name='home' size={13} className='text-indigo-600' />
            <Text className='text-xs font-bold text-slate-700'>住房（贷款/租金二选一）</Text>
          </View>
          <View className='flex gap-1'>
            {[
              { k: 'none', l: '无' },
              { k: 'loan', l: '房贷利息 1000/月' },
              { k: 'rent', l: '租金' },
            ].map((o) => (
              <Motion
                key={o.k}
                tapScale={0.95}
                onClick={() => props.setHousingChoice(o.k as any)}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg text-center ${props.housingChoice === o.k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {o.l}
              </Motion>
            ))}
          </View>
          {props.housingChoice === 'rent' && (
            <View className='flex gap-1 mt-1'>
              {(['municipality', 'capital', 'other'] as RentCityTier[]).map((t) => (
                <Motion
                  key={t}
                  tapScale={0.95}
                  onClick={() => props.setRentTier(t)}
                  className={`flex-1 py-1 text-[9px] font-bold rounded-md text-center ${props.rentTier === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                  {RENT_STANDARDS[t].label.replace('城市', '').replace('直辖市/计划单列市', '直辖市')} {RENT_STANDARDS[t].monthly}
                </Motion>
              ))}
            </View>
          )}
        </CardContent>
      </Card>

      {/* 赡养老人 */}
      <Card>
        <CardContent className='p-4 space-y-2'>
          <View className='flex items-center gap-1.5'>
            <Icon name='info' size={13} className='text-amber-600' />
            <Text className='text-xs font-bold text-slate-700'>赡养老人 <Text className='text-[9px] text-slate-400 font-normal'>独生3000/月，非独生≤1500/月</Text></Text>
          </View>
          <View className='flex gap-1'>
            <Motion tapScale={0.95} onClick={() => props.setOnlyChild(true)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg text-center ${props.onlyChild ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              独生子女
            </Motion>
            <Motion tapScale={0.95} onClick={() => props.setOnlyChild(false)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg text-center ${!props.onlyChild ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              非独生子女
            </Motion>
          </View>
          {!props.onlyChild && (
            <View>
              <Text className='text-[9px] font-bold text-slate-500 block mb-1'>本人分摊比例（%）</Text>
              <View className='flex gap-1'>
                {[
                  { v: '50', l: '均摊50%' },
                  { v: '100', l: '独享(封顶1500)' },
                ].map((o) => (
                  <Motion key={o.v} tapScale={0.95} onClick={() => props.setSharePct(o.v)} className={`flex-1 py-1 text-[9px] font-bold rounded-md text-center ${props.sharePct === o.v ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {o.l}
                  </Motion>
                ))}
                <Input type='digit' value={props.sharePct} onInput={(e) => props.setSharePct(e.detail.value)} className='flex-1 py-1 px-2 bg-slate-50 rounded-md text-[10px] font-bold' placeholder='自定义%' />
              </View>
            </View>
          )}
        </CardContent>
      </Card>

      {/* 合计 + 应用 */}
      <Card className='border-emerald-200'>
        <CardContent className='p-4 bg-emerald-50/40'>
          <View className='flex justify-between items-center mb-3'>
            <Text className='text-xs font-bold text-slate-600'>专项附加扣除合计</Text>
            <Text className='text-xl font-black text-emerald-600 font-mono'>{fmt(r.total)}<Text className='text-[10px] text-slate-400 font-normal'>/年</Text></Text>
          </View>
          {r.items.length > 0 ? (
            <View className='space-y-1 mb-3'>
              {r.items.map((it) => (
                <View key={it.key} className='flex justify-between text-[10px]'>
                  <Text className='text-slate-500'>{it.label} <Text className='text-slate-300'>{it.note}</Text></Text>
                  <Text className='font-mono text-slate-700 font-semibold'>{fmt(it.amount)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className='text-[10px] text-slate-400 text-center block mb-3'>尚未选择任何扣除项</Text>
          )}
          <Motion
            tapScale={0.98}
            onClick={() => props.onApply(r.total)}
            className='w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs text-center'
          >
            ✓ 应用到年度汇算（{fmt(r.total)}）
          </Motion>
        </CardContent>
      </Card>
    </View>
  );
}

/* ───────────── Tab3 全年预演 ───────────── */
function ForecastTab(props: {
  result: ReturnType<typeof calcAnnualSettlementTax>;
  forecast: { projectedAnnualTax: number; projectedWithhold: number; projectedRefund: number; avgMonthlyTax: number };
  currentMonth: number; setCurrentMonth: (m: number) => void;
}) {
  const f = props.forecast;
  const isRefund = f.projectedRefund >= 0;
  return (
    <View className='space-y-3'>
      <Card>
        <CardContent className='p-4 space-y-2'>
          <Text className='text-xs font-bold text-slate-500 block'>当前进度</Text>
          <View>
            <Text className='text-[10px] font-bold text-slate-500 block mb-1'>已过月份（用于推算全年已扣）</Text>
            <View className='flex gap-1 flex-wrap'>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <Motion
                  key={m}
                  tapScale={0.95}
                  onClick={() => props.setCurrentMonth(m)}
                  className={`w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center ${props.currentMonth === m ? 'bg-indigo-600 text-white' : m <= props.currentMonth ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}
                >
                  {m}
                </Motion>
              ))}
            </View>
          </View>
        </CardContent>
      </Card>

      <Card className={`${isRefund ? 'border-emerald-200' : 'border-rose-200'}`}>
        <CardContent className={`p-5 text-center ${isRefund ? 'bg-emerald-50/50' : 'bg-rose-50/50'}`}>
          <Text className={`text-[11px] font-bold block mb-1 ${isRefund ? 'text-emerald-700' : 'text-rose-700'}`}>
            预计年底{isRefund ? '退税' : '补税'}
          </Text>
          <Text className={`text-3xl font-black font-mono block ${isRefund ? 'text-emerald-600' : 'text-rose-600'}`}>
            {fmtSigned(f.projectedRefund)}
          </Text>
          <Text className='text-[10px] text-slate-400 mt-1 block'>
            全年应纳{fmt(f.projectedAnnualTax)} vs 预计已扣{fmt(f.projectedWithhold)}
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardContent className='p-4 space-y-2'>
          <Text className='text-[10px] font-bold text-slate-500 block'>预测明细</Text>
          <Row label='全年应纳个税' value={f.projectedAnnualTax} bold />
          <Row label='月均个税' value={f.avgMonthlyTax} />
          <Row label='按当前进度预计全年已扣' value={f.projectedWithhold} />
        </CardContent>
      </Card>

      <View className='p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10px] text-indigo-900 leading-relaxed flex gap-1.5'>
        <Icon name='sparkles' size={13} className='shrink-0 mt-0.5' />
        <View>
          <Text className='font-bold block'>优化建议</Text>
          <Text className='block'>
            {isRefund
              ? '好消息！按当前节奏，年底可退税。记得在次年3-6月登录个税APP完成汇算，及时申请退税到账。'
              : '⚠️ 按当前节奏可能需补税。建议：①补填专项附加扣除（子女/房贷/赡养）；②个人养老金账户缴足1.2万；③若年终奖较高，试算"单独计税"是否更省。'}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ───────────── 通用小组件 ───────────── */
function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <View>
      <Text className='block text-[9px] font-bold text-slate-500 mb-1'>{label}</Text>
      <View className='flex items-center bg-slate-100 rounded-lg px-3 py-2'>
        <Text className='text-slate-400 mr-1 text-xs'>¥</Text>
        <Input type='digit' value={value} onInput={(e) => onChange(e.detail.value)} className='flex-1 bg-transparent text-sm font-mono font-bold text-slate-800' />
        {hint && <Text className='text-[9px] text-slate-400 ml-1 shrink-0'>{hint}</Text>}
      </View>
    </View>
  );
}

function NumStepper({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const n = parseInt(value) || 0;
  return (
    <View className='flex items-center justify-between'>
      <Text className='text-[10px] text-slate-500 font-semibold'>{label}</Text>
      <View className='flex items-center gap-2'>
        <Motion tapScale={0.9} onClick={() => onChange(Math.max(0, n - 1).toString())} className='w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 font-bold'>－</Motion>
        <Text className='text-sm font-black font-mono text-slate-800 w-5 text-center'>{n}</Text>
        <Motion tapScale={0.9} onClick={() => onChange((n + 1).toString())} className='w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold'>＋</Motion>
      </View>
    </View>
  );
}

function Row({ label, value, valueText, bold }: { label: string; value?: number; valueText?: string; bold?: boolean }) {
  return (
    <View className='flex justify-between items-center text-[11px]'>
      <Text className={bold ? 'text-slate-700 font-bold' : 'text-slate-400'}>{label}</Text>
      <Text className={`font-mono ${bold ? 'text-slate-800 font-bold' : 'text-slate-600'} ${value !== undefined && value < 0 ? 'text-rose-500' : ''}`}>
        {valueText ?? fmt(value || 0)}
      </Text>
    </View>
  );
}
