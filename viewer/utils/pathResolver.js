/**
 * pathResolver.js
 * Resolve data paths for different environments (localhost vs GitHub Pages)
 */

/**
 * Get the base path for data files
 * @returns {string} Base path (e.g., "../data" for localhost, "./data" for GitHub Pages)
 */
export function getDataBasePath() {
  // Check if running on GitHub Pages
  if (window.location.hostname === 'kanri-srhd.github.io') {
    return './data';
  }
  // Local development
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
