import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// 与上游 src/lib/utils.ts 一致，供迁移过来的组件（如 ui/card）使用。
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
