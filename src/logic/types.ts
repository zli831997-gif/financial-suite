// domain 类型集中点。阶段1先从 financeState re-export 保持 import 路径稳定；
// 后续把 utils/financeState.ts 迁入 logic/ 时，只需改这一处。
export * from '../utils/financeState';
