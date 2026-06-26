export enum ModuleType {
  DASHBOARD = 'dashboard',
  ACCOUNTING = 'accounting',
  PROFILE = 'profile',
  REPORTS = 'reports',
  LOAN = 'loan',
  TAX = 'tax',
  INSURANCE = 'insurance',
  PENSION = 'pension',
  ANNUITY = 'annuity',
  ASSETS = 'assets',
  STOCKS = 'stocks',
  DEPOSITS = 'deposits',
  CHAT = 'chat',
  VISION = 'vision',
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;        // = 老版 categoryName
  categoryId?: string;     // 分类ID（后续分类体系用）
  accountId?: string;      // 关联账户ID
  accountName?: string;    // 关联账户名
  date: string;            // YYYY-MM-DD
  time?: string;           // HH:mm
  note: string;
  important?: boolean;
  entityId?: string;       // 关联资产（房产/车），后续阶段用
  /** 记录来源：手动 / 固定账单自动 / 通知监听自动（仅安卓） */
  source?: 'manual' | 'template' | 'notification';
  /** 去重键（通知自动记账用：packageName+postTime+text 的哈希），跨重启幂等 */
  dedupeKey?: string;
}

export interface Asset {
  id: string;
  category: string;
  name: string;
  value: number;
}

export interface Stock {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
}
