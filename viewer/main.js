// ======================================================================
// main.js - PhaseX / Phase5-D 安定版 起動シーケンス
// ======================================================================

import { initMap } from "./map-init.js";
import { initUI, initPowerLayerToggles, initPowerLegendUI } from "./ui-init.js";
import { initHazard } from "./hazard-init.js";
import { initPowerLayers } from "./power-init.js";
import { detectPrefecture } from "./utils/prefDetect.js";

document.addEventListener("DOMContentLoaded", () => {

    const map = initMap();
    window.map = map;

    initUI(map);

    map.on("load", () => {
        console.log("[main] map fully loaded -> initializing core layers...");

        const hazardController = initHazard(map, detectPrefecture);
        const powerController = initPowerLayers(map);

        initPowerLayerToggles(powerController);
        initPowerLegendUI(powerController);

        window.hazardController = hazardController;
        window.powerController = powerController;
    });
});
