#!/usr/bin/env node

/**
 * hazardMatrix-generator.js
 * 
 * Auto-generates data/hazardMatrix.json and data/hazardMatrix.js
 * from GSI WMTS metadata (data/metadata_light.xml).
 * 
 * IMPORTANT: This maintains full backward compatibility with existing viewer code.
 */

import { readFile, writeFile } from 'fs/promises';
import { parseStringPromise } from 'xml2js';

// xml2js parser options for WMTS XML
const PARSER_OPTIONS = {
  explicitArray: true,
  mergeAttrs: false,
  explicitCharkey: false,
  trim: true
};

// ================================================================================
// CONFIGURATION
// ================================================================================

const XML_PATH = 'data/metadata_light.xml';
const JSON_OUTPUT = 'data/hazardMatrix.json';
const JS_OUTPUT = 'data/hazardMatrix.js';

// ================================================================================
// ID MAPPING: WMTS Identifier → Project layer ID
// ================================================================================
const ID_MAPPING = {
  // Flood
  "flood_l2_shinsuishin": "flood_l2_shinsuishin",
  "flood_l1_shinsuishin_newlegend": "flood_keikaku",

  // Landslide (existing project uses sediment_keikai)
  "kyukeishakeikaikuiki_all": "sediment_keikai",

  // Tsunami
  "tsunami_newlegend": "tsunami_newlegend",

  // Storm surge
  "hightide_l2_shinsuishin": "takashio_soutei",

  // Skip unused WMTS layers
  "flood_l2_shinsuishin_kuni": null,
  "flood_l1_shinsuishin_newlegend_kuni": null,
  "flood_l2_keizoku": null,
  "flood_l2_keizoku_kuni": null,
  "flood_l2_kaokutoukai_hanran": null,
  "flood_l2_kaokutoukai_hanran_kuni": null,
  "flood_l2_kaokutoukai_kagan": null,
  "flood_l2_kaokutoukai_kagan_kuni": null,
  "naisui": null,
  "dosekiryukeikaikuiki_all": null,
  "jisuberikeikaikuiki_all": null,
  "nadarekikenkasyo_all": null
};

// ================================================================================
// DIRECTORY MAPPING: WMTS directory → Project directory
// ================================================================================
const DIRECTORY_MAPPING = {
  "01_flood_l2_shinsuishin_data": "01_flood_l2_shinsuishin_data",
  "01_flood_l1_shinsuishin_newlegend_data": "02_flood_l2_keikakukibo_data",
  "05_kyukeishakeikaikuiki": "05_kyukeishakeikaikuiki",
  "04_tsunami_newlegend_data": "05_tsunami_newlegend_data",
  "03_hightide_l2_shinsuishin_data": "06_takashio_soutei_data",

  // Identity mappings to avoid undefined
  "01_flood_l2_shinsuishin_kuni_data": "01_flood_l2_shinsuishin_kuni_data",
  "02_naisui_data": "02_naisui_data",
  "05_dosekiryukeikaikuiki": "05_dosekiryukeikaikuiki",
  "05_jisuberikeikaikuiki": "05_jisuberikeikaikuiki"
};

// ================================================================================
// MANUAL LAYERS (not in WMTS)
// ================================================================================
const MANUAL_LAYERS = {
  jishin_kyouka: {
    title: "地震防災対策強化地域",
    id: "jishin_kyouka",
    directory: "07_jishin_kyouka",
    template: "https://disaportaldata.gsi.go.jp/raster/07_jishin_kyouka/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "地震防災対策強化地域",
      hazardGroup: "earthquake",
      hazardSubGroup: null,
      coverage: "national",
      prefCode: null,
      matrixSet: null
    }
  },

  road_kansui: {
    title: "道路冠水想定箇所",
    id: "road_kansui",
    directory: "08_road_kansui_data",
    template: "https://disaportaldata.gsi.go.jp/raster/08_road_kansui_data/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "道路冠水想定箇所",
      hazardGroup: "flood",
      hazardSubGroup: "road_inundation",
      coverage: "national",
      prefCode: null,
      matrixSet: null
    }
  },

  mlit_liquefaction: {
    title: "液状化（MLIT全国）",
    id: "mlit_liquefaction",
    directory: "liquefaction",
    template: "https://disaportal.mlit.go.jp/raster/liquefaction/{z}/{x}/{y}.png",
    prefOrData: "data",
    minzoom: 2,
    maxzoom: 17,
    metadata: {
      title: "液状化（MLIT全国）",
      hazardGroup: "liquefaction",
      hazardSubGroup: null,
      coverage: "national",
      prefCode: null,
      matrixSet: null
    }
  }
};

