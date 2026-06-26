import { useState, useCallback } from 'react';
import type { FinanceAppState } from '../utils/financeState';
import type { Transaction } from '../types';
import {
  ensureGrowth,
  getGrowth,
  onRecordCreated,
  manualCheckin as domainManualCheckin,
  redeemMakeupCard as domainRedeem,
  awardBonus as domainAwardBonus,
  type GrowthState,
  type GamificationEvents,
  type ExternalCtx,
} from '../logic/domain/gamification';
import { getRecords } from '../logic/domain/records';
import { getAccountsNetBalance } from '../logic/domain/accounts';
import { calcNetAssets } from '../logic/calc/netAssets';

/**
 * 游戏化 React 桥接。持有 growth state，算 ctx（net/recordCount/liabilities），调 domain 后刷新。
 * 接受 financeState 用于算净资产（徽章判定用）。
 */
export function useGamification(financeState: FinanceAppState) {
  const [growth, setGrowth] = useState<GrowthState>(() => ensureGrowth());

  const computeCtx = useCallback((): ExternalCtx => {
    const r = calcNetAssets(financeState, getAccountsNetBalance());
    return {
      recordCount: getRecords().length,
      net: r.net,
      // 总负债口径：房贷 + 车贷 + 其他负债（debt_free 徽章用）
      liabilities: r.parts.propertyLoan + r.parts.carLoan + r.parts.otherLiabilities,
    };
  }, [financeState]);

  const onRecord = useCallback((record: Transaction): GamificationEvents => {
    const events = onRecordCreated(record, computeCtx());
    setGrowth(getGrowth());
    return events;
  }, [computeCtx]);

  const manualCheckin = useCallback((): GamificationEvents => {
    const events = domainManualCheckin(computeCtx());
    setGrowth(getGrowth());
    return events;
  }, [computeCtx]);

  const redeemMakeupCard = useCallback((date: string): { ok: boolean; msg: string } => {
    const res = domainRedeem(date);
    setGrowth(getGrowth());
    return res;
  }, []);

  const awardBonus = useCallback((reason: string, points: number): GamificationEvents => {
    const events = domainAwardBonus(reason, points, computeCtx());
    setGrowth(getGrowth());
    return events;
  }, [computeCtx]);

  return { growth, onRecord, manualCheckin, redeemMakeupCard, awardBonus };
}
