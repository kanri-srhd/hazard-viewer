// ======================================================================
// main.js - 起動シーケンスのみ（Phase5-C）
// ======================================================================

import { createMap } from "./map-init.js";
import { initUI, initPowerLayerToggles } from "./ui-init.js";
import { initHazardLayers } from "./hazard-init.js";
import { initPowerLayers } from "./power-init.js";
import { detectPrefecture } from "./utils/prefDetect.js";

document.addEventListener("DOMContentLoaded", () => {
    const map = createMap();
    window.map = map;

    // 既存 UI
    initUI(map);

    // ハザード初期化（既存）
    const hazardController = initHazardLayers(map);

    // 🌏 OSM 電力レイヤー初期化
    const powerController = initPowerLayers(map);

    // UI に「送電線・変電所」トグルを追加
    initPowerLayerToggles(powerController);

    // 必要なら hazardController / powerController を
    // window にぶら下げてデバッグ用にしてもよい
    // window.hazardController = hazardController;
    // window.powerController = powerController;
});
