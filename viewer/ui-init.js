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

// ======================================================
// OSM 電力レイヤー用トグル UI 初期化
// ======================================================

/**
 * @param {Object} powerController initPowerLayers(map) の戻り値
 */
export function initPowerLayerToggles(powerController) {
  if (!powerController) return;

  const container =
    document.getElementById("layer-list") ||
    document.getElementById("layer-panel") ||
    document.body;

  const group = document.createElement("div");
  group.className = "layer-group power-layer-group";

  const title = document.createElement("div");
  title.className = "layer-group-title";
  title.textContent = "送電線・変電所（OSM）";

  const list = document.createElement("div");
  list.className = "layer-group-body";

  const configs = [
    { key: "line_500kv", label: "送電線 500kV" },
    { key: "line_275kv", label: "送電線 275kV" },
    { key: "line_154kv", label: "送電線 154kV" },
    { key: "line_other", label: "送電線 一般（その他）" },
    { key: "substations", label: "変電所（OSM）" },
  ];

  configs.forEach((cfg) => {
    const row = document.createElement("label");
    row.className = "layer-toggle-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "layer-toggle-input";
    input.dataset.layerKey = cfg.key;

    const span = document.createElement("span");
    span.className = "layer-toggle-label";
    span.textContent = cfg.label;

    row.appendChild(input);
    row.appendChild(span);
    list.appendChild(row);

    input.addEventListener("change", () => {
      powerController.setVisibility(cfg.key, input.checked);
    });
  });

  group.appendChild(title);
  group.appendChild(list);
  container.appendChild(group);
}

/* ============================================================
   電力レイヤー凡例パネル UI（右側フロート）
   ============================================================ */

// 凡例パネル生成
function createPowerLegendPanel() {
  const panel = document.createElement("div");
  panel.id = "power-legend-panel";
  panel.style.display = "none"; // 初期非表示
  panel.innerHTML = `
    <div class="power-legend-header">
      <span id="power-legend-title">送電線凡例</span>
      <button id="power-legend-close">×</button>
    </div>

    <div class="power-legend-body">
      <div id="power-legend-content"></div>

      <div class="legend-opacity-block">
        <label for="power-opacity-slider">透過率：</label>
        <input type="range" id="power-opacity-slider" min="10" max="100" value="90">
        <span id="power-opacity-value">90%</span>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
}

// アイコン（i）クリックによるパネル開閉
function attachPowerLegendHandlers(powerController) {
  const items = document.querySelectorAll(".power-layer-info-btn");
  items.forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type; // "kikan" or "ippan" or "substation"
      showPowerLegend(type, powerController);
    });
  });

  document.getElementById("power-legend-close").addEventListener("click", () => {
    document.getElementById("power-legend-panel").style.display = "none";
  });

  // 透過率変更
  document.getElementById("power-opacity-slider").addEventListener("input", e => {
    const val = Number(e.target.value) / 100;
    document.getElementById("power-opacity-value").innerText = `${e.target.value}%`;
    window.updatePowerOpacity(val);
  });
}

// 凡例内容をタイプごとに出し分け
function showPowerLegend(type, powerController) {
  const panel = document.getElementById("power-legend-panel");
  const content = document.getElementById("power-legend-content");
  const title = document.getElementById("power-legend-title");

  if (type === "kikan") {
    title.innerText = "送電線 基幹（凡例）";
    content.innerHTML = `
      <div class="legend-line"><span class="legend-color" style="background:#b30000"></span> 500kV（濃赤）</div>
      <div class="legend-line"><span class="legend-color" style="background:#ff6a00"></span> 275kV（濃橙）</div>
      <hr>
      <p>基幹送電線（500kV + 275kV）。大規模電源間を結ぶ幹線。</p>
    `;
  }

  if (type === "ippan") {
    title.innerText = "送電線 一般（凡例）";
    content.innerHTML = `
      <div class="legend-line"><span class="legend-color" style="background:#d4c600"></span> 154kV（濃黄）</div>
      <div class="legend-line"><span class="legend-color" style="background:#666666"></span> その他（灰色）</div>
      <hr>
      <p>一般送電線（154kV以下）。地域内配電・系統接続用途。</p>
    `;
  }

  if (type === "substation") {
    title.innerText = "変電所（凡例）";
    content.innerHTML = `
      <div class="legend-line">
        <span class="legend-color" style="background:#00bcd4;border:2px solid #fff"></span>
        変電所（OSM/OIM）
      </div>
      <hr>
      <p>主要変電所（円の大きさはzoom依存）。</p>
    `;
  }

  panel.style.display = "block";
}

// 初期化呼び出し（main.jsから渡された powerController を使用）
export function initPowerLegendUI(powerController) {
  createPowerLegendPanel();
  attachPowerLegendHandlers(powerController);
}

// ⚠ 禁止事項 / DO NOT:
// - Engines（hazard/capacity/parcel）を import しない
// - UnifiedLayer を直接呼び出さない
// - ビジネスロジック（判定ロジック）をここに書かない
// - IndexedDB や外部APIにアクセスしない
//   （Storage / Engines レイヤー経由で処理すること）