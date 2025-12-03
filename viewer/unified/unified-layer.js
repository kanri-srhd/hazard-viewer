// ======================================================================
// unified-layer.js - Unified Data Layer
// ======================================================================
//
// [TODO (JP)]
// - Segment5: 地番・農地の正規化（siteId の生成ルールを統一）
// - Phase6 : 空容量の全国統一モデル対応（utility ごとのスキーマ差異吸収）
// - Phase7 : PMTiles 地番との高速 JOIN（タイルレベルキャッシュ）
// - 将来   : Snapshot バージョン管理（過去評価との比較）
//
// [TODO (EN)]
// - Segment5: Normalize parcel / farmland keys (unified siteId scheme)
// - Phase6 : Support nationwide capacity schema (per-utility differences)
// - Phase7 : Optimize PMTiles parcel JOIN (tile-level caching)
// - Future : Add snapshot versioning for historical comparison
// ======================================================================

import { on, emit } from "../bus.js";
import { loadParcel } from "../engines/parcel-loader.js";
import { initHazardEngine } from "../engines/hazard-engine.js";
import { initCapacityEngine } from "../engines/capacity-engine.js";
import {
  saveSnapshot,
  loadSnapshotFromCache,
} from "../storage/indexeddb.js";

// 現在の評価対象を一時的に保持（サイトごと）
// Temporary in-memory store per siteId
const current = new Map();

/**
 * UnifiedLayer の初期化
 * Initialize Unified Data Layer: subscribe to events and start engines.
 */
export function initUnifiedLayer() {
  // TODO(JP/EN): Segment4 完了時点ではイベント配線のみ。中身は今後フェーズで拡張。
  // TODO: For now we only wire events; logic is kept minimal and extended in later phases.

  // Engines 側のイベント購読を初期化
  // Initialize engines which will subscribe to hazard/request & capacity/request
  initHazardEngine();
  initCapacityEngine();

  // parcel/select: UI からの起点イベント
  // User clicked on map / parcel -> start unified evaluation
  on("parcel/select", async ({ siteId, location }) => {
    // 1. キャッシュ済みスナップショットの即時表示（あれば）
    // 1. Show cached snapshot immediately if exists
    const cached = await loadSnapshotFromCache(siteId);
    if (cached) {
      emit("unified/snapshot-updated", cached);
    }

    // 2. Parcel 情報の取得（同期 or 非同期）
    // 2. Load parcel info for this siteId
    const parcel = await loadParcel(siteId, location);
    updateCurrent(siteId, { parcel });

    // Bus 経由で parcel/loaded を通知（必要に応じて他レイヤーが参照できるように）
    // Notify parcel loaded to other listeners if needed
    emit("parcel/loaded", { siteId, parcel });

    // 3. ハザード・空容量エンジンへリクエスト
    // 3. Request hazard & capacity evaluation via EventBus
    emit("hazard/request", { siteId, location });
    emit("capacity/request", { siteId, location });
  });

  // hazard/updated: HazardEngine からの結果受信
  on("hazard/updated", ({ siteId, hazard }) => {
    updateCurrent(siteId, { hazard });
    tryEmitSnapshot(siteId);
  });

  // capacity/updated: CapacityEngine からの結果受信
  on("capacity/updated", ({ siteId, capacity }) => {
    updateCurrent(siteId, { capacity });
    tryEmitSnapshot(siteId);
  });
}

/**
 * current マップを siteId 単位で更新
 * Update partial result for the siteId.
 */
function updateCurrent(siteId, partial) {
  const prev = current.get(siteId) || {};
  const next = { ...prev, ...partial };
  current.set(siteId, next);
}

/**
 * Parcel / Hazard / Capacity が揃っていれば UnifiedSiteSnapshot を発行
 * Emit UnifiedSiteSnapshot when all components are ready.
 */
function tryEmitSnapshot(siteId) {
  const state = current.get(siteId);
  if (!state) return;
  const { parcel, hazard, capacity } = state;
  if (!parcel || !hazard || !capacity) return;

  // TODO(JP): meta に dataDate（hazard/capacity の元データ日付）を載せる（Phase6）
  // TODO(EN): Add dataDate fields (hazard/capacity source dates) in Phase6
  const snapshot = {
    siteId,
    parcel,
    hazard,
    capacity,
    meta: {
      generatedAt: new Date().toISOString(),
      version: "unified-layer-v1.0.0",
    },
  };

  emit("unified/snapshot-updated", snapshot);
  saveSnapshot(siteId, snapshot);

  // 一旦 state をクリア（必要に応じて LRU 方式に変更可）
  // Clear current state; can be replaced with LRU in future.
  current.delete(siteId);
}

// ⚠ 禁止事項 / DO NOT:
// - このファイルで UI（DOM）を操作しないこと
// - GSI / 空容量 / PMTiles など外部ソースを直接 fetch しないこと
// - Engines のロジックをここに書かないこと（判定ロジックは Engines 側へ）
