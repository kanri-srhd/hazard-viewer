/**
 * TEPCOCapacityFetcher - TEPCO power capacity data fetcher
 * 
 * Fetches and parses capacity data from Tokyo Electric Power Company (TEPCO).
 * 
 * Current implementation: Mock data for development
 * TODO: Implement actual TEPCO CSV/API fetching once source URL is confirmed
 */

import { CapacityFetcher } from './base.js';
import { readFile } from 'fs/promises';
import { parse } from 'csv-parse/sync';

export class TEPCOCapacityFetcher extends CapacityFetcher {
  constructor(config = {}) {
    super({
      utility: 'TEPCO',
      sourceUrl: config.sourceUrl || 'https://www.tepco.co.jp/forecast/html/capacity_data.csv', // TODO: Verify actual URL
      options: {
        rateLimit: 1000,
        maxRetries: 3,
        ...config.options
      }
    });

    this.csvPath = config.csvPath; // Optional: local CSV file for testing
  }

  /**
   * Fetch raw CSV data from TEPCO
   * Currently reads from local file for development
   */
  async fetchRawData() {
    // If local CSV path provided, read from file (for development)
    if (this.csvPath) {
      console.log(`[${this.utility}] Reading from local file: ${this.csvPath}`);
      return await readFile(this.csvPath, 'utf-8');
    }

    // TODO: Implement actual HTTP fetch from TEPCO website
    // Example:
    // const response = await fetch(this.sourceUrl, {
    //   headers: { 'User-Agent': 'hazard-viewer/1.0' }
    // });
    // return await response.text();

    throw new Error('TEPCO sourceUrl not yet implemented. Use csvPath for local testing.');
  }

  /**
   * Parse TEPCO CSV format into standardized capacity entries
   * 
   * Expected CSV columns:
   * - name: Facility name (変電所 or 送電線)
   * - voltage_kv: Voltage class
   * - available_kw: Available capacity
   * - date: Update date (YYYY-MM-DD)
   */
  async parseData(csvText) {
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true // Handle UTF-8 BOM if present
    });

    const entries = records.map((row, index) => {
      // Generate ID from row index and utility
      const id = `tepco_${index + 1}`;

      // Normalize facility name
      const nameOriginal = row.name || row['施設名'] || '';
      const nameNormalized = this.normalizeName(nameOriginal);

      return {
        id,
        name: nameNormalized,
        name_original: nameOriginal,
        name_normalized: nameNormalized,
        utility: 'TEPCO',
        voltage_kv: parseFloat(row.voltage_kv || row['電圧'] || '0'),
        available_kw: parseFloat(row.available_kw || row['空き容量'] || '0'),
        updated_at: row.date || row['更新日'] || new Date().toISOString().split('T')[0],
        lat: null, // Geocoding happens in separate step
        lon: null,
        matched_source: 'unmatched',
        confidence: 0,
        notes: ''
      };
    });

    return entries;
  }

  /**
   * Normalize facility name
   * - Convert full-width to half-width
   * - Remove extra whitespace
   * - Standardize suffix (変電所, 線)
   */
  normalizeName(name) {
    return name
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[\s　]+/g, '')
      .trim();
  }

  /**
   * Convenience method: Fetch and write to JSON file
   * @param {string} outputPath - Path to output JSON file
   * @param {boolean} strict - Strict validation mode
   */
  async fetchAndSave(outputPath, strict = false) {
    const entries = await this.fetch(strict);
    
    const { writeFile } = await import('fs/promises');
    await writeFile(outputPath, JSON.stringify(entries, null, 2), 'utf-8');
    
    console.log(`[${this.utility}] Saved ${entries.length} entries to ${outputPath}`);
    return entries;
  }
}

// CLI usage example
if (import.meta.url === `file://${process.argv[1]}`) {
  const fetcher = new TEPCOCapacityFetcher({
    csvPath: process.argv[2] || './data/power/capacity/sample_capacity.csv'
  });

  const outputPath = process.argv[3] || './data/power/capacity/tepco_raw.json';

  fetcher.fetchAndSave(outputPath, false)
    .then(() => console.log('✓ TEPCO capacity data fetched successfully'))
    .catch(error => {
      console.error('✗ Error fetching TEPCO data:', error.message);
      process.exit(1);
    });
}
