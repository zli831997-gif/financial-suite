import { useState, useCallback } from 'react';
import type { Transaction } from '../types';
import { ensureAccounts, getAccounts, type Account } from '../logic/domain/accounts';
import {
  ensureRecords,
  getRecords,
  addRecord as domainAddRecord,
  deleteRecord as domainDeleteRecord,
  updateRecord as domainUpdateRecord,
} from '../logic/domain/records';
import {
  ensureTemplates,
  updateTemplate as domainUpdateTemplate,
  type Template,
} from '../logic/domain/templates';

/**
 * 记账桥接 hook：把平台无关 domain 层接进 React。
 * 持有 records/accounts/templates 的 React state，domain 操作后刷新，保持与 storage 一致。
 */
export function useBookkeeping() {
  const [records, setRecords] = useState<Transaction[]>(() => ensureRecords());
  const [accounts, setAccounts] = useState<Account[]>(() => ensureAccounts());
  const [templates, setTemplates] = useState<Template[]>(() => ensureTemplates());

  const addRecord = useCallback((record: Transaction) => {
    const updated = domainAddRecord(record); // 内部改 fin_records + fin_accounts
    setRecords(updated);
    setAccounts(getAccounts()); // 账户余额变了，同步刷新
  }, []);

  const deleteRecord = useCallback((id: string) => {
    const updated = domainDeleteRecord(id);
    setRecords(updated);
    setAccounts(getAccounts());
  }, []);

  const updateRecord = useCallback((id: string, updates: Partial<Transaction>) => {
    setRecords(domainUpdateRecord(id, updates));
  }, []);

  const onToggleTemplate = useCallback((id: string, enabled: boolean) => {
    setTemplates(domainUpdateTemplate(id, { enabled }));
  }, []);

  const onUpdateTemplate = useCallback((id: string, updates: Partial<Template>) => {
    setTemplates(domainUpdateTemplate(id, updates));
  }, []);

  return { records, accounts, templates, addRecord, deleteRecord, updateRecord, onToggleTemplate, onUpdateTemplate };
}
