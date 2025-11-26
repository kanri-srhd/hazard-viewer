// ======================================================================
// viewer/layers/ui.js - Google Maps完全模倣UI + hazardMatrix自動生成版
// 
// 機能:
// - PC: 左スライドイン Drawer
// - スマホ: 下スライドイン Bottom Sheet（70vh）
// - メニューアイコン（≡）によるトグル
// - アコーディオン式セクション
// - 透明度スライダー
// - レスポンシブ自動判定
// - カテゴリー順序: 地番 → ハザード → 電力 → 地図
// - ハザードレイヤーは hazardMatrix.js から自動生成
// - Google Maps風SVGアイコンセット
// ======================================================================

import { hazardMatrix } from "../../data/hazardMatrix.js";
import { powerMatrix } from "../../data/powerMatrix.js";
import { toggleHazard } from "./hazard.js";
import { togglePower } from "./power.js";

let isPanelOpen = false;
let isMobile = false;

// ======================================================================
// Google Maps風 SVGアイコン定義
// ======================================================================

const SVG_ICONS = {
    menu: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 7h16M4 12h16M4 17h16" stroke="#5f6368" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>`,
    
    chevronDown: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 9l6 6 6-6" stroke="#5f6368" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,
    
    layers: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#5f6368" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#5f6368" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,
    
    close: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6l12 12" stroke="#5f6368" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>`
};

/**
 * SVG文字列をdata URI形式に変換
 */
function svgToDataUri(svgString) {
    return `data:image/svg+xml;base64,${btoa(svgString)}`;
}

/**
 * レイヤートグルUI生成（Google Maps風 + スマホ対応）
 * @param {maplibregl.Map} map - MapLibre インスタンス
 * @param {Object} callbacks - コールバック関数群
 */
export function createLayerToggleUI(map, callbacks = {}) {
    console.log("[ui] Creating Google Maps-style layer UI (complete clone version)");

    // モバイル判定
    isMobile = window.innerWidth < 768;

    // メニューボタンのイベント設定
    setupMenuToggle();

    // レイヤーパネルのコンテンツ生成
    const panel = document.getElementById("layer-control");
    if (!panel) {
        console.error("[ui] #layer-control not found");
        return;
    }

    // パネルをクリア
    panel.innerHTML = "";

    // ヘッダー
    const header = document.createElement("h3");
    header.textContent = "🗺 レイヤー管理";
    panel.appendChild(header);

    // カテゴリー順序: 地番 → ハザード → 電力 → 地図
    createJibanSection(panel, callbacks);
    createHazardSection(panel, map, callbacks);
    createPowerSection(panel, map);
    createMapSection(panel, map, callbacks);

    // リサイズ対応
    window.addEventListener("resize", handleResize);

    console.log("[ui] Layer UI created successfully (categories: 地番 → ハザード → 電力 → 地図)");
}

/**
 * メニューボタンのトグル設定
 */
function setupMenuToggle() {
    const menuBtn = document.getElementById("menu-toggle");
    const panel = document.getElementById("layer-panel");
    const overlay = document.getElementById("panel-overlay");

    if (!menuBtn || !panel) return;

    menuBtn.addEventListener("click", () => {
        togglePanel();
    });

    // オーバーレイクリックで閉じる（スマホ用）
    if (overlay) {
        overlay.addEventListener("click", () => {
            if (isPanelOpen) {
                togglePanel();
            }
        });
    }

    // 初期状態: PCでは表示、スマホでは非表示
    if (window.innerWidth >= 768) {
        isPanelOpen = true;
        panel.classList.remove("hidden");
    } else {
        isPanelOpen = false;
        panel.classList.add("hidden");
    }
}

/**
 * パネルの開閉トグル
 */
function togglePanel() {
    const panel = document.getElementById("layer-panel");
    const overlay = document.getElementById("panel-overlay");

    isPanelOpen = !isPanelOpen;

    if (isMobile) {
        // スマホ: Bottom Sheet
        if (isPanelOpen) {
            panel.classList.add("active");
            panel.classList.remove("hidden");
            overlay.classList.add("active");
        } else {
            panel.classList.remove("active");
            setTimeout(() => {
                panel.classList.add("hidden");
            }, 300);
            overlay.classList.remove("active");
        }
    } else {
        // PC: Drawer
        if (isPanelOpen) {
            panel.classList.remove("hidden");
        } else {
            panel.classList.add("hidden");
        }
    }

    console.log(`[ui] Panel ${isPanelOpen ? "opened" : "closed"}`);
}

