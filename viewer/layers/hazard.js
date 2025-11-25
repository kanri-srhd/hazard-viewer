// ======================================================================
// hazard.js - フェーズ3 RESET版（完全抽象化）
// ======================================================================
//
// このモジュールは hazardMatrix.js に定義された全レイヤーを
// 動的に構築し、pref-code 切替と透明度管理を行う。
// レイヤーは今後 hazardMatrix.js の追加だけで拡張可能。
// ======================================================================

import { hazardMatrix } from "../../data/hazardMatrix.js";

let mapInstance = null;
let currentPrefCode = null;

// 内部状態保持（透明度・visibility 復元のため）
const layerState = {};  
// { layerId: { opacity: 0.75, visibility: "none" } }

// ----------------------------------------------------------------------
// URL生成（hazardMatrix.json の template を最優先）
// ----------------------------------------------------------------------
function buildTileUrl(config, prefCode) {
    // template が存在する場合は最優先で使用
    if (config.template) {
        return config.template;
    }
    
    // フォールバック: directory から構築（基本的に使われない想定）
    if (config.directory) {
        const base = "https://disaportaldata.gsi.go.jp/raster";
        return `${base}/${config.directory}/{z}/{x}/{y}.png`;
    }
    
    // 両方ない場合はエラー
    console.error(`[hazard] No template or directory for layer: ${config.id}`);
    throw new Error(`No template or directory in hazardMatrix for ${config.id}`);
}

// ----------------------------------------------------------------------
// initHazardLayers()
//  - hazardMatrix からレイヤーを全追加
// ----------------------------------------------------------------------
export function initHazardLayers(map, getPrefCode, getOpacity) {
    mapInstance = map;
    currentPrefCode = getPrefCode();

    console.log("[hazard] Initializing hazard layers (RESET版)");

    for (const [layerId, config] of Object.entries(hazardMatrix)) {
        const sourceId = `${layerId}-src`;

        // 初期透明度
        const opacity = typeof getOpacity === "function"
            ? getOpacity(layerId)
            : 0.75;

        // 初期状態登録
        layerState[layerId] = {
            opacity,
            visibility: "none"
        };

        const tileUrl = buildTileUrl(config, currentPrefCode);

        // ソース追加
        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
                type: "raster",
                tiles: [tileUrl],
                tileSize: 256
            });
        }

        // レイヤー追加
        if (!map.getLayer(layerId)) {
            map.addLayer({
                id: layerId,
                type: "raster",
                source: sourceId,
                layout: { visibility: "none" },
                paint: { "raster-opacity": opacity },
                minzoom: config.minzoom ?? 2,
                maxzoom: config.maxzoom ?? 17
            });
        }

        console.log(`[hazard] Added layer: ${layerId} (zoom: ${config.minzoom ?? 2}-${config.maxzoom ?? 17})`);
    }

    console.log("[hazard] ✓ All layers initialized (RESET版)");
}

// ----------------------------------------------------------------------
// updateHazardPref(prefCode)
//  - pref-code に応じて pref-data レイヤーのURLを再構築
// ----------------------------------------------------------------------
export function updateHazardPref(prefCode) {
    if (!mapInstance) return;

    currentPrefCode = prefCode;
    console.log("[hazard] Updating prefCode to:", prefCode);

    for (const [layerId, config] of Object.entries(hazardMatrix)) {
        if (config.prefOrData === "api") continue; // MLIT APIはpref無関係

        const sourceId = `${layerId}-src`;

        // 以前の visibility / opacity を取得
        const prev = layerState[layerId] || {
            visibility: "none",
            opacity: 0.75
        };

        const newUrl = buildTileUrl(config, currentPrefCode);

        // レイヤー削除
        if (mapInstance.getLayer(layerId)) {
            mapInstance.removeLayer(layerId);
        }
        if (mapInstance.getSource(sourceId)) {
            mapInstance.removeSource(sourceId);
        }

        // 再追加
        mapInstance.addSource(sourceId, {
            type: "raster",
            tiles: [newUrl],
            tileSize: 256
        });

        mapInstance.addLayer({
            id: layerId,
            type: "raster",
            source: sourceId,
            layout: { visibility: prev.visibility },
            paint: { "raster-opacity": prev.opacity },
            minzoom: config.minzoom ?? 2,
            maxzoom: config.maxzoom ?? 17
        });

        console.log(`[hazard] Refreshed layer: ${layerId}`);
    }

    console.log("[hazard] ✓ All pref-based layers refreshed");
}

// ----------------------------------------------------------------------
// toggleHazard(layerId, visible)
//  - 任意レイヤーの ON/OFF 切替
// ----------------------------------------------------------------------
export function toggleHazard(layerId, visible) {
    if (!mapInstance) return;

    if (!hazardMatrix[layerId]) {
        console.warn("[hazard] toggleHazard: Unknown layer:", layerId);
        return;
    }

    const visibility = visible ? "visible" : "none";
    layerState[layerId].visibility = visibility;

    if (mapInstance.getLayer(layerId)) {
        mapInstance.setLayoutProperty(layerId, "visibility", visibility);
    }

    console.log(`[hazard] ${layerId}: ${visibility}`);
}

// ----------------------------------------------------------------------
// 完了
// ----------------------------------------------------------------------
console.log("[hazard] RESET版 hazard.js loaded");
