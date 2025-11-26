#!/usr/bin/env node
/**
 * geo_locator.js
 *
 * Enriches capacity CSV rows (no coordinates) with lat/lon by cascading lookup:
 * 0. Coordinate cache check (persistent across runs)
 * 1. Name normalization
 * 2. Nominatim (OSM) search with Japan filter
 * 3. (Stub) GSI place search (future)
 * 4. Grid lines fuzzy match (for transmission lines)
 * 5. OCCTO GeoJSON fuzzy match (optional)
 *
 * Output: JSON array with fields:
 *   id, name, name_original, name_normalized, utility, voltage_kv, available_kw,
 *   matched_source, lat, lon, confidence, notes, updated_at
 *
 * Usage:
 *   node tools/geo_locator.js \
 *        --input data/power/capacity/sample_capacity.csv \
 *        --out data/power/capacity/sample_capacity_located.json \
 *        --cache data/power/coordinate_cache.json \
 *        --occto data/power/substations/occto.geojson \
 *        --gridLines data/power/grid/grid_lines_osm.geojson \
 *        --aliases data/power/name_aliases.json \
 *        --max 200 \
 *        --delay 1100
 *
 * CSV expected columns (header row required):
 *   id,name,utility,voltage_kv,available_kw,updated_at
 *
 * Features:
 * - Coordinate caching: Saves geocoding results to avoid repeated API calls
 * - JSON Schema validation: Validates output against capacity_schema.json
 * - Transmission line detection: Skips Nominatim for lines ending with 線
 * - Alias support: Applies name transformations before geocoding
 *
 * Notes:
 * - Provide a valid email in USER_AGENT_EMAIL env for Nominatim etiquette.
 * - Rate limited: introduces delay between requests (default 1100ms).
 * - Cache improves performance and reduces API load on subsequent runs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load and compile JSON Schema for validation
const schemaPath = path.join(__dirname, 'schemas', 'capacity_schema.json');
let validate = null;
let ajv = null;

function loadSchema() {
  if (validate) return;
  
  if (!fs.existsSync(schemaPath)) {
    console.warn('[geo-locator] Schema not found, validation disabled:', schemaPath);
    return;
  }
  
  try {
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    ajv = new Ajv({ allErrors: true });
    validate = ajv.compile(schema);
    console.log('[geo-locator] Schema loaded and compiled');
  } catch (error) {
    console.warn('[geo-locator] Schema load failed, validation disabled:', error.message);
  }
}

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
const inputCsv = argv.input || argv.csv || path.resolve(__dirname, '../data/power/capacity/sample_capacity.csv');
const outJson = argv.out || path.resolve(__dirname, '../data/power/capacity/sample_capacity_located.json');
const occtoPath = argv.occto || null;
const gridLinesPath = argv.gridLines || path.resolve(__dirname, '../data/power/grid/grid_lines_osm.geojson');
const aliasesPath = argv.aliases || path.resolve(__dirname, '../data/power/name_aliases.json');
const cachePath = argv.cache || path.resolve(__dirname, '../data/power/coordinate_cache.json');
const maxRows = argv.max ? parseInt(argv.max, 10) : Infinity;
const delayMs = argv.delay ? parseInt(argv.delay, 10) : 1100; // polite ~1 req/sec
const USER_AGENT_EMAIL = process.env.USER_AGENT_EMAIL || 'example@example.com';

// Coordinate cache: {facility_name: {lat, lon, source, confidence, display_name, last_verified}}
let coordinateCache = {};

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

function readInput(fp) {
  if (!fs.existsSync(fp)) throw new Error('Input file not found: ' + fp);
  
  // Try JSON first
  if (fp.endsWith('.json')) {
    try {
      const text = fs.readFileSync(fp, 'utf8');
      const data = JSON.parse(text);
      // If it's already an array, use it directly
      if (Array.isArray(data)) {
        console.log(`[geo-locator] Loaded ${data.length} entries from JSON`);
        return data;
      }
      // If it has an entries property, use that
      if (data.entries && Array.isArray(data.entries)) {
        console.log(`[geo-locator] Loaded ${data.entries.length} entries from JSON`);
        return data.entries;
      }
      throw new Error('JSON must be an array or have an "entries" property');
    } catch (error) {
      throw new Error('Failed to parse JSON: ' + error.message);
    }
  }
  
  // Fallback to CSV parsing
  return readCSV(fp);
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

function loadCache(fp) {
  if (!fp) return {};
  if (!fs.existsSync(fp)) {
    console.log('[geo-locator] Cache file not found, starting with empty cache');
    return {};
  }
  try {
    const cache = JSON.parse(fs.readFileSync(fp, 'utf8'));
    console.log(`[geo-locator] Loaded ${Object.keys(cache).length} cached coordinates`);
    return cache;
  } catch (e) {
    console.warn('Failed to parse coordinate cache:', e.message);
    return {};
  }
}

function saveCache(fp, cache) {
  if (!fp) return;
  try {
    fs.writeFileSync(fp, JSON.stringify(cache, null, 2), 'utf8');
    console.log(`[geo-locator] Saved ${Object.keys(cache).length} coordinates to cache`);
  } catch (e) {
    console.error('Failed to save coordinate cache:', e.message);
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

// Load OSM substations GeoJSON
function loadOSMSubstations(fp) {
  if (!fp) return [];
  if (!fs.existsSync(fp)) {
    console.log('[geo-locator] OSM substations file not found');
    return [];
  }
  try {
    const gj = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const features = gj.features || [];
    console.log(`[geo-locator] Loaded ${features.length} OSM substations`);
    return features;
  } catch (e) {
    console.warn('Failed to parse OSM substations GeoJSON:', e.message);
    return [];
  }
}

// Match facility name against OSM substations
function matchOSMSubstation(facilityName, osmSubstations, maxDistanceKm = 10) {
  if (!osmSubstations || osmSubstations.length === 0) return null;
  
  const normalized = normalizeName(facilityName);
  
  // Extract candidates with similar names (Levenshtein distance < 3)
  const candidates = [];
  for (const feature of osmSubstations) {
    const osmName = feature.properties?.name || '';
    const osmNormalized = normalizeName(osmName);
    
    if (!osmNormalized) continue;
    
    const distance = lev(normalized, osmNormalized);
    
    // Accept if name match is close (distance <= 2) or exact substring match
    if (distance <= 2 || osmNormalized.includes(normalized) || normalized.includes(osmNormalized)) {
      const coords = feature.geometry?.coordinates || [];
      if (coords.length === 2) {
        candidates.push({
          name: osmName,
          lat: feature.geometry.type === 'Point' ? coords[1] : null,
          lon: feature.geometry.type === 'Point' ? coords[0] : null,
          distance: distance,
          feature: feature
        });
      }
    }
  }
  
  if (candidates.length === 0) return null;
  
  // Sort by name similarity (lower distance = better match)
  candidates.sort((a, b) => a.distance - b.distance);
  
  // Return best match
  const best = candidates[0];
  
  return {
    lat: best.lat,
    lon: best.lon,
    source: 'osm',
    confidence: best.distance === 0 ? 0.9 : best.distance === 1 ? 0.8 : 0.7,
    display_name: best.name,
    osm_id: best.feature.properties?.id || best.feature.id
  };
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

async function locateRow(row, occtoFeatures, gridLines, aliases, osmSubstations = []) {
  const original = row.name;
  let nameNorm = normalizeName(original);
  
  // Apply alias dictionary
  const aliased = applyAliases(nameNorm, aliases);
  if (aliased !== nameNorm) {
    nameNorm = aliased;
  }

  // Check cache first (before alias application, using original normalized name)
  const cacheKey = normalizeName(original);
  if (coordinateCache[cacheKey]) {
    const cached = coordinateCache[cacheKey];
    return {
      name_original: original,
      name_normalized: nameNorm,
      lat: cached.lat,
      lon: cached.lon,
      matched_source: 'cache',
      confidence: cached.confidence || 0.8,
      notes: `cached source=${cached.source} verified=${cached.last_verified || 'unknown'} display='${cached.display_name || ''}'`
    };
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
        const result = {
          name_original: original,
          name_normalized: nameNorm,
          lat: parseFloat(top.lat),
          lon: parseFloat(top.lon),
          matched_source: 'nominatim',
          confidence: 0.75,
          notes: `query='${q}' display='${top.display_name}'`
        };
        
        // Add to cache using original normalized name (before alias)
        coordinateCache[cacheKey] = {
          lat: result.lat,
          lon: result.lon,
          source: 'nominatim',
          confidence: result.confidence,
          display_name: top.display_name,
          last_verified: new Date().toISOString().split('T')[0]
        };
        
        return result;
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
    
    // If Nominatim failed, try OSM direct match for substations
    if (osmSubstations.length > 0) {
      const osmMatch = matchOSMSubstation(nameNorm, osmSubstations);
      if (osmMatch) {
        const result = {
          name_original: original,
          name_normalized: nameNorm,
          lat: osmMatch.lat,
          lon: osmMatch.lon,
          matched_source: 'osm',
          confidence: osmMatch.confidence,
          notes: `osm_id=${osmMatch.osm_id} display='${osmMatch.display_name}'`
        };
        
        // Add to cache
        coordinateCache[cacheKey] = {
          lat: result.lat,
          lon: result.lon,
          source: 'osm',
          confidence: result.confidence,
          display_name: osmMatch.display_name,
          last_verified: new Date().toISOString().split('T')[0]
        };
        
        return result;
      }
    }
  }

  // GSI stub (returns none) - deprecated in favor of OSM
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
    const result = {
      name_original: original,
      name_normalized: nameNorm,
      lat: gridMatch.lat,
      lon: gridMatch.lon,
      matched_source: gridMatch.matched_source,
      confidence: gridMatch.confidence,
      notes: gridMatch.notes
    };
    
    // Add to cache using original normalized name
    coordinateCache[cacheKey] = {
      lat: result.lat,
      lon: result.lon,
      source: gridMatch.matched_source,
      confidence: result.confidence,
      display_name: gridMatch.notes,
      last_verified: new Date().toISOString().split('T')[0]
    };
    
    return result;
  }

  // OCCTO fuzzy
  const occto = matchOCCTO(occtoFeatures, nameNorm);
  if (occto) {
    const result = {
      name_original: original,
      name_normalized: nameNorm,
      lat: occto.lat,
      lon: occto.lon,
      matched_source: occto.matched_source,
      confidence: occto.confidence,
      notes: occto.notes
    };
    
    // Add to cache using original normalized name
    coordinateCache[cacheKey] = {
      lat: result.lat,
      lon: result.lon,
      source: occto.matched_source,
      confidence: result.confidence,
      display_name: occto.notes,
      last_verified: new Date().toISOString().split('T')[0]
    };
    
    return result;
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
  console.log('[geo-locator] Input file:', inputCsv);
  
  // Load schema for validation
  loadSchema();
  
  // Load coordinate cache
  coordinateCache = loadCache(cachePath);
  
  const rows = readInput(inputCsv);
  console.log('[geo-locator] Rows:', rows.length);
  const occtoFeatures = loadOCCTO(occtoPath);
  console.log('[geo-locator] OCCTO features loaded:', occtoFeatures.length);
  const gridLines = loadGridLines(gridLinesPath);
  console.log('[geo-locator] Grid lines loaded:', gridLines.length);
  const aliases = loadAliases(aliasesPath);
  console.log('[geo-locator] Aliases loaded:', Object.keys(aliases.aliases || {}).length);
  
  // Load OSM substations
  const osmSubstationsPath = argv.osmSubstations || path.resolve(__dirname, '../data/power/osm/substations_osm.geojson');
  const osmSubstations = loadOSMSubstations(osmSubstationsPath);
  console.log('[geo-locator] OSM substations loaded:', osmSubstations.length);

  const out = [];
  const validEntries = [];
  const invalidEntries = [];
  let processed = 0;
  
  for (const row of rows) {
    if (processed >= maxRows) break;
    let located;
    try {
      located = await locateRow(row, occtoFeatures, gridLines, aliases, osmSubstations);
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
    
    const entry = {
      id: row.id,
      name: located.name_normalized,
      name_original: located.name_original,
      name_normalized: located.name_normalized,
      utility: row.utility || null,
      voltage_kv: row.voltage_kv != null ? parseFloat(row.voltage_kv) : null,
      available_kw: row.available_kw != null ? parseFloat(row.available_kw) : null,
      updated_at: row.updated_at || null,
      lat: located.lat,
      lon: located.lon,
      matched_source: located.matched_source,
      confidence: located.confidence,
      notes: located.notes
    };
    
    // Validate entry if schema is loaded
    if (validate) {
      const valid = validate(entry);
      if (!valid) {
        const errors = ajv.errorsText(validate.errors);
        console.warn(`\n[geo-locator] Validation failed for entry ${entry.id}: ${errors}`);
        invalidEntries.push({ entry, errors });
      } else {
        validEntries.push(entry);
      }
    }
    
    out.push(entry);
    processed++;
    process.stdout.write(`\rProcessed ${processed}/${Math.min(rows.length, maxRows)}`);
  }
  
  // Write output (includes both valid and invalid if validation is disabled)
  fs.writeFileSync(outJson, JSON.stringify(out, null, 2));
  console.log(`\n[geo-locator] Written: ${outJson}`);
  
  // Save updated cache
  saveCache(cachePath, coordinateCache);
  
  // Validation summary
  if (validate) {
    console.log(`[geo-locator] Validation: ${validEntries.length} valid, ${invalidEntries.length} invalid`);
    if (invalidEntries.length > 0) {
      console.log(`[geo-locator] Invalid entries:`);
      invalidEntries.forEach(({ entry, errors }) => {
        console.log(`  - ${entry.id}: ${errors}`);
      });
    }
  }
  // Unmatched summary
  const unmatched = out.filter(r => r.matched_source === 'unmatched').length;
  const matched = out.filter(r => r.matched_source !== 'unmatched' && r.matched_source !== 'error').length;
  const cached = out.filter(r => r.matched_source === 'cache').length;
  console.log(`[geo-locator] Matched: ${matched}, Cached: ${cached}, Unmatched: ${unmatched}`);
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
