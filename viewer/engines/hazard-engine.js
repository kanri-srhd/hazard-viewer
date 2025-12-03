// viewer/engines/hazard-engine.js
// ----------------------------------------------------
// Hazard Engine - GSI WMTS からハザード判定を行う
// ----------------------------------------------------

import { emit } from "../bus.js";

export async function requestHazard(siteId, location) {
  // UDL から hazard/request を受けて呼ばれる形になる想定
  const hazard = await evaluateHazard(location);
  emit("hazard/updated", { siteId, hazard });
}

export async function evaluateHazard(location) {
  // TODO: GSI WMTS → タイル値 → HazardSummary に変換
  return {
    overallDecision: "unknown",
    categories: {}
  };
}
// 注意: このモジュールは純粋にハザード評価ロジックのみを担当する。
// ビジネスロジックや状態管理は他のレイヤーに任せる。