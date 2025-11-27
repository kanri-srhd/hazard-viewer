// ============================================
//  power_infrastructure.js
//  電力インフラレイヤー（変電所・送電線）
// ============================================

import { resolveDataPath } from '../utils/pathResolver.js';

let mapInstance = null;
let isVisible = false;
let layerAdded = false;
let infrastructureData = null;

const SOURCE_ID = "power-infra-src";
const SUBSTATION_LAYER_ID = "power-substation-layer";
const SUBSTATION_LABEL_ID = "power-substation-label";
const LINE_LAYER_ID = "power-line-layer";
const SUBSTATION_POLYGONS_SOURCE_ID = "power-substation-polygons";
const SUBSTATION_POLYGONS_FILL_ID = "power-substation-polygons-fill";
const SUBSTATION_POLYGONS_OUTLINE_ID = "power-substation-polygons-outline";
const SUBSTATION_POLYGONS_LABEL_ID = "power-substation-polygons-label";

// --------------------------------------------
// データロード
// --------------------------------------------
async function loadInfrastructureData() {
    const dataUrl = resolveDataPath("power/capacity/tepco_substations_all_matched.json");
    
    try {
        const data = await fetch(dataUrl).then(r => r.json());
        console.log(`[power-infra] Loaded ${data.length} entries`);
        
        // このファイルは変電所のみを含む統合済みマッチ結果
        const substations = data;
        const transmissionLines = [];
        
        console.log(`[power-infra] Substations: ${substations.length}, Lines: ${transmissionLines.length}`);
        
        // 座標があるエントリを確認
        const withCoords = substations.filter(e => e.lat != null && e.lon != null);
        console.log(`[power-infra] Entries with coordinates: ${withCoords.length} (${(withCoords.length / data.length * 100).toFixed(1)}%)`);
        if (withCoords.length > 0) {
            console.log('[power-infra] Sample with coordinates:');
            withCoords.slice(0, 5).forEach(e => {
                console.log(`  - ${e.name} (${e.voltage_kv}kV): [${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}]`);
            });
        }
        
        infrastructureData = {
            substations,
            transmissionLines,
            all: data
        };
        
        return infrastructureData;
    } catch (error) {
        console.error('[power-infra] Failed to load data:', error);
        return { substations: [], transmissionLines: [], all: [] };
    }
}

// --------------------------------------------
// 変電所をGeoJSON Pointsに変換
// --------------------------------------------
function substationsToGeoJSON(substations) {
    const features = substations
        .filter(s => s.lat != null && s.lon != null) // 座標があるもののみ
        .map(s => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [s.lon, s.lat]
            },
            properties: {
                id: s.id,
                name: s.name,
                utility: s.utility,
                voltage_kv: s.voltage_kv,
                available_kw: s.available_kw,
                updated_at: s.updated_at,
                matched_source: s.matched_source,
                confidence: s.confidence
            }
        }));
    
    return {
        type: "FeatureCollection",
        features
    };
}

