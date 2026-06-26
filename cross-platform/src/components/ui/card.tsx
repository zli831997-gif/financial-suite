import { View, Text } from '@tarojs/components';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

// 上游 ui/card 的跨端版：div→View，h3→Text。
// forwardRef 在小程序端无意义，去掉。
// className 全部保留（Tailwind 跨端生效）。

interface DivProps {
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
}

export function Card({ className, children, onClick }: DivProps) {
  return (
    <View
      onClick={onClick}
      className={cn('bg-white rounded-3xl border border-slate-100 shadow-sm', className)}
    >
      {children}
    </View>
  );
}

export function CardHeader({ className, children }: DivProps) {
  return <View className={cn('flex flex-col space-y-1.5 p-6', className)}>{children}</View>;
}

export function CardTitle({ className, children }: DivProps) {
  return (
    <Text className={cn('font-semibold leading-none tracking-tight', className)}>{children}</Text>
  );
}

export function CardContent({ className, children }: DivProps) {
  return <View className={cn('p-6 pt-0', className)}>{children}</View>;
}