/**
 * リサイズハンドラ
 */
function handleResize() {
    const prevMobile = isMobile;
    isMobile = window.innerWidth < 768;

    // モバイル ⇔ PC 切り替え時の処理
    if (prevMobile !== isMobile) {
        const panel = document.getElementById("layer-panel");
        const overlay = document.getElementById("panel-overlay");

        // クラスをリセット
        panel.classList.remove("active", "hidden");
        overlay.classList.remove("active");

        // 初期状態を設定
        if (isMobile) {
            isPanelOpen = false;
            panel.classList.add("hidden");
        } else {
            isPanelOpen = true;
        }

        console.log(`[ui] Switched to ${isMobile ? "mobile" : "desktop"} mode`);
    }
}

/**
 * 地番セクション（第1カテゴリー）
 */
function createJibanSection(panel, callbacks) {
    const section = createSection("📍 地番", [
        {
            id: "jiban",
            icon: "📍",
            label: "地番表示",
            toggle: callbacks.toggleJiban
        }
    ], null, false);

    panel.appendChild(section);
}

/**
 * hazardGroup に基づいてアイコンを判定
 */
function chooseIconByHazardGroup(hazardGroup, layerId) {
    switch (hazardGroup) {
        case "flood":
            return "💧";
        case "landslide":
            return "⛰";
        case "tsunami":
            return "🌊";
        case "storm_surge":
            return "🌀";
        case "liquefaction":
            return "🏗";
        case "earthquake":
            return "🏚";
        default:
            if (layerId === "road_kansui") return "🚧";
            return "🌐";
    }
}

/**
 * ハザードセクション（第2カテゴリー）- hazardMatrix から自動生成
 * 全8レイヤーをカテゴリ別に表示
 */
function createHazardSection(panel, map, callbacks) {
    // UIに表示する8レイヤー
    const TARGET_LAYERS = new Set([
        "flood_l2_shinsuishin",
        "flood_keikaku",
        "sediment_keikai",
        "tsunami_newlegend",
        "takashio_soutei",
        "mlit_liquefaction",
        "jishin_kyouka",
        "road_kansui"
    ]);

    // カテゴリ別配列
    const flood = [];
    const landslide = [];
    const coastal = [];
    const ground = [];
    const access = [];

    // hazardMatrix から対象レイヤーを抽出してカテゴリ分け
    for (const [layerId, config] of Object.entries(hazardMatrix)) {
        if (!TARGET_LAYERS.has(layerId)) continue;

        const meta = config.metadata || {};
        const hazardGroup = meta.hazardGroup;
        const icon = chooseIconByHazardGroup(hazardGroup, layerId);

        const item = {
            id: layerId,
            icon: icon,
            label: config.title,
            layerId: layerId,
            toggle: (checked) => toggleHazard(layerId, checked)
        };

        // hazardGroup に基づいてカテゴリ分け
        if (hazardGroup === "flood") {
            flood.push(item);
        } else if (hazardGroup === "landslide") {
            landslide.push(item);
        } else if (hazardGroup === "tsunami" || hazardGroup === "storm_surge") {
            coastal.push(item);
        } else if (hazardGroup === "liquefaction" || hazardGroup === "earthquake") {
            ground.push(item);
        } else if (layerId === "road_kansui") {
            access.push(item);
        } else {
            console.warn(`[ui] Unhandled layer: ${layerId} (group: ${hazardGroup})`);
        }
    }

    // カテゴリごとにセクション作成（順序固定: 洪水 → 土砂 → 津波・高潮 → 地盤・地震 → 道路冠水）
    if (flood.length > 0) {
        panel.appendChild(createSection("💧 洪水", flood, map, true));
    }
    if (landslide.length > 0) {
        panel.appendChild(createSection("⛰ 土砂", landslide, map, true));
    }
    if (coastal.length > 0) {
        panel.appendChild(createSection("🌊 津波・高潮", coastal, map, true));
    }
    if (ground.length > 0) {
        panel.appendChild(createSection("🛟 地盤・地震", ground, map, true));
    }
    if (access.length > 0) {
        panel.appendChild(createSection("🚧 道路冠水", access, map, true));
    }
}

/**
 * 電力（空き容量）セクション（第3カテゴリー）
 */
function chooseIconByPowerSubtype(subtype) {
    switch (subtype) {
        case "grid_lines":
            return "⚡";
        case "substations":
            return "🏭";
        case "capacity":
            return "📊";
        default:
            return "🔌";
    }
}

