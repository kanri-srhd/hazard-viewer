// tools/filter_capacity_japan_only.js
// Purge foreign (Korea/China/Russia) entries from capacity JSON using name+geofence rules
// Usage: node tools/filter_capacity_japan_only.js

import fs from 'fs';
import path from 'path';

const CAP_PATH = path.resolve('data/power/capacity/tepco_substations_all_matched.json');

const JAPAN_BBOX = { minLat: 24.0, maxLat: 45.5, minLon: 123.0, maxLon: 148.0 };

const hasHangul = (n) => /[\uAC00-\uD7AF]/.test(n||'');
const hasCyrillic = (n) => /[\u0400-\u04FF]/.test(n||'');

function isJapanLatLon(lat, lon) {
  if (lat == null || lon == null) return false;
  if (lat < JAPAN_BBOX.minLat || lat > JAPAN_BBOX.maxLat || lon < JAPAN_BBOX.minLon || lon > JAPAN_BBOX.maxLon) return false;
  // Korea peninsula
  if (lat <= 38.0 && lon < 128.0) return false;
  // Primorsky/Amur coast
  if (lat > 43.0 && lon > 131.0 && lon < 142.0) return false;
  // Sakhalin/North Kurils
  if (lon > 142.0 && lat > 44.0) return false;
  // Northeastern China (Jilin/Heilongjiang) approx
  if (lat > 41.0 && lon < 130.0) return false;
  return true;
}

function shouldKeep(entry) {
  const name = entry.name || '';
  const lat = entry.lat; const lon = entry.lon;
  // Language blacklist
  if (hasHangul(name) || hasCyrillic(name)) return false;
  // Known foreign dataset marker
  if ((name||'').toLowerCase().includes('north korea uncovered')) return false;
  // Geofence
  if (!isJapanLatLon(lat, lon)) return false;
  return true;
}

function main() {
  console.log('[capacity-filter] Loading capacity...');
  const arr = JSON.parse(fs.readFileSync(CAP_PATH, 'utf8'));
  const before = arr.length;
  const kept = arr.filter(shouldKeep);
  const removed = before - kept.length;
  console.log(`[capacity-filter] Before: ${before}, After: ${kept.length}, Removed: ${removed}`);
  if (removed > 0) {
    fs.writeFileSync(CAP_PATH, JSON.stringify(kept, null, 2), 'utf8');
    console.log('[capacity-filter] Saved filtered capacity to', CAP_PATH);
  } else {
    console.log('[capacity-filter] No changes needed');
  }
}

main();
