// ============================================
//  capacity.js
//  空き容量レイヤー（MapLibre）
// ============================================

let mapInstance = null;
let isVisible = false;
let layerAdded = false;

const SOURCE_ID = "capacity-src";
const LAYER_ID = "capacity-layer";

// 色と閾値
let styleData = null;

// --------------------------------------------
// JSONとstyleをロード
// --------------------------------------------
async function loadCapacityData() {
    const dataUrl = "../data/capacity/nationwide_v1.json";
    const styleUrl = "../data/capacity/style_v1.json";

    const data = await fetch(dataUrl).then(r => r.json());
    styleData = await fetch(styleUrl).then(r => r.json());

    return data;
}

// --------------------------------------------
// レイヤー登録
// --------------------------------------------
async function addCapacityLayer(map) {
    if (layerAdded) return;
    mapInstance = map;

    const data = await loadCapacityData();

    map.addSource(SOURCE_ID, {
        type: "geojson",
        data: data
    });

    // style_v1.json を step 式に変換
    const thresholds = styleData.thresholds;
    const colors = styleData.colors;

    const colorStep = [
        "step",
        ["get", "capacity_mw"],
        colors[4], thresholds[4],
        colors[3], thresholds[3],
        colors[2], thresholds[2],
        colors[1], thresholds[1],
        colors[0]
    ];

    map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
            "circle-radius": 6,
            "circle-color": colorStep,
            "circle-opacity": 0.85,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff"
        }
    });

    // popup
    map.on("click", LAYER_ID, (e) => {
        const p = e.features[0].properties;
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <b>${p.name}</b><br>
                空き容量: ${p.capacity_mw} MW<br>
                エリア: ${p.area}
            `)
            .addTo(map);
    });

    layerAdded = true;
}

// --------------------------------------------
// toggleLayer
// --------------------------------------------
export async function toggleLayer(show) {
    isVisible = show;
    console.log("[capacity] toggle:", isVisible);

    if (!mapInstance) mapInstance = window.map;

    if (!layerAdded) {
        await addCapacityLayer(mapInstance);
    }

    mapInstance.setLayoutProperty(
        LAYER_ID,
        "visibility",
        show ? "visible" : "none"
    );
}
