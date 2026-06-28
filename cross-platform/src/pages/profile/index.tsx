import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { storage } from '@finance/storage';
import { KEYS } from '@finance/storage/keys';
import type { FinanceAppState } from '@finance/utils/financeState';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';

/** 档案页：展示用户财务档案 + 数据管理入口 */
export default function Profile() {
  const state = storage.get<FinanceAppState>(KEYS.APP_STATE);
  const p = state?.profile;
  return (
    <View className='min-h-screen bg-slate-50 p-4 space-y-4'>
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

      {/* 数据管理入口 */}
      <View className='bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-2'>
        <Text className='text-xs font-bold text-slate-500 block'>数据管理</Text>
        <Motion
          tapScale={0.98}
          onClick={() => Taro.navigateTo({ url: '/pages/backup/index' })}
          className='flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl'
        >
          <View className='w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0'>
            <Icon name='shield' size={18} className='text-indigo-600' />
          </View>
          <View className='flex-1'>
            <Text className='text-sm font-bold text-slate-800 block'>数据备份与恢复</Text>
            <Text className='text-[10px] text-slate-400 block'>换手机/重装前先备份，防数据丢失</Text>
          </View>
          <Icon name='chevronRight' size={14} className='text-slate-300' />
        </Motion>
        <Motion
          tapScale={0.98}
          onClick={() => Taro.navigateTo({ url: '/pages/fire/index' })}
          className='flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl'
        >
          <View className='w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0'>
            <Icon name='sparkles' size={18} className='text-emerald-600' />
          </View>
          <View className='flex-1'>
            <Text className='text-sm font-bold text-slate-800 block'>FIRE 财务自由测算</Text>
            <Text className='text-[10px] text-slate-400 block'>什么时候能靠被动收入生活</Text>
          </View>
          <Icon name='chevronRight' size={14} className='text-slate-300' />
        </Motion>
      </View>
    </View>
  );
}
