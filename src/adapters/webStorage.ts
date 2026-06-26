import type { Storage } from '../storage/interface';

/** web 端存储实现，底层用 localStorage。set 统一 JSON 序列化，get 反序列化。 */
export function createWebStorage(): Storage {
  return {
    get<T>(key: string): T | null {
      const raw = localStorage.getItem(key);
      if (raw == null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        // 非 JSON 裸值（如 vision img 的 base64 dataURL）原样返回，兼容旧数据
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
