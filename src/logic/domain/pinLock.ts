import { storage } from '../../storage';
import { KEYS } from '../../storage/keys';

/**
 * 应用锁 PIN — 移植自老版 util.js（平台无关，djb2+盐 hash）。
 * 仅防"瞄一眼"，非加密级（数据本就本地）。PIN 不随数据导出。
 */

export interface PinState {
  hash: string;
  salt: string;
}

export function makeSalt(): string {
  return Math.floor(Math.random() * 1e9).toString(36);
}

/** djb2 哈希 + 盐：h=5381，h=((h<<5)+h+charCode)>>>0，返回 hex */
export function hashPin(pin: string, salt: string): string {
  let h = 5381;
  const s = String(pin) + salt;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

export function hasPin(): boolean {
  const p = storage.get<PinState>(KEYS.PIN);
  return !!(p && p.hash);
}

export function setPin(pin: string): void {
  const salt = makeSalt();
  storage.set(KEYS.PIN, { hash: hashPin(pin, salt), salt });
}

export function verifyPin(pin: string): boolean {
  const p = storage.get<PinState>(KEYS.PIN);
  return !!(p && p.salt && hashPin(pin, p.salt) === p.hash);
}

export function clearPin(): void {
  storage.remove(KEYS.PIN);
}
