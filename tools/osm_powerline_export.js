#!/usr/bin/env node
/**
 * osm_powerline_export.js
 * 
 * Exports Kanto region power lines from OpenStreetMap.
 * Filters for high-voltage transmission lines (154kV+).
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
  way["power"="line"](${minLat},${minLon},${maxLat},${maxLon});
  relation["power"="line"](${minLat},${minLon},${maxLat},${maxLon});
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

function parseVoltage(voltageTag) {
  if (!voltageTag) return null;
  
  // Handle multiple voltages (e.g., "275000;154000")
  const voltages = voltageTag.split(/[;,]/).map(v => {
    const num = parseInt(v.trim());
    return isNaN(num) ? null : num;
  }).filter(v => v !== null);
  
  return voltages.length > 0 ? Math.max(...voltages) : null;
}

function osmToGeoJSON(osm) {
  const nodeMap = {};
  const features = [];

  // Index nodes for way reconstruction
  for (const el of osm.elements || []) {
    if (el.type === 'node') {
      nodeMap[el.id] = { lat: el.lat, lon: el.lon };
    }
  }

  // Process ways (power lines)
  for (const el of osm.elements || []) {
    if (el.type === 'way' && el.tags?.power === 'line') {
      const coords = [];
      
      // Reconstruct line geometry from node references
      for (const nodeId of el.nodes || []) {
        const node = nodeMap[nodeId];
        if (node) {
          coords.push([node.lon, node.lat]);
        }
      }
      
      if (coords.length < 2) continue; // Skip invalid lines
      
      const voltage = parseVoltage(el.tags.voltage);
      
      // Filter: Only include 154kV+ lines (or unknown voltage)
      if (voltage !== null && voltage < 154000) continue;
      
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
          name: el.tags.name || null,
          operator: el.tags.operator || null,
          voltage: el.tags.voltage || null,
          voltage_numeric: voltage,
          cables: el.tags.cables || null,
          circuits: el.tags.circuits || null,
          frequency: el.tags.frequency || null,
          osm_type: 'way',
          osm_id: el.id,
          source: 'osm'
        }
      });
    }
  }

  // Process relations (bundled power lines)
  for (const el of osm.elements || []) {
    if (el.type === 'relation' && el.tags?.power === 'line') {
      const lineCoords = [];
      
      // Relations contain multiple ways
      for (const member of el.members || []) {
        if (member.type === 'way') {
          const way = osm.elements.find(e => e.type === 'way' && e.id === member.ref);
          if (way) {
            const coords = [];
            for (const nodeId of way.nodes || []) {
              const node = nodeMap[nodeId];
              if (node) coords.push([node.lon, node.lat]);
            }
            if (coords.length >= 2) lineCoords.push(coords);
          }
        }
      }
      
      if (lineCoords.length === 0) continue;
      
      const voltage = parseVoltage(el.tags.voltage);
      
      // Filter: Only include 154kV+ lines (or unknown voltage)
      if (voltage !== null && voltage < 154000) continue;
      
      // Create MultiLineString or individual LineStrings
      if (lineCoords.length === 1) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: lineCoords[0] },
          properties: {
            name: el.tags.name || null,
            operator: el.tags.operator || null,
            voltage: el.tags.voltage || null,
            voltage_numeric: voltage,
            cables: el.tags.cables || null,
            circuits: el.tags.circuits || null,
            frequency: el.tags.frequency || null,
            osm_type: 'relation',
            osm_id: el.id,
            source: 'osm'
          }
        });
      } else {
        features.push({
          type: 'Feature',
          geometry: { type: 'MultiLineString', coordinates: lineCoords },
          properties: {
            name: el.tags.name || null,
            operator: el.tags.operator || null,
            voltage: el.tags.voltage || null,
            voltage_numeric: voltage,
            cables: el.tags.cables || null,
            circuits: el.tags.circuits || null,
            frequency: el.tags.frequency || null,
            osm_type: 'relation',
            osm_id: el.id,
            source: 'osm'
          }
        });
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

async function main() {
  ensureDir(outDir);

  const { minLat, minLon, maxLat, maxLon } = KANTO_BOUNDS;
  
  console.log(`[OSM Powerline Export] Kanto region: ${minLat},${minLon} to ${maxLat},${maxLon}`);
  console.log('[OSM Powerline Export] Querying Overpass API...');
  
  const query = overpassQuery(minLat, minLon, maxLat, maxLon);
  
  try {
    const res = await httpsPost('https://overpass-api.de/api/interpreter', query);
    console.log(`[OSM Powerline Export] Received ${res.body.length} bytes`);
    
    const osm = JSON.parse(res.body);
    console.log(`[OSM Powerline Export] Elements: ${osm.elements?.length || 0}`);
    
    const geojson = osmToGeoJSON(osm);
    console.log(`[OSM Powerline Export] Features (154kV+): ${geojson.features.length}`);
    
    const outPath = path.join(outDir, 'powerlines_osm.geojson');
    fs.writeFileSync(outPath, JSON.stringify(geojson, null, 2));
    console.log(`[OSM Powerline Export] Saved: ${outPath}`);
    
    // Statistics
    const voltageDistribution = {};
    const operatorDistribution = {};
    
    for (const feature of geojson.features) {
      const v = feature.properties.voltage || 'unknown';
      voltageDistribution[v] = (voltageDistribution[v] || 0) + 1;
      
      const op = feature.properties.operator || 'unknown';
      operatorDistribution[op] = (operatorDistribution[op] || 0) + 1;
    }
    
    console.log('\n[Statistics]');
    console.log('Voltage distribution:', voltageDistribution);
    console.log('Operator distribution:', operatorDistribution);
    
  } catch (err) {
    console.error('[OSM Powerline Export] Error:', err.message);
    process.exit(1);
  }
}

main();
