#!/usr/bin/env node
/**
 * geocode_regional_priority.js
 * 
 * Geocodes TEPCO capacity data in regional priority order.
 * Prioritizes regions with more substations (変電所) over transmission lines.
 * 
 * Strategy:
 * 1. Process regional systems first (tokyo23, kanagawa, saitama, chiba, etc.)
 *    - These have more substation facilities that can be geocoded via Nominatim
 * 2. Process kikan (基幹系統) last
 *    - Mostly high-voltage transmission lines that require grid line data
 * 
 * Usage:
 *   node tools/geocode_regional_priority.js \
 *        --input data/power/capacity/tepco_all_regions_entries_only.json \
 *        --out data/power/capacity/tepco_all_regions_geocoded.json \
 *        --cache data/power/coordinate_cache.json \
 *        --maxPerRegion 100
 * 
 * Output: Single JSON file with geocoded entries, ordered by region priority
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Regional priority order (substation-heavy regions first)
const REGION_PRIORITY = [
  { id: 'tokyo23', name: '東京都[23区]', priority: 1 },
  { id: 'kanagawa', name: '神奈川県', priority: 2 },
  { id: 'saitama', name: '埼玉県', priority: 3 },
  { id: 'chiba', name: '千葉県', priority: 4 },
  { id: 'ibaraki', name: '茨城県', priority: 5 },
  { id: 'gunma', name: '群馬県', priority: 6 },
  { id: 'tochigi', name: '栃木県', priority: 7 },
  { id: 'tama', name: '東京都[多摩地区]', priority: 8 },
  { id: 'shizuoka', name: '静岡県[富士川以東]', priority: 9 },
  { id: 'yamanashi', name: '山梨県', priority: 10 },
  { id: 'nagano', name: '長野県[一部]', priority: 11 },
  { id: 'fukushima', name: '福島県[一部]', priority: 12 },
  { id: 'niigata', name: '新潟県[一部]', priority: 13 },
  { id: 'kikan', name: '基幹系統（275kV以上）', priority: 14 } // Last - mostly transmission lines
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      out[key] = val;
      if (val !== true) i++;
    }
  }
  return out;
}

function analyzeRegion(entries, regionId) {
  const regionEntries = entries.filter(e => e.id.startsWith(`tepco_${regionId}_`));
  const substations = regionEntries.filter(e => e.name.includes('変電所') || e.name.includes('変圧器'));
  const transmissionLines = regionEntries.filter(e => e.name.endsWith('線') || e.name.endsWith('幹線'));
  const other = regionEntries.filter(e => 
    !e.name.includes('変電所') && 
    !e.name.includes('変圧器') && 
    !e.name.endsWith('線') && 
    !e.name.endsWith('幹線')
  );
  
  return {
    regionId,
    total: regionEntries.length,
    substations: substations.length,
    transmissionLines: transmissionLines.length,
    other: other.length,
    substationRatio: regionEntries.length > 0 ? (substations.length / regionEntries.length) : 0
  };
}

async function geocodeRegion(regionId, entries, cachePath, geoLocatorPath, maxEntries = null) {
  const regionEntries = entries.filter(e => e.id.startsWith(`tepco_${regionId}_`));
  
  if (regionEntries.length === 0) {
    console.log(`[regional] Skipping ${regionId}: no entries found`);
    return [];
  }
  
  // Create temporary input file for this region
  const tempInputPath = path.resolve(__dirname, `../data/power/capacity/temp_${regionId}_input.json`);
  const tempOutputPath = path.resolve(__dirname, `../data/power/capacity/temp_${regionId}_output.json`);
  
  const entriesToGeocode = maxEntries ? regionEntries.slice(0, maxEntries) : regionEntries;
  fs.writeFileSync(tempInputPath, JSON.stringify(entriesToGeocode, null, 2), 'utf-8');
  
  console.log(`\n[regional] Processing ${regionId}: ${entriesToGeocode.length} entries`);
  
  try {
    // Run geo_locator for this region
    const maxFlag = maxEntries ? `--max ${maxEntries}` : '';
    const cmd = `node "${geoLocatorPath}" --csv "${tempInputPath}" --out "${tempOutputPath}" --cache "${cachePath}" ${maxFlag}`;
    
    console.log(`[regional] Running: ${cmd.substring(0, 100)}...`);
    execSync(cmd, { stdio: 'inherit', cwd: path.dirname(__dirname) });
    
    // Read geocoded results
    if (fs.existsSync(tempOutputPath)) {
      const geocoded = JSON.parse(fs.readFileSync(tempOutputPath, 'utf-8'));
      
      // Cleanup temp files
      fs.unlinkSync(tempInputPath);
      fs.unlinkSync(tempOutputPath);
      
      console.log(`[regional] ✓ Completed ${regionId}: ${geocoded.length} entries geocoded`);
      return geocoded;
    } else {
      console.warn(`[regional] ✗ Output file not created for ${regionId}`);
      return [];
    }
  } catch (error) {
    console.error(`[regional] ✗ Error processing ${regionId}:`, error.message);
    
    // Cleanup temp files on error
    if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    
    return [];
  }
}

async function main() {
  const argv = parseArgs();
  const inputPath = argv.input || path.resolve(__dirname, '../data/power/capacity/tepco_all_regions_entries_only.json');
  const outputPath = argv.out || path.resolve(__dirname, '../data/power/capacity/tepco_all_regions_geocoded.json');
  const cachePath = argv.cache || path.resolve(__dirname, '../data/power/coordinate_cache.json');
  const geoLocatorPath = path.resolve(__dirname, 'geo_locator.js');
  const maxPerRegion = argv.maxPerRegion ? parseInt(argv.maxPerRegion, 10) : null;
  const regionsFilter = argv.regions ? argv.regions.split(',') : null; // Optional: specific regions only
  
  console.log('[regional] TEPCO Regional Priority Geocoding');
  console.log('[regional] ==========================================');
  console.log(`[regional] Input: ${inputPath}`);
  console.log(`[regional] Output: ${outputPath}`);
  console.log(`[regional] Cache: ${cachePath}`);
  console.log(`[regional] Max per region: ${maxPerRegion || 'unlimited'}`);
  
  // Load all entries
  const allEntries = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`[regional] Loaded ${allEntries.length} total entries`);
  
  // Analyze each region
  console.log('\n[regional] Regional analysis:');
  const regionStats = REGION_PRIORITY.map(r => {
    const stats = analyzeRegion(allEntries, r.id);
    console.log(`[regional]   ${r.name.padEnd(20)} - Total: ${stats.total.toString().padStart(4)}, Substations: ${stats.substations.toString().padStart(3)} (${(stats.substationRatio * 100).toFixed(1)}%), Lines: ${stats.transmissionLines.toString().padStart(3)}`);
    return { ...r, ...stats };
  });
  
  // Filter regions if specified
  const regionsToProcess = regionsFilter 
    ? regionStats.filter(r => regionsFilter.includes(r.id))
    : regionStats.filter(r => r.total > 0);
  
  console.log(`\n[regional] Processing ${regionsToProcess.length} regions in priority order...`);
  
  // Process each region sequentially
  const allGeocoded = [];
  for (const region of regionsToProcess) {
    const geocoded = await geocodeRegion(
      region.id,
      allEntries,
      cachePath,
      geoLocatorPath,
      maxPerRegion
    );
    allGeocoded.push(...geocoded);
    
    // Short delay between regions to be polite to Nominatim
    if (regionsToProcess.indexOf(region) < regionsToProcess.length - 1) {
      console.log('[regional] Waiting 3s before next region...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Write combined output
  fs.writeFileSync(outputPath, JSON.stringify(allGeocoded, null, 2), 'utf-8');
  console.log(`\n[regional] ==========================================`);
  console.log(`[regional] ✓ Wrote ${allGeocoded.length} geocoded entries to ${outputPath}`);
  
  // Summary statistics
  const withCoords = allGeocoded.filter(e => e.lat != null && e.lon != null).length;
  const bySource = {};
  allGeocoded.forEach(e => {
    bySource[e.matched_source] = (bySource[e.matched_source] || 0) + 1;
  });
  
  console.log(`[regional] Geocoding summary:`);
  console.log(`[regional]   Total entries: ${allGeocoded.length}`);
  console.log(`[regional]   With coordinates: ${withCoords} (${(withCoords / allGeocoded.length * 100).toFixed(1)}%)`);
  console.log(`[regional]   Without coordinates: ${allGeocoded.length - withCoords}`);
  console.log(`[regional] By source:`);
  Object.keys(bySource).sort((a, b) => bySource[b] - bySource[a]).forEach(src => {
    console.log(`[regional]   ${src}: ${bySource[src]}`);
  });
}

main().catch(error => {
  console.error('[regional] Fatal error:', error);
  process.exit(1);
});
