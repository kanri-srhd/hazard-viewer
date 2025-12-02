// ======================================================================
// hazard-init.js - ハザードレイヤー初期化
// ======================================================================

import { initHazardLayers, updateHazardPref } from "./layers/hazard.js";

export function initHazard(map, getPrefCodeFn) {
    initHazardLayers(map, getPrefCodeFn);
}

export function updatePrefForHazard(prefCode) {
    updateHazardPref(prefCode);
}
