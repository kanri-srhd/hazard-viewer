// viewer/layers/power.js - initial scaffold for power layers

import { powerMatrix } from "../../data/powerMatrix.js?v=20251126-01";

function addGeoJSONSource(map, sourceId, url) {
    if (map.getSource(sourceId)) return;
    map.addSource(sourceId, { type: "geojson", data: url });
}

function addLineLayer(map, layerId, sourceId) {
    if (map.getLayer(layerId)) return;
    map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        layout: { visibility: "none" },
        paint: {
            "line-color": [
                "case",
                [">=", ["coalesce", ["get", "voltage_kv"], -1], 500], "#d32f2f",
                [">=", ["coalesce", ["get", "voltage_kv"], -1], 275], "#f57c00",
                [">=", ["coalesce", ["get", "voltage_kv"], -1], 154], "#fbc02d",
                "#1976d2"
            ],
            "line-width": [
                "interpolate", ["linear"], ["zoom"],
                6, 1,
                12, 2,
                17, 3
            ],
            "line-opacity": 0.9
        }
    });
}

function addSymbolLayer(map, layerId, sourceId) {
    if (map.getLayer(layerId)) return;
    map.addLayer({
        id: layerId,
        type: "circle",
        source: sourceId,
        layout: { visibility: "none" },
        paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 10, 6, 14, 8],
            "circle-color": [
                "case",
                ["==", ["typeof", ["get", "available_kw"]], "number"],
                [
                    "interpolate", ["linear"], ["get", "available_kw"],
                    0, "#ff0000",
                    1000, "#ffaa00",
                    5000, "#00cc00",
                    10000, "#0066ff"
                ],
                "#455a64"
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.8
        }
    });
    
    // Add popup on click for capacity points
    map.on('click', layerId, (e) => {
        if (e.features.length === 0) return;
        const props = e.features[0].properties;
        const html = `
            <div style="font-family: sans-serif; font-size: 13px;">
                <div style="font-weight: bold; margin-bottom: 6px;">${props.name || props.id}</div>
                <div><strong>電力会社:</strong> ${props.utility || 'N/A'}</div>
                <div><strong>電圧:</strong> ${props.voltage_kv ? props.voltage_kv + ' kV' : 'N/A'}</div>
                <div><strong>空き容量:</strong> ${props.available_kw ? props.available_kw.toLocaleString() + ' kW' : 'N/A'}</div>
                <div><strong>更新:</strong> ${props.updated_at || 'N/A'}</div>
                ${props.matched_source ? `<div style="font-size: 11px; color: #666; margin-top: 4px;">Source: ${props.matched_source} (${props.confidence})</div>` : ''}
            </div>
        `;
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(html)
            .addTo(map);
    });
    
    // Change cursor on hover
    map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
    });
}

function addPointLayer(map, layerId, sourceId) {
    // capacity points as circle with popup later
    addSymbolLayer(map, layerId, sourceId);
}

export function initPowerLayers(map) {
    // remember map for toggles
    window._mapInstance = map;

    for (const [id, cfg] of Object.entries(powerMatrix)) {
        const sourceId = `power_src_${id}`;
        const layerId = `power_${id}`;

        // Use source path as-is (already relative from viewer/)
        const resolvedSource = cfg.source;

        // add source based on sourceType
        if (cfg.sourceType === "geojson") {
            addGeoJSONSource(map, sourceId, resolvedSource);
        } else if (cfg.sourceType === "json") {
            // Initialize empty GeoJSON source, then fetch and convert plain JSON to GeoJSON
            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            }
            try {
                fetch(resolvedSource)
                    .then(r => {
                        console.log(`[power] Fetching ${resolvedSource}`);
                        return r.json();
                    })
                    .then(arr => {
                        console.log(`[power] Loaded ${id}:`, arr);
                        // Expect array of objects with lat/lon - filter out null coordinates
                        const features = Array.isArray(arr) ? arr
                            .filter(item => item.lat != null && item.lon != null)
                            .map(item => ({
                                type: "Feature",
                                properties: item,
                                geometry: {
                                    type: "Point",
                                    coordinates: [item.lon, item.lat]
                                }
                            })) : [];
                        console.log(`[power] Created ${features.length} features for ${id}`);
                        const fc = { type: "FeatureCollection", features };
                        map.getSource(sourceId).setData(fc);
                    })
                    .catch(err => console.error(`[power] Failed to load JSON source ${resolvedSource}:`, err));
            } catch (e) {
                console.error(`[power] JSON source init error for ${id}:`, e);
            }
        } else {
            console.warn(`[power] Unsupported sourceType for ${id}: ${cfg.sourceType}`);
            continue;
        }

        // add layer based on type
        if (cfg.type === "line") {
            addLineLayer(map, layerId, sourceId);
        } else if (cfg.type === "symbol" || cfg.type === "point") {
            addSymbolLayer(map, layerId, sourceId);
        } else {
            console.warn(`[power] Unsupported layer type for ${id}: ${cfg.type}`);
            continue;
        }
    }
}

export function togglePower(id, visible) {
    const layerId = `power_${id}`;
    const map = window._mapInstance;
    if (!map || !map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}
