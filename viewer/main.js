// ======================================================================
// main.js - PhaseX / Phase5-D 安定版 起動シーケンス
// ======================================================================

import { initMap } from "./map-init.js";
import { initUI, initPowerLayerToggles } from "./ui-init.js";
import { initHazard } from "./hazard-init.js";
import { initPowerLayers } from "./power-init.js";
import { detectPrefecture } from "./utils/prefDetect.js";

document.addEventListener("DOMContentLoaded", () => {

    // --------------------------------------------------
    // 1. 地図本体を初期化（標準地図＋航空写真）
    // --------------------------------------------------
    const map = initMap();
    window.map = map; // デバッグ用（任意）

    // --------------------------------------------------
    // 2. UI はロード前に初期化して OK
    // --------------------------------------------------
    initUI(map);

    // --------------------------------------------------
    // 3. 全レイヤー初期化は map.on("load") に統一
    //    → Hazard / Power / その他レイヤーの競合を完全排除
    // --------------------------------------------------
    map.on("load", () => {
        console.log("[main] map fully loaded → initializing core layers…");

        // -------------------------------
        // 3-A. ハザードレイヤー初期化
        // -------------------------------
        const hazardController = initHazard(map, detectPrefecture);

        // -------------------------------
        // 3-B. 電力（送電線・変電所）レイヤー初期化
        // -------------------------------
        const powerController = initPowerLayers(map);

        // -------------------------------
        // 3-C. 電力レイヤー UI トグル追加
        // -------------------------------
        initPowerLayerToggles(powerController);

        // -------------------------------
        // 3-D. デバッグ用（必要なら使用）
        // -------------------------------
        window.hazardController = hazardController;
        window.powerController = powerController;
    });
});
