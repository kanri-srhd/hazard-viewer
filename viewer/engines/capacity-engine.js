// ======================================================================
// capacity-engine.js - Capacity Engine（空容量ロジック）
// ======================================================================
//
// [TODO (JP)]
// - Segment5: siteId / location から最寄り変電所・線路を特定（OSM 等との JOIN）
// - Phase6 : 全国空容量スキーマの統一（utility ごとの PDF/CSV 差異を吸収）
// - Phase6 : N-1 電制・上位系統考慮（upstream constrained capacity）の実装
// - Phase7〜: 変電所の電圧階級（EHV/HV/LV）を評価に組み込む
//
// [TODO (EN)]
// - Segment5: Resolve nearest substation/feeder from siteId/location (OSM join)
// - Phase6 : Normalize capacity schema across utilities (nationwide model)
// - Phase6 : Implement N-1 / upstream constrained capacity computation
// - Phase7+: Incorporate voltage class (EHV/HV/LV) into evaluation
// ======================================================================

import { on, emit } from "../bus.js";

/**
 * CapacityEngine 初期化：
 * - capacity/request を購読し、capacity/updated を返す
 *
 * Initialize CapacityEngine:
 * - listen to "capacity/request" and emit "capacity/updated"
 */
export function initCapacityEngine() {
  on("capacity/request", async ({ siteId, location }) => {
    const capacity = await evaluateCapacity(location);
    emit("capacity/updated", { siteId, capacity });
  });
}

/**
 * 空容量評価（ダミー実装）
 * Evaluate capacity for a given location (dummy/stub implementation).
 *
 * @param {{lng:number, lat:number}} location
 * @returns {Promise<object>} CapacitySummary-like object
 */
export async function evaluateCapacity(location) {
  // TODO(JP): 空容量マスタJSON（TEPCO等）を取り込み、地点から最寄り系統を特定
  // TODO(EN): Load capacity master JSON and resolve nearest grid point

  // TODO(JP): 逆潮流空容量 / N-1 / 上位系統考慮を CapacitySummary にマッピング
  // TODO(EN): Map reverseCapacity / nMinus1 / upstreamConstrainedKw to CapacitySummary

  console.debug("[capacity-engine] evaluateCapacity (stub)", location);

  return {
    overallDecision: "unknown", // "ok" | "caution" | "ng"
    gridPoint: {
      substationName: "TBD",
      feederName: "TBD",
      voltageClass: "HV",
      distanceKm: null,
    },
    reverseCapacity: {
      availableKw: null,
      upstreamConstrainedKw: null,
      nMinus1Kw: null,
    },
    forwardCapacity: {
      maxDemandKw: null,
    },
    constraints: {
      hasNormalCurtailmentRisk: null,
      isUnderBulkStudy: null,
      isReinforcementPlanned: null,
      remarks: [],
    },
    source: {
      utility: "UNKNOWN",
      sourceDate: null,
    },
  };
}

// ⚠ 禁止事項 / DO NOT:
// - DOM / UI を操作しないこと
// - IndexedDB を直接操作しないこと（キャッシュは Storage 経由）
// - UnifiedLayer を import しないこと
