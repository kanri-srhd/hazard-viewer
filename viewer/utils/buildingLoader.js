// ======================================================
// buildingLoader.js
// 建物タイル（GeoJSON）読み込み + centroid 計算
// 5×5 タイル範囲で検索
// ======================================================

// ------------------------------------------------------
// 経緯度をタイル座標に変換
// ------------------------------------------------------
function getTileXY(lng, lat, zoom) {
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    return { x, y };
}

// ------------------------------------------------------
// Polygon の centroid を計算（座標の平均）
// (cx, cy) = (Σlng / N, Σlat / N)
// ------------------------------------------------------
function calculateCentroid(coordinates) {
    // coordinates: [ [[lng,lat], [lng,lat], ...] ] (Polygon)
    
    let allPoints = [];
    
    // Polygon の最初のリング（外周）を使用
    if (coordinates[0] && Array.isArray(coordinates[0])) {
        allPoints = coordinates[0];
    }
    
    if (allPoints.length === 0) return null;
    
    let sumLng = 0;
    let sumLat = 0;
    
    for (const point of allPoints) {
        sumLng += point[0];
        sumLat += point[1];
    }
    
    const cx = sumLng / allPoints.length;
    const cy = sumLat / allPoints.length;
    
    return { lng: cx, lat: cy };
}

// ------------------------------------------------------
// 2点間の距離（簡易版: 平面近似）
// distance = sqrt((lng-lng0)^2 + (lat-lat0)^2)
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
            return null;  // 404 = 建物なし
        }
        
        const geojson = await response.json();
        return geojson;
        
    } catch (error) {
        return null;
    }
}

// ------------------------------------------------------
// 5×5 タイル範囲から建物を収集
// ------------------------------------------------------
async function fetchBuildingsAround(lng, lat) {
    const z = 17;  // 建物タイルは z=17 固定
    const centerTile = getTileXY(lng, lat, z);
    
    console.log(`[buildingLoader] Center tile: z=${z}, x=${centerTile.x}, y=${centerTile.y}`);
    
    const buildings = [];
    let tileCount = 0;
    
    // 5×5 タイル（±2）を取得
    for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
            const x = centerTile.x + dx;
            const y = centerTile.y + dy;
            
            const geojson = await fetchBuildingTile(z, x, y);
            tileCount++;
            
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
    
    console.log(`[buildingLoader] Fetched ${tileCount} tiles, found ${buildings.length} buildings`);
    
    return buildings;
}

// ------------------------------------------------------
// 検索座標から最も近い建物の centroid を返す
// 建物が見つからない場合は null を返す（fallback しない）
// ------------------------------------------------------
export async function findNearestBuildingCentroid(lng, lat) {
    console.log(`[buildingLoader] Searching for nearest building at [${lng}, ${lat}]`);
    
    try {
        // 5×5 タイルから建物を取得
        const buildings = await fetchBuildingsAround(lng, lat);
        
        if (buildings.length === 0) {
            console.warn('[buildingLoader] No buildings found');
            return null;  // 建物が見つからない場合は null
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
            console.log(`[buildingLoader] ✓ Nearest building centroid: [${nearestBuilding.lng}, ${nearestBuilding.lat}] (distance: ${minDistance.toFixed(8)})`);
            return nearestBuilding;
        }
        
        return null;
        
    } catch (error) {
        console.error('[buildingLoader] Error:', error);
        return null;
    }
}
