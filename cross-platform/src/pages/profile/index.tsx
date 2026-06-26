import { View, Text } from '@tarojs/components';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import type { FinanceAppState } from '@finance/utils/financeState';

/** 档案页：展示用户财务档案（简单版，后续迁移完整 ProfileView） */
export default function Profile() {
  const state = storage.get<FinanceAppState>(KEYS.APP_STATE);
  const p = state?.profile;
  return (
    <View className='min-h-screen bg-slate-50 p-4'>
      <View className='bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col gap-3'>
        <Text className='text-base font-black text-slate-900'>我的财务档案</Text>
        <View className='flex justify-between border-t border-slate-100 pt-3'>
          <Text className='text-xs text-slate-400'>所在城市</Text>
          <Text className='text-xs font-bold text-slate-900'>{p?.city || '未设置'}</Text>
        </View>
        <View className='flex justify-between'>
          <Text className='text-xs text-slate-400'>到手月薪</Text>
          <Text className='text-xs font-bold text-slate-900'>
            {p?.monthlyNetSalary ? `¥${p.monthlyNetSalary.toLocaleString()}` : '未设置'}
          </Text>
        </View>
        <View className='flex justify-between'>
          <Text className='text-xs text-slate-400'>年龄</Text>
          <Text className='text-xs font-bold text-slate-900'>{p?.age || '未设置'}</Text>
        </View>
        <Text className='text-[10px] text-slate-300 mt-2'>
          完整档案编辑功能迁移中。当前数据来自原工程本地存储。
        </Text>
      </View>
    </View>
  );
}
