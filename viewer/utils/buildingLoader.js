// ======================================================
// buildingLoader.js
// 建物タイル（GeoJSON）読み込み + centroid 計算
// 検索座標から最も近い建物の中心点を返す
// ======================================================

// ------------------------------------------------------
// 経緯度をタイル座標に変換（z=17固定）
// ------------------------------------------------------
function lngLatToTile(lng, lat, zoom) {
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    return { x, y };
}

// ------------------------------------------------------
// Polygon の centroid を計算（座標の平均）
// ------------------------------------------------------
function calculateCentroid(coordinates) {
    // coordinates: [ [[lng,lat], [lng,lat], ...] ] (Polygon)
    // または [ [[[lng,lat], ...]], [[[lng,lat], ...]] ] (MultiPolygon)
    
    let allPoints = [];
    
    // Polygon または MultiPolygon の最初のリングを使用
    if (coordinates[0] && Array.isArray(coordinates[0][0])) {
        if (typeof coordinates[0][0][0] === 'number') {
            // Polygon: [ [[lng,lat], ...] ]
            allPoints = coordinates[0];
        } else {
            // MultiPolygon: [ [[[lng,lat], ...]], ... ]
            allPoints = coordinates[0][0];
        }
    }
    
    if (allPoints.length === 0) return null;
    
    let sumLng = 0;
    let sumLat = 0;
    
    for (const point of allPoints) {
        sumLng += point[0];
        sumLat += point[1];
    }
    
    const centroidLng = sumLng / allPoints.length;
    const centroidLat = sumLat / allPoints.length;
    
    return { lng: centroidLng, lat: centroidLat };
}

// ------------------------------------------------------
// 2点間の距離（簡易版: 平面近似）
// ------------------------------------------------------
function distance(lng1, lat1, lng2, lat2) {
    const dx = lng1 - lng2;
    const dy = lat1 - lat2;
    return Math.sqrt(dx * dx + dy * dy);
}

// ------------------------------------------------------
// 建物タイル GeoJSON を取得
// ------------------------------------------------------
async function fetchBuildingTile(z, x, y) {
    const url = `https://cyberjapandata.gsi.go.jp/xyz/bldg/${z}/${x}/${y}.geojson`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            // 404 などは正常（建物がないタイル）
            return null;
        }
        
        const geojson = await response.json();
        return geojson;
        
    } catch (error) {
        console.warn(`[buildingLoader] Failed to fetch tile [${z}/${x}/${y}]:`, error);
        return null;
    }
}

// ------------------------------------------------------
// 3x3 タイルから建物を収集
// ------------------------------------------------------
async function fetchBuildingsAround(lng, lat) {
    const z = 17;  // 建物タイルは z=17
    const centerTile = lngLatToTile(lng, lat, z);
    
    console.log(`[buildingLoader] Center tile: z=${z}, x=${centerTile.x}, y=${centerTile.y}`);
    
    const buildings = [];
    
    // 3x3 タイルを取得
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const x = centerTile.x + dx;
            const y = centerTile.y + dy;
            
            const geojson = await fetchBuildingTile(z, x, y);
            
            if (geojson && geojson.features) {
                for (const feature of geojson.features) {
                    if (feature.geometry && feature.geometry.type === 'Polygon') {
                        const centroid = calculateCentroid(feature.geometry.coordinates);
                        if (centroid) {
                            buildings.push(centroid);
                        }
                    }
                }
            }
        }
    }
    
    console.log(`[buildingLoader] Found ${buildings.length} buildings`);
    
    return buildings;
}

// ------------------------------------------------------
// 検索座標から最も近い建物の centroid を返す
// ------------------------------------------------------
export async function findNearestBuildingCentroid(lng, lat) {
    console.log(`[buildingLoader] Searching for nearest building at [${lng}, ${lat}]`);
    
    try {
        // 3x3 タイルから建物を取得
        const buildings = await fetchBuildingsAround(lng, lat);
        
        if (buildings.length === 0) {
            console.warn('[buildingLoader] No buildings found, using original coordinates');
            return { lng, lat };
        }
        
        // 最も近い建物を探す
        let nearestBuilding = null;
        let minDistance = Infinity;
        
        for (const building of buildings) {
            const dist = distance(lng, lat, building.lng, building.lat);
            if (dist < minDistance) {
                minDistance = dist;
                nearestBuilding = building;
            }
        }
        
        if (nearestBuilding) {
            console.log(`[buildingLoader] ✓ Nearest building centroid: [${nearestBuilding.lng}, ${nearestBuilding.lat}] (distance: ${minDistance.toFixed(6)})`);
            return nearestBuilding;
        } else {
            console.warn('[buildingLoader] No valid building centroid, using original coordinates');
            return { lng, lat };
        }
        
    } catch (error) {
        console.error('[buildingLoader] Error finding building:', error);
        return { lng, lat };
    }
}
