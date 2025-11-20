// ======================================================
// geocode.js
// 住所・地番・座標検索用ユーティリティ
// GSI 住所検索 API 統合
// 建物探索指示あり
// ======================================================

// ------------------------------------------------------
// 1. 入力文字列の正規化（全角→半角、丁目番号号変換）
// ------------------------------------------------------
export function normalizeQuery(text) {
    if (!text) return '';
    
    let normalized = text.trim();
    
    // 全角数字を半角に変換
    normalized = normalized.replace(/[０-９]/g, (char) => {
        return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
    });
    
    // ○丁目○番○号 → ○-○-○ 形式に変換（GSI APIは両方対応だが統一）
    normalized = normalized
        .replace(/丁目/g, '-')
        .replace(/番地?/g, '-')
        .replace(/号/g, '');
    
    // 連続するハイフンを1つにまとめる
    normalized = normalized.replace(/-+/g, '-');
    
    // 末尾のハイフンを削除
    normalized = normalized.replace(/-$/, '');
    
    console.log(`[geocode] normalizeQuery: "${text}" → "${normalized}"`);
    
    return normalized;
}

// ------------------------------------------------------
// 2. 座標形式かどうかを判定
// 例: "35.67, 139.87" or "35.67,139.87"
// ------------------------------------------------------
export function isLatLng(text) {
    if (!text) return false;
    
    const trimmed = text.trim();
    
    // カンマ区切りの数値ペアを検出
    const pattern = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;
    const match = trimmed.match(pattern);
    
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        
        // 緯度: -90 ~ 90, 経度: -180 ~ 180
        const isValidLat = lat >= -90 && lat <= 90;
        const isValidLng = lng >= -180 && lng <= 180;
        
        console.log(`[geocode] isLatLng: "${text}" → lat=${lat}, lng=${lng}, valid=${isValidLat && isValidLng}`);
        
        return isValidLat && isValidLng;
    }
    
    return false;
}

// ------------------------------------------------------
// 3. 入力を解析して座標を返す
// 座標形式なら parseFloat、それ以外は geocodeAddress
// ★ 住所/地番検索の場合は needsBuildingSearch: true を返す
// ------------------------------------------------------
export async function parseInput(query) {
    const normalized = normalizeQuery(query);
    
    if (!normalized) {
        console.warn('[geocode] Empty query');
        return null;
    }
    
    // 座標形式チェック
    if (isLatLng(normalized)) {
        const parts = normalized.split(',').map(s => s.trim());
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        
        console.log(`[geocode] parseInput: Detected coordinate [${lng}, ${lat}]`);
        
        // 座標入力の場合は建物検索不要
        return { lng, lat, needsBuildingSearch: false };
    }
    
    // 住所・地番検索
    console.log(`[geocode] parseInput: Geocoding address/chiban "${normalized}"`);
    const result = await geocodeAddress(normalized);
    
    if (result) {
        // 住所/地番検索の場合は建物検索が必要
        return { ...result, needsBuildingSearch: true };
    }
    
    return null;
}

// ------------------------------------------------------
// 4. 住所・地番を GSI API でジオコーディング
// ------------------------------------------------------
export async function geocodeAddress(address) {
    try {
        // GSI 住所検索API（順ジオコーディング）
        const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;
        
        console.log(`[geocode] Requesting: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`[geocode] API error: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        
        // 結果チェック
        if (!data || data.length === 0) {
            console.warn(`[geocode] No results found for "${address}"`);
            return null;
        }
        
        // 最初の結果を使用
        const firstResult = data[0];
        const geometry = firstResult.geometry;
        
        if (!geometry || !geometry.coordinates) {
            console.error('[geocode] Invalid geometry in response');
            return null;
        }
        
        // GeoJSON形式: [lng, lat]
        const lng = geometry.coordinates[0];
        const lat = geometry.coordinates[1];
        
        const title = firstResult.properties?.title || address;
        
        console.log(`[geocode] ✓ Found: "${title}" → [${lng}, ${lat}]`);
        
        return { lng, lat, title };
        
    } catch (error) {
        console.error('[geocode] Error during geocoding:', error);
        return null;
    }
}
