// ======================================================================
// power-init.js - 電力インフラ（変電所・送電線）
// ======================================================================

import { addPowerlineLayer } from "./layers/powerline.js";
import { PowerInfraLayer } from "./layers/power_infrastructure.js";

export function initPower(map) {
    PowerInfraLayer.add(map).catch(err => {
        console.error("[power-init] Failed to initialize power infrastructure:", err);
    });

    addPowerlineLayer(map);
}