/**
 * 電力セクション（第3カテゴリー）- powerMatrix から自動生成
 */
function createPowerSection(panel, map) {
    const items = [];
    for (const [id, cfg] of Object.entries(powerMatrix)) {
        const meta = cfg.metadata || {};
        const icon = chooseIconByPowerSubtype(meta.subtype);
        items.push({
            id,
            icon,
            label: cfg.title,
            layerId: `power_${id}`,
            toggle: (checked) => togglePower(id, checked)
        });
    }
    if (items.length > 0) {
        panel.appendChild(createSection("⚡ 電力", items, map, false));
    }
}

/**
 * 地図・航空写真セクション（第4カテゴリー）
 */
function createMapSection(panel, map, callbacks) {
    const section = createSection("🗾 地図・航空写真", [
        {
            id: "photo",
            icon: "📷",
            label: "航空写真",
            layerId: "gsi-photo-layer",
            toggle: callbacks.togglePhoto
        }
    ], map, true);

    panel.appendChild(section);
}

/**
 * セクション生成（アコーディオン対応）
 */
function createSection(title, items, map, hasOpacity) {
    const section = document.createElement("div");
    section.className = "layer-section";

    // セクションヘッダー
    const header = document.createElement("div");
    header.className = "section-header";
    
    const titleSpan = document.createElement("span");
    titleSpan.className = "section-title";
    titleSpan.textContent = title;
    
    const arrowSpan = document.createElement("span");
    arrowSpan.className = "toggle-arrow";
    const arrowImg = document.createElement("img");
    arrowImg.src = svgToDataUri(SVG_ICONS.chevronDown);
    arrowImg.alt = "▼";
    arrowSpan.appendChild(arrowImg);
    
    header.appendChild(titleSpan);
    header.appendChild(arrowSpan);

    // セクションコンテンツ
    const content = document.createElement("div");
    content.className = "section-content";

    // レイヤー項目を追加
    items.forEach(item => {
        const itemDiv = createLayerItem(item, map, hasOpacity);
        content.appendChild(itemDiv);
    });

    // アコーディオン切り替え
    header.addEventListener("click", () => {
        header.classList.toggle("collapsed");
        content.classList.toggle("collapsed");
    });

    section.appendChild(header);
    section.appendChild(content);

    return section;
}

/**
 * レイヤー項目生成
 */
function createLayerItem(item, map, hasOpacity) {
    const container = document.createElement("div");

    // チェックボックス + ラベル
    const itemDiv = document.createElement("div");
    itemDiv.className = "layer-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `chk-${item.id}`;

    const label = document.createElement("label");
    label.setAttribute("for", `chk-${item.id}`);
    label.innerHTML = `<span class="layer-icon">${item.icon}</span>${item.label}`;

    itemDiv.appendChild(checkbox);
    itemDiv.appendChild(label);
    container.appendChild(itemDiv);

    // トグル処理
    checkbox.addEventListener("change", () => {
        if (item.toggle) {
            item.toggle(checkbox.checked);
        }
    });

    // 透明度スライダー（ハザード・航空写真のみ）
    if (hasOpacity && item.layerId && map) {
        const opacityDiv = document.createElement("div");
        opacityDiv.className = "opacity-slider";

        const opacityLabel = document.createElement("label");
        opacityLabel.textContent = "透明度:";
        opacityDiv.appendChild(opacityLabel);

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "1";
        slider.step = "0.01";
        slider.value = item.id === "photo" ? "0.4" : "0.75";
        slider.id = `opacity-${item.id}`;

        slider.addEventListener("input", (e) => {
            const opacity = parseFloat(e.target.value);
            if (map.getLayer(item.layerId)) {
                map.setPaintProperty(item.layerId, "raster-opacity", opacity);
                console.log(`[ui] ${item.label} opacity: ${opacity}`);
            }
        });

        opacityDiv.appendChild(slider);
        container.appendChild(opacityDiv);
    }

    return container;
}

/**
 * パネルサイズ調整（エクスポート用）
 */
export function adjustPanelSize() {
    // スマホ版は固定サイズのため調整不要
    if (window.innerWidth < 768) {
        return;
    }

    const panel = document.getElementById("layer-control");
    if (panel) {
        const maxHeight = Math.max(200, window.innerHeight - 160);
        panel.style.maxHeight = maxHeight + "px";
    }
}
