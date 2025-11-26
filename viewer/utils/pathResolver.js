/**
 * pathResolver.js
 * Resolve data paths for different environments (localhost vs GitHub Pages)
 */

/**
 * Get the base path for data files
 * @returns {string} Base path ('../data' for both localhost and GitHub Pages)
 */
export function getDataBasePath() {
  // Both localhost (http://localhost:8000/viewer/) and GitHub Pages
  // (https://kanri-srhd.github.io/hazard-viewer/viewer/) serve from viewer/ directory
  // Data is always at ../data/ relative to viewer/
  return '../data';
}

/**
 * Resolve a data file path
 * @param {string} relativePath - Path relative to data/ directory (e.g., "power/osm/powerlines_osm.geojson")
 * @returns {string} Resolved path
 */
export function resolveDataPath(relativePath) {
  const basePath = getDataBasePath();
  return `${basePath}/${relativePath}`;
}
