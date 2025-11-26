#!/usr/bin/env node
/**
 * osm_kanto_export.js
 * 
 * Exports Kanto region (TEPCO area) power substations from OpenStreetMap.
 * Smaller area to avoid Overpass API timeouts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.resolve(__dirname, '../data/power/osm');

// Kanto region bounding box (TEPCO service area)
const KANTO_BOUNDS = {
  minLat: 34.5,  // South: Izu Islands
  minLon: 138.5, // West: Yamanashi
  maxLat: 37.0,  // North: Fukushima border
  maxLon: 141.0  // East: Pacific coast
};

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function overpassQuery(minLat, minLon, maxLat, maxLon) {
  return `[out:json][timeout:300];
(
  node["power"="substation"](${minLat},${minLon},${maxLat},${maxLon});
  way["power"="substation"](${minLat},${minLon},${maxLat},${maxLon});
  relation["power"="substation"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(`data=${encodeURIComponent(body)}`);
    req.end();
  });
}

function osmToGeoJSON(osm) {
  const nodeMap = {};
  const features = [];

  // Index nodes
  for (const el of osm.elements || []) {
    if (el.type === 'node') {
      nodeMap[el.id] = { lat: el.lat, lon: el.lon };
      
      // Point substations
      if (el.tags?.power === 'substation') {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
          properties: { 
            ...el.tags, 
            osm_type: 'node',
            osm_id: el.id,
            source: 'osm' 
          }
        });
      }
    }
  }

  // Process ways
  for (const el of osm.elements || []) {
    if (el.type === 'way' && el.tags?.power === 'substation') {
      const coords = (el.nodes || []).map(nid => {
        const n = nodeMap[nid];
        return n ? [n.lon, n.lat] : null;
      }).filter(c => c);
      
      if (coords.length > 0) {
        // Use centroid for substation location
        const centroid = coords.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0])
          .map(v => v / coords.length);
        
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: centroid },
          properties: {
            ...el.tags,
            osm_type: 'way',
            osm_id: el.id,
            source: 'osm'
          }
        });
      }
    }
  }

  return { type: 'FeatureCollection', features };
}

async function main() {
  console.log('='.repeat(60));
  console.log('OSM Kanto Region Substation Export');
  console.log('='.repeat(60));
  console.log(`Bounds: ${KANTO_BOUNDS.minLat}N to ${KANTO_BOUNDS.maxLat}N`);
  console.log(`        ${KANTO_BOUNDS.minLon}E to ${KANTO_BOUNDS.maxLon}E`);
  console.log('Target: power=substation nodes, ways, relations');
  console.log('='.repeat(60));

  ensureDir(outDir);

  const query = overpassQuery(
    KANTO_BOUNDS.minLat,
    KANTO_BOUNDS.minLon,
    KANTO_BOUNDS.maxLat,
    KANTO_BOUNDS.maxLon
  );

  console.log('\nQuerying Overpass API...');
  console.log('Endpoint: https://overpass-api.de/api/interpreter');
  console.log('Timeout: 300s\n');

  try {
    const response = await httpsPost('https://overpass-api.de/api/interpreter', query);
    const osm = JSON.parse(response.body);

    console.log(`✓ Received ${osm.elements?.length || 0} OSM elements`);

    const geoJSON = osmToGeoJSON(osm);
    console.log(`✓ Converted to ${geoJSON.features.length} substation features`);

    const outFile = path.join(outDir, 'substations_osm.geojson');
    fs.writeFileSync(outFile, JSON.stringify(geoJSON, null, 2));

    console.log(`\n✓ Written: ${outFile}`);
    console.log(`\nSummary:`);
    console.log(`  Total substations: ${geoJSON.features.length}`);
    
    // Count by type
    const byType = {};
    geoJSON.features.forEach(f => {
      const type = f.properties.osm_type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });
    
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // Sample names
    const named = geoJSON.features.filter(f => f.properties.name);
    console.log(`\nSample substation names (first 10):`);
    named.slice(0, 10).forEach(f => {
      const coords = f.geometry.coordinates;
      console.log(`  - ${f.properties.name} [${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}]`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('Export completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Overpass API may be overloaded - try again later');
    console.error('  2. Query timeout - try smaller bounding box');
    console.error('  3. Check network connection');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