// ================================================================================
// LAYER OUTPUT ORDER
// ================================================================================
const LAYER_ORDER = [
  "flood_l2_shinsuishin",
  "flood_keikaku",
  "sediment_keikai",
  "tsunami_newlegend",
  "takashio_soutei",
  "jishin_kyouka",
  "road_kansui",
  "mlit_liquefaction"
];

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

/**
 * Classify hazard type from WMTS ID
 */
function classifyHazard(originalId) {
  if (!originalId) return { hazardGroup: "other", hazardSubGroup: null };

  if (originalId.startsWith("flood_l1_shinsuishin"))
    return { hazardGroup: "flood", hazardSubGroup: "L1" };

  if (originalId.startsWith("flood_l2_shinsuishin"))
    return { hazardGroup: "flood", hazardSubGroup: "L2" };

  if (originalId.includes("kyukeishakeikaikuiki"))
    return { hazardGroup: "landslide", hazardSubGroup: "steepSlope" };

  if (originalId.includes("dosekiryukeikaikuiki"))
    return { hazardGroup: "landslide", hazardSubGroup: "debrisFlow" };

  if (originalId.includes("jisuberikeikaikuiki"))
    return { hazardGroup: "landslide", hazardSubGroup: "landslide" };

  if (originalId === "tsunami_newlegend")
    return { hazardGroup: "tsunami", hazardSubGroup: null };

  if (originalId.includes("hightide"))
    return { hazardGroup: "storm_surge", hazardSubGroup: null };

  return { hazardGroup: "other", hazardSubGroup: null };
}

/**
 * Detect coverage type and prefecture code
 */
function detectCoverage(originalId) {
  if (!originalId) return { coverage: "unknown", prefCode: null };
  
  if (originalId.endsWith("_all"))
    return { coverage: "national", prefCode: null };
  
  const m = originalId.match(/_(\d{2})$/);
  if (m) return { coverage: "pref", prefCode: m[1] };
  
  return { coverage: "unknown", prefCode: null };
}

/**
 * Convert WMTS template to XYZ format
 */
function convertWMTStoXYZ(wmtsTemplate) {
  if (!wmtsTemplate) return null;
  
  return wmtsTemplate
    .replace(/{TileMatrix}/g, '{z}')
    .replace(/{TileCol}/g, '{x}')
    .replace(/{TileRow}/g, '{y}');
}

/**
 * Extract directory from XYZ template URL
 */
function extractDirectory(xyzTemplate) {
  if (!xyzTemplate) return null;
  
  const match = xyzTemplate.match(/\/raster\/([^/]+)\/\{z\}/);
  return match ? match[1] : null;
}

/**
 * Rebuild template URL with mapped directory
 */
function rebuildTemplate(originalTemplate, originalDirectory, mappedDirectory) {
  if (!originalTemplate || !originalDirectory || !mappedDirectory) {
    return originalTemplate;
  }
  
  const regex = new RegExp(`/raster/${originalDirectory}/`, 'g');
  return originalTemplate.replace(regex, `/raster/${mappedDirectory}/`);
}

/**
 * Determine prefOrData value
 */
function getPrefOrData(originalId) {
  if (!originalId) return "data";
  
  if (originalId.endsWith("_all")) return "data";
  
  const m = originalId.match(/_(\d{2})$/);
  if (m) return m[1];
  
  return "data";
}

/**
 * Order object by LAYER_ORDER, then alphabetically
 */
function orderLayers(hazardMatrix) {
  const ordered = {};
  
  // First, add layers in LAYER_ORDER
  for (const layerId of LAYER_ORDER) {
    if (layerId in hazardMatrix) {
      ordered[layerId] = hazardMatrix[layerId];
    }
  }
  
  // Then, add remaining layers alphabetically
  const remaining = Object.keys(hazardMatrix)
    .filter(key => !LAYER_ORDER.includes(key))
    .sort();
  
  for (const layerId of remaining) {
    ordered[layerId] = hazardMatrix[layerId];
  }
  
  return ordered;
}

/**
 * Validate layer entry
 */