// --------------------------------------------
// レイヤー追加
// --------------------------------------------
async function addPowerInfraLayer(map) {
    if (layerAdded) return;
    mapInstance = map;

    const data = await loadInfrastructureData();
    
    // 変電所レイヤー（座標があるもののみ表示）
    const substationGeoJSON = substationsToGeoJSON(data.substations);
    
    console.log(`[power-infra] Adding ${substationGeoJSON.features.length} substations to map`);
    
    if (substationGeoJSON.features.length > 0) {
        map.addSource(SOURCE_ID, {
            type: "geojson",
            data: substationGeoJSON
        });

        // 変電所ポイント（電圧で色分け）
        map.addLayer({
            id: SUBSTATION_LAYER_ID,
            type: "circle",
            source: SOURCE_ID,
            paint: {
                "circle-radius": [
                    "case",
                    ["==", ["typeof", ["get", "voltage_kv"]], "number"],
                    [
                        "interpolate",
                        ["linear"],
                        ["get", "voltage_kv"],
                        6.6, 4,    // 低圧配電
                        22, 6,     // 配電
                        66, 8,     // 2次系統
                        154, 10,   // 1次系統
                        275, 12,   // 基幹系統
                        500, 14    // 超高圧
                    ],
                    7  // voltage_kv が無い場合のデフォルト半径
                ],
                "circle-color": [
                    "case",
                    ["==", ["typeof", ["get", "voltage_kv"]], "number"],
                    [
                        "step",
                        ["get", "voltage_kv"],
                        "#ffd700", // 6.6kV - gold
                        22, "#ff8c00",  // 22kV - dark orange
                        66, "#ff4500",  // 66kV - orange red
                        154, "#dc143c", // 154kV - crimson
                        275, "#8b0000", // 275kV - dark red
                        500, "#4b0082"  // 500kV - indigo
                    ],
                    "#999999" // voltage_kv が無い場合のデフォルト色（グレー）
                ],
                "circle-opacity": 0.8,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1
            },
            layout: {
                "visibility": "visible"
            }
        });

        // 変電所ラベル（glyphs未設定スタイルではスキップ）
        const style = map.getStyle && map.getStyle();
        const hasGlyphs = style && typeof style.glyphs === 'string' && style.glyphs.length > 0;
        if (hasGlyphs) {
            map.addLayer({
                id: SUBSTATION_LABEL_ID,
                type: "symbol",
                source: SOURCE_ID,
                layout: {
                    "text-field": ["get", "name"],
                    "text-size": 11,
                    "text-offset": [0, 1.5],
                    "text-anchor": "top",
                    "visibility": "none"
                },
                paint: {
                    "text-color": "#333333",
                    "text-halo-color": "#ffffff",
                    "text-halo-width": 2
                }
            });
        } else {
            console.warn('[power-infra] Skipping label layer: style.glyphs is not configured');
        }
        
        // クリックイベント
        map.on('click', SUBSTATION_LAYER_ID, (e) => {
            if (e.features.length > 0) {
                const props = e.features[0].properties;
                const html = `
                    <div style="font-family: sans-serif;">
                        <h3 style="margin: 0 0 8px 0; color: #333;">${props.name}変電所</h3>
                        <table style="font-size: 13px; border-collapse: collapse; width: 100%;">
                            <tr><td style="padding: 4px 8px 4px 0; color: #666;">電圧階級:</td><td style="padding: 4px 0;">${props.voltage_kv} kV</td></tr>
                            <tr><td style="padding: 4px 8px 4px 0; color: #666;">空き容量:</td><td style="padding: 4px 0;">${(props.available_kw / 1000).toLocaleString()} kW</td></tr>
                            <tr><td style="padding: 4px 8px 4px 0; color: #666;">更新日:</td><td style="padding: 4px 0;">${props.updated_at}</td></tr>
                            <tr><td style="padding: 4px 8px 4px 0; color: #666;">事業者:</td><td style="padding: 4px 0;">${props.utility}</td></tr>
                            ${props.matched_source !== 'unmatched' ? `<tr><td style="padding: 4px 8px 4px 0; color: #666;">座標取得:</td><td style="padding: 4px 0;">${props.matched_source}</td></tr>` : ''}
                        </table>
                    </div>
                `;
                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(html)
                    .addTo(map);
            }
        });
        
        // ホバー時のカーソル変更
        map.on('mouseenter', SUBSTATION_LAYER_ID, () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', SUBSTATION_LAYER_ID, () => {
            map.getCanvas().style.cursor = '';
        });
    }

    // 変電所敷地ポリゴン（OSM）
    try {
        // Prefer combined (OSM + synthetic) if exists
        const combinedPath = resolveDataPath('power/osm/substation_polygons_with_generated.geojson');
        const basePath = resolveDataPath('power/osm/substation_polygons.geojson');
        let polygonDataPath = combinedPath;
        try {
            // Attempt HEAD request to see if combined file is accessible
            await fetch(combinedPath, { method: 'HEAD' }).then(r => { if (!r.ok) throw new Error('Not found'); });
        } catch (_) {
            polygonDataPath = basePath;
            console.warn('[power-infra] Using base OSM polygons only (combined file not found)');
        }
        map.addSource(SUBSTATION_POLYGONS_SOURCE_ID, {
            type: 'geojson',
            data: polygonDataPath
        });

        map.addLayer({
            id: SUBSTATION_POLYGONS_FILL_ID,
            type: 'fill',
            source: SUBSTATION_POLYGONS_SOURCE_ID,
            paint: {
                'fill-color': '#d5a6f5',
                'fill-opacity': [
                    'interpolate', ['linear'], ['coalesce', ['get', 'voltage_kv_numeric'], 66],
                    22, 0.25,
                    66, 0.3,
                    154, 0.35,
                    275, 0.4,
                    500, 0.45
                ]
            },
            layout: { visibility: 'visible' }
        });

        map.addLayer({
            id: SUBSTATION_POLYGONS_OUTLINE_ID,
            type: 'line',
            source: SUBSTATION_POLYGONS_SOURCE_ID,
            paint: {
                'line-color': '#8a2be2',
                'line-width': 1.5
            },
            layout: { visibility: 'visible' }
        });

        // ポリゴン名称ラベル（Open Infrastructure Map 風）
        const style2 = map.getStyle && map.getStyle();
        const hasGlyphs2 = style2 && typeof style2.glyphs === 'string' && style2.glyphs.length > 0;
        if (hasGlyphs2) {
            map.addLayer({
                id: SUBSTATION_POLYGONS_LABEL_ID,
                type: 'symbol',
                source: SUBSTATION_POLYGONS_SOURCE_ID,
                filter: ["has", "name"],
                layout: {
                    'text-field': [
                        'coalesce',
                        ['get', 'name'],
                        ['get', 'name:ja'],
                        ['get', 'operator'],
                        ''
                    ],
                    'text-size': [
                        'interpolate', ['linear'], ['zoom'],
                        6, 11,
                        10, 13,
                        14, 16
                    ],
                    'symbol-placement': 'point',
                    'text-padding': 2,
                    'text-max-width': 12,
                    'text-allow-overlap': false,
                    'visibility': 'visible'
                },
                paint: {
                    'text-color': '#4b0082',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 1.5,
                    // ズームをトップレベルの interpolate で使用し、ズームごとの面積しきい値で不透明度を切り替え
                    'text-opacity': [
                        'interpolate', ['linear'], ['zoom'],
                        10, ['step', ['coalesce', ['get', 'area_est_m2'], 0], 0.0, 2000, 1.0],
                        12, ['step', ['coalesce', ['get', 'area_est_m2'], 0], 0.0, 1000, 1.0],
                        14, ['step', ['coalesce', ['get', 'area_est_m2'], 0], 0.0, 200, 1.0]
                    ]
                }
            });
        } else {
            console.warn('[power-infra] Skipping polygon label layer: style.glyphs is not configured');
        }
    } catch (err) {
        console.warn('[power-infra] Failed to add substation polygons:', err);
    }

    layerAdded = true;
    console.log('[power-infra] Layer added');
}

