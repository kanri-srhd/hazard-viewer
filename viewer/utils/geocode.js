// geocode.js
// 座標判定 → GSI API → {lng,lat} を返す

export function isCoordinate(input) {
    const parts = input.split(',');
    if (parts.length !== 2) return false;
    const a = parseFloat(parts[0]);
    const b = parseFloat(parts[1]);
    return !isNaN(a) && !isNaN(b);
}

export function parseCoordinate(input) {
    const parts = input.split(',');
    const a = parseFloat(parts[0]);
    const b = parseFloat(parts[1]);

    // 両方 -180〜180 に入る場合 lng,lat と判断
    if (a >= -180 && a <= 180 && b >= -90 && b <= 90) {
        return { lng: a, lat: b };
    }
    // lat,lng と判断
    return { lng: b, lat: a };
}

export async function geocodeAddress(input) {
    const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(input)}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.length === 0) return null;

    const p = data[0]?.geometry?.coordinates;
    if (!p) return null;

    return { lng: p[0], lat: p[1] };
}

export async function parseInput(input) {
    if (!input) return null;

    if (isCoordinate(input)) {
        return parseCoordinate(input);
    }
    return await geocodeAddress(input);
}
