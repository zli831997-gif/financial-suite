/** 平台无关存储接口。logic/domain 层只许通过此接口读写，禁止直接调 localStorage / wx.*。 */
export interface Storage {
  get<T>(key: string): T | null;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  has(key: string): boolean;
}
