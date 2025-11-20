// ======================================================
// geocode.js
// 住所・地番・座標検索用ユーティリティ
// GSI 住所検索 API 統合
// ======================================================

// ------------------------------------------------------
// 座標形式かどうかを判定
// 例: "35.67, 139.87" or "35.67,139.87" or "lng,lat"
// ------------------------------------------------------
function isCoordinate(text) {
    if (!text) return false;
    
    const trimmed = text.trim();
    
    // カンマ区切りの数値ペアを検出
    const pattern = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;
    const match = trimmed.match(pattern);
    
    if (match) {
        const num1 = parseFloat(match[1]);
        const num2 = parseFloat(match[2]);
        
        // 数値として有効か確認
        return !isNaN(num1) && !isNaN(num2);
    }
    
    return false;
}

// ------------------------------------------------------
// 座標を解析（"lat,lng" or "lng,lat" 両対応）
// ------------------------------------------------------
function parseCoordinate(text) {
    const parts = text.split(',').map(s => parseFloat(s.trim()));
    const num1 = parts[0];
    const num2 = parts[1];
    
    // 緯度は -90 ~ 90, 経度は -180 ~ 180
    // 一般的に緯度の方が小さいので判定
    if (Math.abs(num1) <= 90 && Math.abs(num2) <= 180) {
        // lat, lng の順
        return { lat: num1, lng: num2 };
    } else if (Math.abs(num2) <= 90 && Math.abs(num1) <= 180) {
        // lng, lat の順
        return { lat: num2, lng: num1 };
    } else {
        // どちらも範囲外なら lng, lat と仮定
        return { lat: num2, lng: num1 };
    }
}

// ------------------------------------------------------
// メイン関数: 入力を解析して座標を返す
// 座標形式 → { lng, lat }
// 住所形式 → GSI API → { lng, lat }
// ------------------------------------------------------
export async function parseInput(query) {
    if (!query || !query.trim()) {
        console.warn('[geocode] Empty query');
        return null;
    }
    
    const trimmed = query.trim();
    
    // 座標形式チェック
    if (isCoordinate(trimmed)) {
        const coord = parseCoordinate(trimmed);
        console.log(`[geocode] Coordinate detected: [${coord.lng}, ${coord.lat}]`);
        return { lng: coord.lng, lat: coord.lat };
    }
    
    // 住所として検索
    console.log(`[geocode] Geocoding address: "${trimmed}"`);
    return await geocodeAddress(trimmed);
}

// ------------------------------------------------------
// GSI 住所検索 API でジオコーディング
// ------------------------------------------------------
async function geocodeAddress(address) {
    try {
        const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;
        
        console.log(`[geocode] API request: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`[geocode] API error: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        
        if (!data || data.length === 0) {
            console.warn(`[geocode] No results for "${address}"`);
            return null;
        }
        
        // 最初の結果を使用
        const firstResult = data[0];
        const geometry = firstResult.geometry;
        
        if (!geometry || !geometry.coordinates) {
            console.error('[geocode] Invalid geometry');
            return null;
        }
        
        // GeoJSON形式: [lng, lat]
        const lng = geometry.coordinates[0];
        const lat = geometry.coordinates[1];
        
        console.log(`[geocode] ✓ Found: [${lng}, ${lat}]`);
        
        return { lng, lat };
        
    } catch (error) {
        console.error('[geocode] Error:', error);
        return null;
    }
}
