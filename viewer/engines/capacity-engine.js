// viewer/engines/capacity-engine.js
// ----------------------------------------------------
// Capacity Engine - 空容量（逆潮流）ロジック
// ----------------------------------------------------

import { emit } from "../bus.js";

export async function requestCapacity(siteId, location) {
  const capacity = await evaluateCapacity(location);
  emit("capacity/updated", { siteId, capacity });
}

export async function evaluateCapacity(location) {
  // TODO: 空容量マスタの JOIN + 最近傍変電所取得等
  return {
    overallDecision: "unknown",
    reverseCapacity: {},
    constraints: {}
  };
}
// 注意: このモジュールは純粋に空容量評価ロジックのみを担当する。
// ビジネスロジックや状態管理は他のレイヤーに任せる。