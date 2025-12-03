// ======================================================================
// hazard-engine.js - Hazard Engine（GSI WMTS → HazardSummary）
// ======================================================================
//
// [TODO (JP)]
// - Segment5: HazardTileRef の生成と簡易キャッシュ（同一地点の再評価抑制）
// - Phase6 : 内水/高潮/雪崩など追加レイヤーへの拡張
// - Phase6 : GSI 公式凡例に基づく depth / level → HazardLevel 変換
//
// [TODO (EN)]
// - Segment5: Generate HazardTileRef and simple cache per location
// - Phase6 : Support additional layers (inland flood, storm surge, snow avalanche)
// - Phase6 : Implement depth-to-HazardLevel mapping based on official legend
// ======================================================================

import { on, emit } from "../bus.js";

/**
 * HazardEngine 初期化：
 * - hazard/request を購読し、hazard/updated を返す
 *
 * Initialize HazardEngine:
 * - listen to "hazard/request" and emit "hazard/updated"
 */
export function initHazardEngine() {
  on("hazard/request", async ({ siteId, location }) => {
    const hazard = await evaluateHazard(location);
    emit("hazard/updated", { siteId, hazard });
  });
}

/**
 * ハザード評価（ダミー実装）
 * Evaluate hazard at given location (dummy implementation for now).
 *
 * @param {{lng:number, lat:number}} location
 * @returns {Promise<object>} HazardSummary-like object
 */
export async function evaluateHazard(location) {
  // TODO(JP): metadata_light.xml を元に WMTS タイルを取得し、洪水/土砂等を判定
  // TODO(EN): Fetch WMTS tiles using metadata_light.xml and derive category scores

  // TODO(JP): Segment5〜Phase6 で FloodHazard / LandslideHazard 等の型に合わせて返却
  // TODO(EN): Return FloodHazard / LandslideHazard compatible structure in later phases

  console.debug("[hazard-engine] evaluateHazard (stub)", location);

  return {
    overallDecision: "unknown", // "ok" | "caution" | "ng"
    categories: {
      // flood: { ... },
      // landslide: { ... },
      // tsunami: { ... },
      // liquefaction: { ... },
    },
    sourceTiles: [],
  };
}

// ⚠ 禁止事項 / DO NOT:
// - UI（DOM）を操作しないこと
// - IndexedDB を直接触らないこと（キャッシュは Storage レイヤー経由で）
// - UnifiedLayer を import して呼ばないこと
