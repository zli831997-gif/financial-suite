import { isBrowser } from './platform';

/**
 * 备份文件 IO（跨端）。
 * - H5/Capacitor：用 Blob 下载 + <input type=file> 读取
 * - 小程序：用 Taro.saveFile / Taro.chooseFile（需小程序支持）
 *
 * 纯文本 JSON，不加密（本地工具，数据本身就在用户设备）。
 */

/** 下载/保存 JSON 文本为文件（H5 触发下载，小程序保存到本地）。 */
export async function saveBackupFile(filename: string, jsonText: string): Promise<boolean> {
  if (isBrowser) {
    try {
      const blob = new Blob([jsonText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }
  // 小程序：写文件到本地
  try {
    const Taro = await import('@tarojs/taro');
    const fs = Taro.getFileSystemManager?.();
    if (!fs) return false;
    const filePath = `${Taro.env.USER_DATA_PATH}/${filename}`;
    fs.writeFileSync(filePath, jsonText, 'utf8');
    await Taro.showModal({ title: '备份成功', content: `已保存到：${filePath}` });
    return true;
  } catch {
    return false;
  }
}

/**
 * 选取并读取备份文件内容。
 * @returns JSON 文本，或 null（取消/失败）
 */
export async function pickBackupFile(): Promise<string | null> {
  if (isBrowser) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };
      input.click();
    });
  }
  // 小程序：选择文件
  try {
    const Taro = await import('@tarojs/taro');
    const res = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['json'] });
    const filePath = res.tempFiles?.[0]?.path;
    if (!filePath) return null;
    const fs = Taro.getFileSystemManager?.();
    if (!fs) return null;
    return fs.readFileSync(filePath, 'utf8') as string;
  } catch {
    return null;
  }
}
