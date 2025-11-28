// ============================================
//  power_infrastructure.js
//  電力インフラレイヤー（変電所・送電線）
//  ★ 新版：変電所敷地は base polygons のみ使用
// ============================================

import { resolveDataPath } from '../utils/pathResolver.js';

let mapInstance = null;
let isVisible = false;
let layerAdded = false;
let infrastructureData = null;

// IDs
const SOURCE_ID = "power-infra-src";
const SUBSTATION_LAYER_ID = "power-substation-layer";
const SUBSTATION_LABEL_ID = "power-substation-label";

const SUBSTATION_POLYGONS_SOURCE_ID = "power-substation-polygons-base";
const SUBSTATION_POLYGONS_FILL_ID = "power-substation-polygons-fill";
const SUBSTATION_POLYGONS_OUTLINE_ID = "power-substation-polygons-outline";
const SUBSTATION_POLYGONS_LABEL_ID = "power-substation-polygons-label";

// ============================================
// capacityデータロード
// ============================================
async function loadInfrastructureData() {
    const url = resolveDataPath("power/capacity/national_substations_all.geojson");

    try {
        const fc = await fetch(url).then(r => r.json());

        if (!fc || !fc.features) {
            throw new Error("national_substations_all.geojson is not a FeatureCollection");
        }

        const features = fc.features;

        console.log(`[power-infra] Loaded national substation points: ${features.length}`);
        
        return {
            substations: features,   // ← features配列
            all: features,
            transmissionLines: []
        };
    } catch (err) {
        console.error("[power-infra] Load failed:", err);
        return { substations: [], all: [], transmissionLines: [] };
    }
}

// ============================================
// capacity → GeoJSON Points
// ============================================
function substationsToGeoJSON(arr) {
    return {
        type: "FeatureCollection",
        features: arr
            // national_substations_all.geojson は Feature の配列なので geometry を見る
            .filter(e => e.geometry && e.geometry.type === "Point" && e.geometry.coordinates)
            .map(e => ({
                type: "Feature",
                geometry: e.geometry,          // centroid そのまま
                properties: { ...e.properties } // properties もそのまま
            }))
    };
}

// ============================================
// レイヤー追加
// ============================================
async function addPowerInfraLayer(map) {
    if (layerAdded) return;
    mapInstance = map;

    // ------ Load capacity ------
    const infra = await loadInfrastructureData();
    infrastructureData = infra;

    // 国内のみ
    const domestic = infra.substations.filter(s => !s.is_foreign);
    const pointFC = substationsToGeoJSON(domestic);

    // ------ capacity points ------
    map.addSource(SOURCE_ID, {
        type: "geojson",
        data: pointFC,
        cluster: false,
        promoteId: "id"
    });

map.addLayer({
    id: SUBSTATION_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    paint: {
        "circle-radius": 5,
        "circle-color": [
            "case",
            // まず null の場合を先に明示してしまう
            ["==", ["coalesce", ["get", "available_kw"], -1], -1], "#999999",

            // null 以外は必ず数値なので safe
            ["==", ["get", "available_kw"], 0], "#ff3333",
            ["<=", ["get", "available_kw"], 500000], "#ff9900",
            ["<=", ["get", "available_kw"], 2000000], "#ffe600",
            [">", ["get", "available_kw"], 2000000], "#33cc33",

            "#999999" // fallback
        ],
        "circle-opacity": 0.9,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1.4
    },
    layout: {
        visibility: "visible"
    }
});


    // ------ point labels ------
    const style = map.getStyle && map.getStyle();
    const hasGlyphs = style && typeof style.glyphs === "string" && style.glyphs.length > 0;

    if (hasGlyphs) {
        map.addLayer({
            id: SUBSTATION_LABEL_ID,
            type: "symbol",
            source: SOURCE_ID,
            layout: {
                "text-field": [
                    "coalesce",
                    ["get", "name"],
                    ["get", "name:ja"],
                    ["get", "operator"]
                ],
                "text-size": 12,
                "text-offset": [0, 1.2],
                "text-anchor": "top"
            },
            paint: {
                "text-color": "#333",
                "text-halo-color": "#fff",
                "text-halo-width": 2,
                "text-opacity": [
                    "interpolate", ["linear"], ["zoom"],
                    10, 0,
                    12, 0.6,
                    14, 1
                ]
            }
        });
    }

    // ====================================
    // ★ 敷地ポリゴン（base polygons）★
    // ====================================
    const polyPath = resolveDataPath("power/osm/substation_polygons_base.geojson");
    const baseFC = await fetch(polyPath).then(r => r.json());
    console.log(`[power-infra] Loaded base polygons: ${baseFC.features.length}`);

    map.addSource(SUBSTATION_POLYGONS_SOURCE_ID, {
        type: "geojson",
        data: baseFC
    });

    // fill
    map.addLayer({
        id: SUBSTATION_POLYGONS_FILL_ID,
        type: "fill",
        source: SUBSTATION_POLYGONS_SOURCE_ID,
        paint: {
            "fill-color": "#b08cff",
            "fill-opacity": 0.32
        }
    });

    // outline
    map.addLayer({
        id: SUBSTATION_POLYGONS_OUTLINE_ID,
        type: "line",
        source: SUBSTATION_POLYGONS_SOURCE_ID,
        paint: {
            "line-color": "#5e3bb0",
            "line-width": 1.2
        }
    });

    // labels
    if (hasGlyphs) {
        map.addLayer({
            id: SUBSTATION_POLYGONS_LABEL_ID,
            type: "symbol",
            source: SUBSTATION_POLYGONS_SOURCE_ID,
            layout: {
                "text-field": [
                    "coalesce",
                    ["get", "name"],
                    ["get", "operator"],
                    ""
                ],
                "text-size": 12,
                "text-offset": [0, 1.0],
                "text-anchor": "top"
            },
            paint: {
                "text-color": "#4b0082",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.5,
                "text-opacity": [
                    "interpolate", ["linear"], ["zoom"],
                    10, 0,
                    12, 0.7,
                    14, 1
                ]
            }
        });
    }

    layerAdded = true;
    console.log("[power-infra] Layer added (base polygons + capacity points)");
}

// ============================================
function togglePowerInfra() {
    if (!mapInstance || !layerAdded) return;

    isVisible = !isVisible;
    const v = isVisible ? "visible" : "none";

    [
        SUBSTATION_LAYER_ID,
        SUBSTATION_LABEL_ID,
        SUBSTATION_POLYGONS_FILL_ID,
        SUBSTATION_POLYGONS_OUTLINE_ID,
        SUBSTATION_POLYGONS_LABEL_ID
    ].forEach(id => {
        if (mapInstance.getLayer(id)) {
            mapInstance.setLayoutProperty(id, "visibility", v);
        }
    });

    console.log("[power-infra] visibility:", v);
}

// ============================================
export const PowerInfraLayer = {
    add: addPowerInfraLayer,
    toggle: togglePowerInfra,
    isVisible: () => isVisible,
    getData: () => infrastructureData
};
