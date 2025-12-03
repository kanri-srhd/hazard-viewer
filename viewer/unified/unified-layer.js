// viewer/unified/unified-layer.js
// ----------------------------------------------------
// Unified Data Layer
// Parcel / Hazard / Capacity の結果を統合し
// snapshot-updated を発火する唯一のレイヤー
// ----------------------------------------------------

import { on, emit } from "../bus.js";
import { loadParcel } from "../engines/parcel-loader.js";
import { evaluateHazard } from "../engines/hazard-engine.js";
import { evaluateCapacity } from "../engines/capacity-engine.js";
import { saveSnapshot, loadSnapshotFromCache } from "../storage/indexeddb.js";

let current = {
  parcel: null,
  hazard: null,
  capacity: null
};

export function initUnifiedLayer() {
  // parcel/select 発火 → parcel loader
  on("parcel/select", async ({ siteId, location }) => {
    const cached = await loadSnapshotFromCache(siteId);
    if (cached) {
      emit("unified/snapshot-updated", cached);
    }
    const parcel = await loadParcel(siteId, location);
    current.parcel = parcel;
    emit("parcel/loaded", { siteId, parcel });
  });

  // hazard/updated
  on("hazard/updated", ({ siteId, hazard }) => {
    current.hazard = hazard;
    tryEmitSnapshot(siteId);
  });

  // capacity/updated
  on("capacity/updated", ({ siteId, capacity }) => {
    current.capacity = capacity;
    tryEmitSnapshot(siteId);
  });
}

function tryEmitSnapshot(siteId) {
  if (!current.parcel || !current.hazard || !current.capacity) return;

  const snapshot = {
    siteId,
    parcel: current.parcel,
    hazard: current.hazard,
    capacity: current.capacity,
    meta: {
      generatedAt: new Date().toISOString(),
      version: "unified-layer-v1.0.0"
    }
  };

  // UI通知 & キャッシュ保存
  emit("unified/snapshot-updated", snapshot);
  saveSnapshot(siteId, snapshot);

  // 初期化
  current.parcel = null;
  current.hazard = null;
  current.capacity = null;
}
// 注意: このレイヤーは純粋にデータの統合とイベント発火のみを担当する。
// ビジネスロジックや状態管理は他のレイヤーに任せる。