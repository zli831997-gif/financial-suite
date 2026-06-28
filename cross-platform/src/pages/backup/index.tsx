import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { exportBackup, importBackup, backupFileName, validateBackup } from '@finance/logic/domain/backup';
import { saveBackupFile, pickBackupFile } from '../../utils/backupIO';
import { alertAsync, confirmAsync } from '../../utils/platform';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import './index.css';

/**
 * 数据备份/恢复页。
 * 防止换手机、重装、清缓存导致数据丢失。
 * 导出：所有用户数据 → JSON 文件（下载到本地/保存到手机）。
 * 导入：选 JSON 文件 → 校验 → 覆盖恢复。
 */
export default function Backup() {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const backup = exportBackup();
      const json = JSON.stringify(backup, null, 2);
      const ok = await saveBackupFile(backupFileName(), json);
      await alertAsync(
        ok
          ? `✅ 备份成功！\n文件名：${backupFileName()}\n含 ${Object.keys(backup.data).length} 类数据。\n请妥善保管此文件（建议存到网盘或发给自己）。`
          : '备份失败，请重试',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    try {
      const text = await pickBackupFile();
      if (!text) {
        await alertAsync('未选择文件');
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        await alertAsync('文件不是有效的 JSON');
        return;
      }
      const err = validateBackup(parsed);
      if (err) {
        await alertAsync('文件校验失败：' + err);
        return;
      }
      // 二次确认（导入会覆盖现有数据）
      const ok = await confirmAsync(
        '⚠️ 导入将覆盖当前所有数据，且不可撤销。\n建议先导出当前数据做备份。\n\n确认导入吗？',
      );
      if (!ok) return;
      const result = importBackup(parsed);
      if ('error' in result) {
        await alertAsync('导入失败：' + result.error);
        return;
      }
      await alertAsync(`✅ 恢复成功！\n已恢复 ${result.restored} 类数据。\n重启 APP 后生效。`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className='p-4 space-y-4 max-w-md mx-auto w-full min-h-screen bg-slate-50 pb-6'>
      <View className='pb-1 border-b border-slate-100'>
        <Text className='text-base font-black text-slate-900 flex items-center gap-1.5'>
          <Icon name='shield' size={18} className='text-indigo-600' /> 数据备份与恢复
        </Text>
        <Text className='text-[10px] text-slate-400 block'>换手机、重装 APP 前请先备份，避免数据丢失</Text>
      </View>

      {/* 为什么备份 */}
      <Card className='border-amber-200'>
        <CardContent className='p-4 bg-amber-50/40 flex gap-2'>
          <Icon name='info' size={16} className='text-amber-600 shrink-0 mt-0.5' />
          <View>
            <Text className='text-xs font-bold text-amber-900 block'>为什么要备份？</Text>
            <Text className='text-[10px] text-amber-800 leading-relaxed block'>
              你的所有数据都存在本机。换手机、卸载 APP、清理缓存都会导致数据丢失。
              备份文件是 JSON 格式，可存到网盘或发给自己，随时能恢复。
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* 导出 */}
      <Card>
        <CardContent className='p-4 space-y-3'>
          <View>
            <Text className='text-sm font-bold text-slate-800 block'>📤 导出备份</Text>
            <Text className='text-[10px] text-slate-400 block mt-0.5'>
              把所有记账、资产、档案数据打包成一个文件
            </Text>
          </View>
          <Motion
            tapScale={0.98}
            onClick={busy ? undefined : handleExport}
            className={`w-full py-3 rounded-xl text-sm font-bold text-center text-white ${busy ? 'bg-slate-300' : 'bg-indigo-600'}`}
          >
            {busy ? '处理中...' : '导出备份文件'}
          </Motion>
        </CardContent>
      </Card>

      {/* 导入 */}
      <Card>
        <CardContent className='p-4 space-y-3'>
          <View>
            <Text className='text-sm font-bold text-slate-800 block'>📥 导入恢复</Text>
            <Text className='text-[10px] text-slate-400 block mt-0.5'>
              从备份文件恢复数据（会覆盖当前数据）
            </Text>
          </View>
          <Motion
            tapScale={0.98}
            onClick={busy ? undefined : handleImport}
            className={`w-full py-3 rounded-xl text-sm font-bold text-center ${busy ? 'bg-slate-300 text-slate-400' : 'bg-white text-slate-700 border border-slate-200'}`}
          >
            {busy ? '处理中...' : '选择备份文件恢复'}
          </Motion>
        </CardContent>
      </Card>

      <View className='p-3 bg-slate-100 rounded-xl text-[10px] text-slate-400 leading-relaxed'>
        <Text className='font-bold text-slate-500 block mb-1'>备份包含的数据</Text>
        <Text className='block'>
          · 个人财务档案（薪资/社保/房产/车辆）{'\n'}
          · 全部记账明细与账户余额{'\n'}
          · 固定账单模板{'\n'}
          · 股票/基金持仓{'\n'}
          · 储蓄/理财/加密资产{'\n'}
          · 借贷与人情往来记录
        </Text>
      </View>
    </View>
  );
}
