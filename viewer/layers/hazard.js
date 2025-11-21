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

// 404エラーログ抑制用（同一URLは1回だけ警告）
const errorLoggedUrls = new Set();

// ----------------------------------------------------------------------
// 透明1x1 PNG（404フェイルオーバー用）
// ----------------------------------------------------------------------
const TRANSPARENT_TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';

// ----------------------------------------------------------------------
// URL生成（prefOrData による自動分岐 + フェイルオーバー対応）
// GSI公式サブフォルダ構造: raster/{directory}/{pref}/{z}/{x}/{y}.png
// ----------------------------------------------------------------------
function buildTileUrl(config, prefCode, useFallback = false) {
    // MLIT API など
    if (config.prefOrData === "api") {
        return config.template;
    }

    const base = "https://disaportaldata.gsi.go.jp/raster";

    // フェイルオーバー時は全国版を強制使用
    if (useFallback) {
        return `${base}/${config.directory}/{z}/{x}/{y}.png`;
    }

    // 都道府県別タイル（isPrefBased フラグ考慮）
    // GSI公式構造: raster/{directory}/{pref}/{z}/{x}/{y}.png
    if (config.prefOrData === "pref-or-data" && prefCode && config.isPrefBased) {
        return `${base}/${config.directory}/${prefCode}/{z}/{x}/{y}.png`;
    }

    // 全国統一タイル
    if (config.prefOrData === "data") {
        return `${base}/${config.directory}/{z}/{x}/{y}.png`;
    }

    // それ以外は template を返す
    return config.template;
}

// ----------------------------------------------------------------------
// タイルエラーハンドラ（404時にフェイルオーバー）
// ----------------------------------------------------------------------
function setupTileErrorHandler(map, sourceId, config, prefCode) {
    if (!config.fallbackToNational) return;

    map.on('error', (e) => {
        if (e.source && e.source.id === sourceId) {
            const url = e.tile?.url;
            if (url && !errorLoggedUrls.has(url)) {
                console.warn(`[hazard] Tile 404 detected, using fallback: ${sourceId}`);
                errorLoggedUrls.add(url);
                
                // フェイルオーバーURL生成
                const fallbackUrl = buildTileUrl(config, prefCode, true);
                
                // ソースを全国版に切り替え
                if (map.getSource(sourceId)) {
                    map.removeSource(sourceId);
                }
                map.addSource(sourceId, {
                    type: "raster",
                    tiles: [fallbackUrl],
                    tileSize: 256
                });
            }
        }
    });
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

        // 404フェイルオーバーハンドラ設定
        setupTileErrorHandler(map, sourceId, config, currentPrefCode);

        // レイヤー追加
        if (!map.getLayer(layerId)) {
            map.addLayer({
                id: layerId,
                type: "raster",
                source: sourceId,
                layout: { visibility: "none" },
                paint: { "raster-opacity": opacity }
            });
        }

        console.log(`[hazard] Added layer: ${layerId}`);
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

        // 404フェイルオーバーハンドラ設定
        setupTileErrorHandler(mapInstance, sourceId, config, currentPrefCode);

        mapInstance.addLayer({
            id: layerId,
            type: "raster",
            source: sourceId,
            layout: { visibility: prev.visibility },
            paint: { "raster-opacity": prev.opacity }
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
