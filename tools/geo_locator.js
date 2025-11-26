#!/usr/bin/env node
/**
 * geo_locator.js
 *
 * Enriches capacity CSV rows (no coordinates) with lat/lon by cascading lookup:
 * 1. Name normalization
 * 2. Nominatim (OSM) search
 * 3. (Stub) GSI place search (future)
 * 4. OCCTO GeoJSON fuzzy match (optional)
 *
 * Output: JSON array with fields:
 *   id, name_original, name_normalized, utility, voltage_kv, available_kw,
 *   matched_source, lat, lon, confidence, notes, updated_at
 *
 * Usage:
 *   node tools/geo_locator.js --input data/power/capacity/sample_capacity.csv \
 *        --out data/power/capacity/sample_capacity_located.json \
 *        --occto data/power/substations/occto.geojson --max 200
 *
 * CSV expected columns (header row required):
 *   id,name,utility,voltage_kv,available_kw,updated_at
 *
 * Notes:
 * - Provide a valid email in USER_AGENT_EMAIL env for Nominatim etiquette.
 * - Rate limited: introduces delay between requests.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      out[key] = val;
    }
  }
  return out;
}

const argv = parseArgs();
const inputCsv = argv.input || path.resolve(__dirname, '../data/power/capacity/sample_capacity.csv');
const outJson = argv.out || path.resolve(__dirname, '../data/power/capacity/sample_capacity_located.json');
const occtoPath = argv.occto || null;
const gridLinesPath = argv.gridLines || path.resolve(__dirname, '../data/power/grid/grid_lines_osm.geojson');
const aliasesPath = argv.aliases || path.resolve(__dirname, '../data/power/name_aliases.json');
const maxRows = argv.max ? parseInt(argv.max, 10) : Infinity;
const delayMs = argv.delay ? parseInt(argv.delay, 10) : 1100; // polite ~1 req/sec
const USER_AGENT_EMAIL = process.env.USER_AGENT_EMAIL || 'example@example.com';

// Simple full-width to half-width conversion
function toHalfWidth(str) {
  return str.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
            .replace(/　/g, ' ');
}

// Name normalization rules
function normalizeName(name) {
  if (!name) return '';
  let n = name.trim();
  n = toHalfWidth(n);
  // Common suffix standardization
  n = n.replace(/変電所?$/i, '変電所');
  n = n.replace(/線$/i, '線');
  // Remove voltage markers in parentheses e.g. (154kV)
  n = n.replace(/\(\s*\d+\s*k?V\s*\)/gi, '').trim();
  // Canonical spacing
  n = n.replace(/\s+/g, ' ');
  return n;
}

function readCSV(fp) {
  if (!fs.existsSync(fp)) throw new Error('Input CSV not found: ' + fp);
  const text = fs.readFileSync(fp, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const header = lines.shift().split(',').map(h => h.trim());
  return lines.map(line => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((h, i) => obj[h] = cols[i] ? cols[i].trim() : '');
    return obj;
  });
}

function loadOCCTO(fp) {
  if (!fp) return [];
  if (!fs.existsSync(fp)) return [];
  try {
    const gj = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return gj.features || [];
  } catch (e) {
    console.warn('Failed to parse OCCTO GeoJSON:', e.message);
    return [];
  }
}

function loadGridLines(fp) {
  if (!fp) return [];
  if (!fs.existsSync(fp)) return [];
  try {
    const gj = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return gj.features || [];
  } catch (e) {
    console.warn('Failed to parse grid lines GeoJSON:', e.message);
    return [];
  }
}

function loadAliases(fp) {
  if (!fp) return {};
  if (!fs.existsSync(fp)) return {};
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    console.warn('Failed to parse aliases JSON:', e.message);
    return {};
  }
}

function applyAliases(name, aliases) {
  if (!aliases || !aliases.aliases) return name;
  return aliases.aliases[name] || name;
}

// Levenshtein distance
function lev(a, b) {
  const m = [];
  for (let i = 0; i <= a.length; i++) m[i] = [i];
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': `geo-locator/1.0 (${USER_AGENT_EMAIL})` } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error('HTTP ' + res.statusCode));
        }
      });
    }).on('error', reject);
  });
}

async function queryNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=jp&q=${encodeURIComponent(q)}`;
  try {
    const body = await httpsGet(url);
    return JSON.parse(body);
  } catch (e) {
    return [];
  }
}

// Stub for GSI search (placeholder)
async function queryGSI(q) {
  // Future: implement actual endpoint. Return empty for now.
  return [];
}

function matchOCCTO(occtoFeatures, nameNorm) {
  let best = null;
  let bestScore = Infinity;
  for (const f of occtoFeatures) {
    const n = normalizeName(f.properties?.name || '');
    if (!n) continue;
    const d = lev(nameNorm, n);
    if (d < bestScore) {
      bestScore = d;
      best = f;
    }
  }
  if (best && bestScore <= Math.max(2, Math.floor(nameNorm.length * 0.2))) {
    const geom = best.geometry;
    let lon = null, lat = null;
    if (geom.type === 'Point') {
      [lon, lat] = geom.coordinates;
    } else if (geom.type === 'Polygon') {
      [lon, lat] = geom.coordinates[0][0];
    } else if (geom.type === 'LineString') {
      [lon, lat] = geom.coordinates[Math.floor(geom.coordinates.length / 2)];
    }
    return { lon, lat, confidence: 0.7, matched_source: 'occto_fuzzy', notes: `lev=${bestScore}` };
  }
  return null;
}

function matchGridLines(gridLines, nameNorm) {
  // Match transmission line names in OSM grid_lines_osm.geojson
  let best = null;
  let bestScore = Infinity;
  for (const f of gridLines) {
    const n = normalizeName(f.properties?.name || '');
    if (!n) continue;
    const d = lev(nameNorm, n);
    if (d < bestScore) {
      bestScore = d;
      best = f;
    }
  }
  if (best && bestScore <= Math.max(2, Math.floor(nameNorm.length * 0.2))) {
    const geom = best.geometry;
    let lon = null, lat = null;
    if (geom.type === 'LineString' && geom.coordinates.length) {
      const mid = Math.floor(geom.coordinates.length / 2);
      [lon, lat] = geom.coordinates[mid];
    } else if (geom.type === 'Point') {
      [lon, lat] = geom.coordinates;
    } else if (geom.type === 'Polygon' && geom.coordinates[0].length) {
      [lon, lat] = geom.coordinates[0][0];
    }
    return { lon, lat, confidence: 0.75, matched_source: 'osm_grid_lines', notes: `lev=${bestScore} name='${best.properties?.name}'` };
  }
  return null;
}

async function locateRow(row, occtoFeatures, gridLines, aliases) {
  const original = row.name;
  let nameNorm = normalizeName(original);
  
  // Apply alias dictionary
  const aliased = applyAliases(nameNorm, aliases);
  if (aliased !== nameNorm) {
    nameNorm = aliased;
  }

  // Detect transmission line (ends with 線) -> skip Nominatim, go straight to grid_lines
  const isTransmissionLine = /線$/.test(nameNorm);

  if (!isTransmissionLine) {
    // Try Nominatim variations for substations only
    const queries = [];
    if (/変電所/.test(nameNorm)) queries.push(nameNorm);
    else queries.push(nameNorm + ' 変電所');

    for (const q of queries) {
      const res = await queryNominatim(q);
      if (res && res.length) {
        const top = res[0];
        return {
          name_original: original,
          name_normalized: nameNorm,
          lat: parseFloat(top.lat),
          lon: parseFloat(top.lon),
          matched_source: 'nominatim',
          confidence: 0.75,
          notes: `query='${q}' display='${top.display_name}'`
        };
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // GSI stub (returns none)
  const gsi = await queryGSI(nameNorm);
  if (gsi.length) {
    const g = gsi[0];
    return {
      name_original: original,
      name_normalized: nameNorm,
      lat: g.lat,
      lon: g.lon,
      matched_source: 'gsi',
      confidence: 0.55,
      notes: 'gsi_stub'
    };
  }

  // Grid lines (for transmission lines)
  const gridMatch = matchGridLines(gridLines, nameNorm);
  if (gridMatch) {
    return {
      name_original: original,
      name_normalized: nameNorm,
      lat: gridMatch.lat,
      lon: gridMatch.lon,
      matched_source: gridMatch.matched_source,
      confidence: gridMatch.confidence,
      notes: gridMatch.notes
    };
  }

  // OCCTO fuzzy
  const occto = matchOCCTO(occtoFeatures, nameNorm);
  if (occto) {
    return {
      name_original: original,
      name_normalized: nameNorm,
      lat: occto.lat,
      lon: occto.lon,
      matched_source: occto.matched_source,
      confidence: occto.confidence,
      notes: occto.notes
    };
  }

  return {
    name_original: original,
    name_normalized: nameNorm,
    lat: null,
    lon: null,
    matched_source: 'unmatched',
    confidence: 0.0,
    notes: 'no_match'
  };
}

async function main() {
  console.log('[geo-locator] Input CSV:', inputCsv);
  const rows = readCSV(inputCsv);
  console.log('[geo-locator] Rows:', rows.length);
  const occtoFeatures = loadOCCTO(occtoPath);
  console.log('[geo-locator] OCCTO features loaded:', occtoFeatures.length);
  const gridLines = loadGridLines(gridLinesPath);
  console.log('[geo-locator] Grid lines loaded:', gridLines.length);
  const aliases = loadAliases(aliasesPath);
  console.log('[geo-locator] Aliases loaded:', Object.keys(aliases.aliases || {}).length);

  const out = [];
  let processed = 0;
  for (const row of rows) {
    if (processed >= maxRows) break;
    let located;
    try {
      located = await locateRow(row, occtoFeatures, gridLines, aliases);
    } catch (e) {
      located = {
        name_original: row.name,
        name_normalized: normalizeName(row.name),
        lat: null,
        lon: null,
        matched_source: 'error',
        confidence: 0.0,
        notes: String(e && e.message || e)
      };
    }
    out.push({
      id: row.id,
      name_original: located.name_original,
      name_normalized: located.name_normalized,
      utility: row.utility || null,
      voltage_kv: row.voltage_kv ? parseInt(row.voltage_kv, 10) : null,
      available_kw: row.available_kw ? parseFloat(row.available_kw) : null,
      updated_at: row.updated_at || null,
      lat: located.lat,
      lon: located.lon,
      matched_source: located.matched_source,
      confidence: located.confidence,
      notes: located.notes
    });
    processed++;
    process.stdout.write(`\rProcessed ${processed}/${Math.min(rows.length, maxRows)}`);
  }
  fs.writeFileSync(outJson, JSON.stringify(out, null, 2));
  console.log(`\n[geo-locator] Written: ${outJson}`);
  // Unmatched summary
  const unmatched = out.filter(r => r.matched_source === 'unmatched').length;
  const matched = out.filter(r => r.matched_source !== 'unmatched' && r.matched_source !== 'error').length;
  console.log(`[geo-locator] Matched: ${matched}, Unmatched: ${unmatched}`);
}

// Ensure main runs on Windows where import.meta.url uses file:///C:/... format
try {
  const currentFile = fileURLToPath(import.meta.url);
  if (currentFile === __filename) {
    main().catch(e => { console.error(e); process.exit(1); });
  } else {
    // Fallback: always run
    main().catch(e => { console.error(e); process.exit(1); });
  }
} catch (e) {
  // Fallback run if URL comparison fails
  main().catch(err => { console.error(err); process.exit(1); });
}
