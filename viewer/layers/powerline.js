/**
 * powerline.js
 * 
 * Power transmission line layer for hazard-viewer.
 * Displays high-voltage power lines (154kV+) from OSM data.
 */

import { loadData } from '../utils/dataLoader.js';

/**
 * Load OSM power lines and add to map
 */
export async function addPowerlineLayer(map) {
  console.log('[powerline] Loading OSM power lines...');
  
  try {
    const geojson = await loadData({ type: 'geojson', url: '../data/power/osm/powerlines_osm.geojson' });
    
    if (!geojson || !geojson.features) {
      console.warn('[powerline] No powerline data found');
      return;
    }
    
    console.log(`[powerline] Loaded ${geojson.features.length} power lines`);
    
    // Add source
    map.addSource('powerlines-osm', {
      type: 'geojson',
      data: geojson
    });
    
    // Line layer (colored by voltage)
    map.addLayer({
      id: 'powerlines-osm-lines',
      type: 'line',
      source: 'powerlines-osm',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': [
          'case',
          ['>=', ['get', 'voltage_numeric'], 500000], '#ff0000', // 500kV: Red
          ['>=', ['get', 'voltage_numeric'], 275000], '#ff6600', // 275kV: Orange
          ['>=', ['get', 'voltage_numeric'], 154000], '#ffaa00', // 154kV: Yellow-Orange
          '#cccccc' // Unknown: Gray
        ],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7, 1,
          10, 2,
          13, 3
        ],
        'line-opacity': 0.7
      }
    });
    
    // Add popup on click
    map.on('click', 'powerlines-osm-lines', (e) => {
      const props = e.features[0].properties;
      
      const voltage = props.voltage || 'Unknown';
      const operator = props.operator || 'Unknown';
      const name = props.name || 'Unnamed';
      const cables = props.cables || 'Unknown';
      const circuits = props.circuits || 'Unknown';
      
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <strong>Power Line</strong><br>
            <strong>Name:</strong> ${name}<br>
            <strong>Voltage:</strong> ${voltage}<br>
            <strong>Operator:</strong> ${operator}<br>
            <strong>Cables:</strong> ${cables}<br>
            <strong>Circuits:</strong> ${circuits}<br>
            <small>Source: OSM (${props.osm_type}:${props.osm_id})</small>
          </div>
        `)
        .addTo(map);
    });
    
    // Change cursor on hover
    map.on('mouseenter', 'powerlines-osm-lines', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'powerlines-osm-lines', () => {
      map.getCanvas().style.cursor = '';
    });
    
    console.log('[powerline] Layer added successfully');
    
  } catch (err) {
    console.error('[powerline] Error loading layer:', err);
  }
}

/**
 * Toggle powerline layer visibility
 */
export function togglePowerlineLayer(map, visible) {
  const visibility = visible ? 'visible' : 'none';
  
  if (map.getLayer('powerlines-osm-lines')) {
    map.setLayoutProperty('powerlines-osm-lines', 'visibility', visibility);
  }
}
