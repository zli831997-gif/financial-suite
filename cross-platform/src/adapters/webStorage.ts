import type { Storage } from '@finance/storage/interface';

/**
 * H5/Capacitor 存储适配器（复用接口，子工程自洽版本）。
 * 行为与上游 src/adapters/webStorage.ts 完全一致。
 */
export function createWebStorage(): Storage {
  return {
    get<T>(key: string): T | null {
      const raw = localStorage.getItem(key);
      if (raw == null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    },
    set(key: string, value: unknown): void {
      localStorage.setItem(key, JSON.stringify(value));
    },
    remove(key: string): void {
      localStorage.removeItem(key);
    },
    has(key: string): boolean {
      return localStorage.getItem(key) != null;
    },
  };
}
