import Taro from '@tarojs/taro';
import type { Storage } from '@finance/storage/interface';

/**
 * 微信小程序存储适配器：底层用 wx.*StorageSync（经 Taro 封装）。
 * 实现上游 src/storage/interface.ts 定义的 Storage 接口，逻辑层零改动复用。
 * set 统一 JSON 序列化，get 反序列化，与 webStorage 行为一致。
 */
export function createMiniappStorage(): Storage {
  return {
    get<T>(key: string): T | null {
      const raw = Taro.getStorageSync(key);
      if (raw === '' || raw == null) return null;
      if (typeof raw !== 'string') {
        // Taro 已自动反序列化对象，直接返回
        return raw as T;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        // 非 JSON 裸值（如 base64 dataURL）原样返回，兼容旧数据
        return raw as unknown as T;
      }
    },
    set(key: string, value: unknown): void {
      Taro.setStorageSync(key, JSON.stringify(value));
    },
    remove(key: string): void {
      Taro.removeStorageSync(key);
    },
    has(key: string): boolean {
      const info = Taro.getStorageInfoSync();
      return (info.keys || []).includes(key);
    },
  };
}
