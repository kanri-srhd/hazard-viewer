// ======================================================================
// main.js - 起動シーケンスのみ（Phase5-C）
// ======================================================================

import { initMap } from "./map-init.js";
import { initUI, initPowerLayerToggles } from "./ui-init.js";
import { initHazard } from "./hazard-init.js";
import { initPowerLayers } from "./power-init.js";
import { detectPrefecture } from "./utils/prefDetect.js";

document.addEventListener("DOMContentLoaded", () => {
    const map = initMap();
    window.map = map;

    // 既存 UI
    initUI(map);

    // ハザード初期化（正しい呼び方）
    const hazardController = initHazard(map, detectPrefecture);

    // 🌏 OSM 電力レイヤー初期化
    const powerController = initPowerLayers(map);

    // UI に「送電線・変電所」トグルを追加
    initPowerLayerToggles(powerController);

    // 必要に応じてデバッグ用に window に expose
    // window.hazardController = hazardController;
    // window.powerController = powerController;
});
