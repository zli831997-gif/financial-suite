// 存储键集中管理。现保留 finance_hub_ 前缀，仅做集中收敛；
// 阶段2-4 逐领域迁移时，再对齐到注释中的老版 fin_ 目标（配合老数据导入）。
export const KEYS = {
  RECORDS: 'fin_records', // 记账记录（阶段2 对齐老版）
  ACCOUNTS: 'fin_accounts', // 账户体系（阶段2 新增）
  GROWTH: 'fin_growth', // 游戏化（阶段2b 对齐老版）
  TEMPLATES: 'fin_templates', // 自动记账模板（阶段2c 对齐老版）
  AUTO_LOG: 'fin_auto_log', // 自动记账执行日志（防重复，保留30天）
  REMINDERS: 'fin_reminders', // 账单提醒（阶段4 对齐老版）
  PIN: 'fin_pin', // 应用锁（阶段6 对齐老版，djb2+盐 hash，不随导出）
  ASSETS: 'fin_assets', // 资产（转小程序铺路，financeState 双写镜像）
  LOANS: 'fin_loans', // 借贷（借款/还款追踪）
  SOCIALS: 'fin_socials', // 人情往来（红白喜事/送礼）
  NOTIF_LOG: 'fin_notif_log', // 通知自动记账去重日志（防重复，保留30天）
  TRANSACTIONS: 'finance_hub_transactions_v2', // 旧 key，仅供一次性迁移读，迁移后停用
  APP_STATE: 'finance_hub_app_state_v2', // → 拆解为 fin_assets / fin_user_profile / fin_growth (阶段2-4)
  STOCKS: 'finance_hub_stocks_v4', // → fin_portfolio (阶段4)
  VISION_IMG: 'finance_hub_profile_vision_img', // 新版独有，保留
  COMPLETENESS_DISMISSED: 'finance_completeness_dismissed',
  REPAYMENT_REMINDER_DISMISSED: 'finance_repayment_reminder_dismissed',
} as const;