function validateLayer(layerId, layer) {
  const errors = [];
  
  if (!layer.title) errors.push(`Missing title`);
  if (!layer.id) errors.push(`Missing id`);
  if (!layer.directory) errors.push(`Missing directory`);
  if (!layer.template) errors.push(`Missing template`);
  if (!layer.prefOrData) errors.push(`Missing prefOrData`);
  if (layer.minzoom === undefined) errors.push(`Missing minzoom`);
  if (layer.maxzoom === undefined) errors.push(`Missing maxzoom`);
  if (!layer.metadata) errors.push(`Missing metadata`);
  
  if (layer.template && !layer.template.includes('{z}')) {
    errors.push(`Template missing {z}`);
  }
  if (layer.template && !layer.template.includes('{x}')) {
    errors.push(`Template missing {x}`);
  }
  if (layer.template && !layer.template.includes('{y}')) {
    errors.push(`Template missing {y}`);
  }
  
  if (layer.metadata?.hazardGroup === "other") {
    console.warn(`⚠ Warning: ${layerId} has hazardGroup "other" - may need manual classification`);
  }
  
  return errors;
}

/**
 * Compare with existing hazardMatrix and log differences
 */
async function logDifferences(newMatrix) {
  try {
    const oldContent = await readFile(JSON_OUTPUT, 'utf-8');
    const oldMatrix = JSON.parse(oldContent);
    
    const oldKeys = new Set(Object.keys(oldMatrix));
    const newKeys = new Set(Object.keys(newMatrix));
    
    const added = [...newKeys].filter(k => !oldKeys.has(k));
    const removed = [...oldKeys].filter(k => !newKeys.has(k));
    const common = [...newKeys].filter(k => oldKeys.has(k));
    
    if (added.length > 0) {
      console.log(`\n➕ Added layers: ${added.join(', ')}`);
    }
    if (removed.length > 0) {
      console.log(`\n➖ Removed layers: ${removed.join(', ')}`);
    }
    
    const changed = [];
    for (const key of common) {
      const oldDir = oldMatrix[key].directory;
      const newDir = newMatrix[key].directory;
      const oldTpl = oldMatrix[key].template;
      const newTpl = newMatrix[key].template;
      
      if (oldDir !== newDir || oldTpl !== newTpl) {
        changed.push(key);
        console.log(`\n🔄 Changed: ${key}`);
        if (oldDir !== newDir) {
          console.log(`   directory: ${oldDir} → ${newDir}`);
        }
        if (oldTpl !== newTpl) {
          console.log(`   template: ${oldTpl} → ${newTpl}`);
        }
      }
    }
    
    if (added.length === 0 && removed.length === 0 && changed.length === 0) {
      console.log(`\n✓ No changes detected`);
    }
  } catch (err) {
    // File doesn't exist or can't be read - skip comparison
    console.log(`\n(No existing hazardMatrix.json found for comparison)`);
  }
}

// ================================================================================
// MAIN FUNCTION
// ================================================================================