// --------------------------------------------
// 表示切り替え
// --------------------------------------------
function togglePowerInfra() {
    if (!mapInstance || !layerAdded) return;

    isVisible = !isVisible;
    const visibility = isVisible ? "visible" : "none";

    if (mapInstance.getLayer(SUBSTATION_LAYER_ID)) {
        mapInstance.setLayoutProperty(SUBSTATION_LAYER_ID, "visibility", visibility);
    }
    if (mapInstance.getLayer(SUBSTATION_LABEL_ID)) {
        mapInstance.setLayoutProperty(SUBSTATION_LABEL_ID, "visibility", visibility);
    }
    if (mapInstance.getLayer(SUBSTATION_POLYGONS_FILL_ID)) {
        mapInstance.setLayoutProperty(SUBSTATION_POLYGONS_FILL_ID, 'visibility', visibility);
    }
    if (mapInstance.getLayer(SUBSTATION_POLYGONS_OUTLINE_ID)) {
        mapInstance.setLayoutProperty(SUBSTATION_POLYGONS_OUTLINE_ID, 'visibility', visibility);
    }
    if (mapInstance.getLayer(SUBSTATION_POLYGONS_LABEL_ID)) {
        mapInstance.setLayoutProperty(SUBSTATION_POLYGONS_LABEL_ID, 'visibility', visibility);
    }

    console.log(`[power-infra] Visibility: ${visibility}`);
}

// --------------------------------------------
// 統計情報取得
// --------------------------------------------
function getInfraStats() {
    if (!infrastructureData) return null;
    
    const { substations, transmissionLines, all } = infrastructureData;
    const withCoords = all.filter(e => e.lat != null && e.lon != null).length;
    
    // 電圧階級別集計
    const byVoltage = {};
    all.forEach(e => {
        const v = e.voltage_kv;
        if (!byVoltage[v]) byVoltage[v] = { total: 0, withCoords: 0 };
        byVoltage[v].total++;
        if (e.lat != null && e.lon != null) byVoltage[v].withCoords++;
    });
    
    return {
        total: all.length,
        substations: substations.length,
        transmissionLines: transmissionLines.length,
        withCoords,
        withoutCoords: all.length - withCoords,
        coordsPercentage: ((withCoords / all.length) * 100).toFixed(1),
        byVoltage
    };
}

// --------------------------------------------
// エクスポート
// --------------------------------------------
export const PowerInfraLayer = {
    add: addPowerInfraLayer,
    toggle: togglePowerInfra,
    isVisible: () => isVisible,
    getStats: getInfraStats,
    getData: () => infrastructureData
};
