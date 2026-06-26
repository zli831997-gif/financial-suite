import { createWebStorage } from '../adapters/webStorage';

// web 端绑定 localStorage；将来转微信小程序时，在这里切换到 miniappStorage 实现
export const storage = createWebStorage();
export type { Storage } from './interface';
