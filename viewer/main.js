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

    // UIは load 前に初期化してOK
    initUI(map);

    // 🟦 全レイヤー初期化は map.on("load") の中で行う
    map.on("load", () => {
        console.log("[main] map loaded → initializing hazard & power");

        // ハザード初期化
        const hazardController = initHazard(map, detectPrefecture);

        // 電力レイヤー初期化
        const powerController = initPowerLayers(map);

        // UI トグル追加
        initPowerLayerToggles(powerController);

        // expose（任意）
        // window.hazardController = hazardController;
        // window.powerController = powerController;
    });
});

    // 必要に応じてデバッグ用に window に expose
    // window.hazardController = hazardController;
    // window.powerController = powerController;

