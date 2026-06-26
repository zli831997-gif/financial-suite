import { useState, useEffect, useCallback } from 'react';
import { hasPin, verifyPin } from '../logic/domain/pinLock';

/**
 * 应用锁 hook：设了 PIN 则锁定，回前台（visibilitychange）重新锁。
 * 返回 { locked, unlock }。
 */
export function usePinLock() {
  const [locked, setLocked] = useState<boolean>(() => hasPin());

  useEffect(() => {
    const onVis = () => {
      // 从隐藏切回可见（切 tab/最小化回前台）且设了 PIN → 重新锁
      if (document.visibilityState === 'visible' && hasPin()) {
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const unlock = useCallback((pin: string): boolean => {
    if (verifyPin(pin)) {
      setLocked(false);
      return true;
    }
    return false;
  }, []);

  return { locked, unlock };
}
