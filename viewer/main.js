// ======================================================================
// main.js - 起動シーケンスのみ（Phase5-C）
// ======================================================================

import { initMap } from "./map-init.js";
import { initUI } from "./ui-init.js";
import { initHazard, updatePrefForHazard } from "./hazard-init.js";
import { initPower } from "./power-init.js";
import { detectPrefecture } from "./utils/prefDetect.js";

let currentPrefCode = null;

const map = initMap();
window.map = map;

map.on("load", () => {
    initUI(map);
    initHazard(map, () => currentPrefCode);
    initPower(map);

    const c = map.getCenter();
    updatePref(c.lat, c.lng);
});

function updatePref(lat, lng) {
    const pref = detectPrefecture(lat, lng);
    if (!pref) return;

    const prefCode = typeof pref === "string" ? pref : pref.code;

    if (currentPrefCode !== prefCode) {
        currentPrefCode = prefCode;
        updatePrefForHazard(prefCode);
    }
}