async function main() {
  console.log('🚀 Starting hazardMatrix generation...\n');
  
  let processedCount = 0;
  let addedCount = 0;
  let skippedCount = 0;
  const errors = [];
  
  try {
    // Read and parse XML with xml2js
    console.log(`📄 Reading ${XML_PATH}...`);
    const xmlContent = await readFile(XML_PATH, 'utf-8');
    
    console.log(`🔍 Parsing WMTS metadata with xml2js...`);
    const parsed = await parseStringPromise(xmlContent, PARSER_OPTIONS);
    
    const layers = parsed?.Capabilities?.Contents?.[0]?.Layer;
    if (!layers || !Array.isArray(layers)) {
      throw new Error('No layers found in WMTS metadata');
    }
    
    console.log(`✓ Found ${layers.length} WMTS layers\n`);
    
    // Process WMTS layers
    const hazardMatrix = {};
    
    for (const layer of layers) {
      processedCount++;
      
      try {
        // Extract layer info
        const originalId = layer['ows:Identifier']?.[0];
        const originalTitle = layer['ows:Title']?.[0] ?? originalId;
        
        if (!originalId) {
          console.warn(`⚠ Skipping layer without identifier`);
          skippedCount++;
          continue;
        }
        
        // Apply ID mapping
        const mappedId = (originalId in ID_MAPPING) 
          ? ID_MAPPING[originalId] 
          : originalId;
        
        // Skip if mapped to null
        if (mappedId === null) {
          console.log(`⏩ Skipping: ${originalId} (mapped to null)`);
          skippedCount++;
          continue;
        }
        
        // Extract ResourceURL
        const resourceUrls = Array.isArray(layer.ResourceURL) 
          ? layer.ResourceURL 
          : (layer.ResourceURL ? [layer.ResourceURL] : []);
        
        const resourceUrl = resourceUrls.find(r => r.$ && r.$.resourceType === 'tile');
        const wmtsTemplate = resourceUrl?.$.template ?? null;
        
        if (!wmtsTemplate) {
          console.warn(`⚠ Skipping ${originalId}: no tile template found`);
          skippedCount++;
          continue;
        }
        
        // Convert to XYZ
        const xyzTemplate = convertWMTStoXYZ(wmtsTemplate);
        const originalDirectory = extractDirectory(xyzTemplate);
        
        if (!originalDirectory) {
          console.warn(`⚠ Skipping ${originalId}: cannot extract directory`);
          skippedCount++;
          continue;
        }
        
        // Apply directory mapping
        const mappedDirectory = DIRECTORY_MAPPING[originalDirectory] || originalDirectory;
        
        // Rebuild template
        const finalTemplate = rebuildTemplate(xyzTemplate, originalDirectory, mappedDirectory);
        
        // Get other properties
        const prefOrData = getPrefOrData(originalId);
        const { hazardGroup, hazardSubGroup } = classifyHazard(originalId);
        const { coverage, prefCode } = detectCoverage(originalId);
        const matrixSet = layer.TileMatrixSetLink?.[0]?.TileMatrixSet?.[0] ?? null;
        
        // Build layer entry
        hazardMatrix[mappedId] = {
          id: mappedId,
          title: originalTitle,
          directory: mappedDirectory,
          template: finalTemplate,
          prefOrData: prefOrData,
          minzoom: 2,
          maxzoom: 17,
          metadata: {
            title: originalTitle,
            hazardGroup,
            hazardSubGroup,
            coverage,
            prefCode,
            matrixSet
          }
        };
        
        addedCount++;
        console.log(`✓ Added: ${mappedId} (from ${originalId})`);
        
      } catch (err) {
        console.error(`❌ Error processing layer: ${err.message}`);
        errors.push(err.message);
        skippedCount++;
      }
    }
    
    // Merge manual layers
    console.log(`\n📦 Merging manual layers...`);
    Object.assign(hazardMatrix, MANUAL_LAYERS);
    addedCount += Object.keys(MANUAL_LAYERS).length;
    console.log(`✓ Added ${Object.keys(MANUAL_LAYERS).length} manual layers`);
    
    // Order layers
    console.log(`\n🔄 Ordering layers...`);
    const orderedMatrix = orderLayers(hazardMatrix);
    
    // Validate
    console.log(`\n✅ Validating ${Object.keys(orderedMatrix).length} layers...`);
    for (const [layerId, layer] of Object.entries(orderedMatrix)) {
      const validationErrors = validateLayer(layerId, layer);
      if (validationErrors.length > 0) {
        console.error(`❌ Validation errors for ${layerId}:`, validationErrors);
        errors.push(...validationErrors);
      }
    }
    
    if (errors.length === 0) {
      console.log(`✓ All layers validated successfully`);
    }
    
    // Log differences
    await logDifferences(orderedMatrix);
    
    // Write JSON
    console.log(`\n💾 Writing ${JSON_OUTPUT}...`);
    await writeFile(
      JSON_OUTPUT,
      JSON.stringify(orderedMatrix, null, 2),
      'utf-8'
    );
    console.log(`✓ JSON written`);
    
    // Write JS
    console.log(`💾 Writing ${JS_OUTPUT}...`);
    const jsContent = `// Auto-generated from data/metadata_light.xml by tools/hazardMatrix-generator.js
// DO NOT EDIT THIS FILE BY HAND.

export const hazardMatrix = ${JSON.stringify(orderedMatrix, null, 2)};

export default hazardMatrix;
`;
    await writeFile(JS_OUTPUT, jsContent, 'utf-8');
    console.log(`✓ JS written`);
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Generation complete!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 Summary:`);
    console.log(`   Processed ${processedCount} WMTS layers`);
    console.log(`   Added ${addedCount} entries (including manual layers)`);
    console.log(`   Skipped ${skippedCount} layers`);
    if (errors.length > 0) {
      console.log(`   ⚠ ${errors.length} errors encountered`);
    }
    console.log(`${'='.repeat(60)}\n`);
    
    process.exit(errors.length > 0 ? 1 : 0);
    
  } catch (err) {
    console.error(`\n❌ Fatal error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run
main();
