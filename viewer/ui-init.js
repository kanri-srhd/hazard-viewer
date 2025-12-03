// ======================================================================
// ui-init.js - Google Maps風 UI コントロール + snapshot 表示
// ======================================================================
//
// [TODO (JP)]
// - Segment5: ハザード・空容量・農地評価のタブ/パネル分割（UI 整理）
// - Phase6 : 全国空容量モデルに合わせた凡例・ラベル更新
//
// [TODO (EN)]
// - Segment5: Split panels/tabs for hazard, capacity and farmland evaluations
// - Phase6 : Update legends/labels for nationwide capacity model
// ======================================================================

import { on } from "./bus.js";

/**
 * UI 初期化
 * Initialize UI controls and subscribe to unified snapshot updates.
 */
export function initUI(map) {
  const $ = (id) => document.getElementById(id);

  // 🔍 検索アイコン
  const searchIcon = $("search-icon");
  if (searchIcon) {
    const img = document.createElement("img");
    img.src = "./icons/search.svg";
    img.alt = "🔍";
    searchIcon.appendChild(img);
  }

  // ☰ メニュー
  const menuBtn = $("menu-toggle");
  if (menuBtn) {
    const img = document.createElement("img");
    img.src = "./icons/menu.svg";
    img.alt = "☰";
    menuBtn.appendChild(img);
  }

  // ＋ ズームイン
  const zoomInBtn = $("zoom-in");
  if (zoomInBtn) {
    const img = document.createElement("img");
    img.src = "./icons/zoom_in.svg";
    img.alt = "+";
    zoomInBtn.appendChild(img);
    zoomInBtn.addEventListener("click", () =>
      map.zoomIn({ duration: 300 })
    );
  }

  // − ズームアウト
  const zoomOutBtn = $("zoom-out");
  if (zoomOutBtn) {
    const img = document.createElement("img");
    img.src = "./icons/zoom_out.svg";
    img.alt = "−";
    zoomOutBtn.appendChild(img);
    zoomOutBtn.addEventListener("click", () =>
      map.zoomOut({ duration: 300 })
    );
  }

  // 📍 現在地（将来拡張用）
  const geolocateBtn = $("geolocate");
  if (geolocateBtn) {
    const img = document.createElement("img");
    img.src = "./icons/locate.svg";
    img.alt = "📍";
    geolocateBtn.appendChild(img);
    // TODO(JP/EN): 実際の現在地取得は Phase6 以降で実装
  }

  // 🗑 ピン削除（将来拡張用）
  const clearPinsBtn = $("clear-pins");
  if (clearPinsBtn) {
    const img = document.createElement("img");
    img.src = "./icons/trash.svg";
    img.alt = "🗑";
    clearPinsBtn.appendChild(img);
    // TODO(JP/EN): ピン管理ロジックが整備された際に連動処理を追加
  }

  // スケール表示（左下）
  const scale = new maplibregl.ScaleControl({
    maxWidth: 100,
    unit: "metric",
  });
  map.addControl(scale, "bottom-left");

  // UnifiedLayer からの snapshot-updated を表示
  const panel = $("info");
  if (panel) {
    on("unified/snapshot-updated", (snapshot) => {
      // TODO(JP): 将来的には見やすいUI（カード表示）に変更
      // TODO(EN): Replace this raw JSON view with a nicer UI (cards/tables)
      panel.innerText = JSON.stringify(snapshot, null, 2);
    });
  }
}

// ⚠ 禁止事項 / DO NOT:
// - Engines（hazard/capacity/parcel）を import しない
// - UnifiedLayer を直接呼び出さない
// - ビジネスロジック（判定ロジック）をここに書かない
// - IndexedDB や外部APIにアクセスしない
//   （Storage / Engines レイヤー経由で処理すること）