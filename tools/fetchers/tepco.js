/**
 * TEPCOCapacityFetcher - TEPCO power capacity data fetcher
 * 
 * Fetches and parses capacity data from Tokyo Electric Power Company (TEPCO).
 * Data source: TEPCO Power Grid capacity mapping (空容量マッピング)
 * 
 * Available datasets:
 * - 基幹系統 (275kV+): https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_kikan.zip
 * - Regional (154kV-): By prefecture (tokyo23, kanagawa, saitama, chiba, etc.)
 */

import { CapacityFetcher } from './base.js';
import { readFile as readFileAsync, writeFile, mkdir } from 'fs/promises';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import https from 'https';
import { createWriteStream, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import { join, dirname } from 'path';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';

export class TEPCOCapacityFetcher extends CapacityFetcher {
  constructor(config = {}) {
    super({
      utility: 'TEPCO',
      sourceUrl: config.sourceUrl || 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_kikan.zip',
      options: {
        rateLimit: 1000,
        maxRetries: 3,
        ...config.options
      }
    });

    this.csvPath = config.csvPath; // Optional: local CSV file for testing
    this.region = config.region || 'kikan'; // kikan, tokyo23, kanagawa, etc.
    this.tempDir = config.tempDir || './data/power/capacity/temp';
  }

  /**
   * Download ZIP file from TEPCO website
   */
  async downloadZip(url, destPath) {
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: { 'User-Agent': 'hazard-viewer/1.0 (contact: example@example.com)' }
      }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          return this.downloadZip(response.headers.location, destPath).then(resolve).catch(reject);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const fileStream = createWriteStream(destPath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(destPath);
        });
        
        fileStream.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Extract ZIP and return CSV file paths
   */
  async extractZip(zipPath, extractDir) {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractDir, true);
    
    const entries = zip.getEntries();
    return entries.map(entry => join(extractDir, entry.entryName));
  }

  /**
   * Fetch raw CSV data from TEPCO
   * Downloads ZIP, extracts CSVs, returns combined text
   */
  async fetchRawData() {
    // If local CSV path provided, read from file (for development/testing)
    if (this.csvPath) {
      console.log(`[${this.utility}] Reading from local file: ${this.csvPath}`);
      const buffer = readFileSync(this.csvPath);
      return iconv.decode(buffer, 'shift-jis');
    }

    // Create temp directory
    if (!existsSync(this.tempDir)) {
      await mkdir(this.tempDir, { recursive: true });
    }

    // Download ZIP
    const zipPath = join(this.tempDir, `tepco_${this.region}.zip`);
    console.log(`[${this.utility}] Downloading from ${this.sourceUrl}`);
    await this.downloadZip(this.sourceUrl, zipPath);

    // Extract ZIP
    console.log(`[${this.utility}] Extracting ZIP to ${this.tempDir}`);
    const csvFiles = await this.extractZip(zipPath, this.tempDir);
    
    console.log(`[${this.utility}] Found ${csvFiles.length} CSV files`);

    // Read all CSV files (substations + transmission lines)
    const csvData = {};
    for (const csvFile of csvFiles) {
      if (csvFile.endsWith('.csv')) {
        const buffer = readFileSync(csvFile);
        const content = iconv.decode(buffer, 'shift-jis');
        const filename = csvFile.split(/[/\\]/).pop();
        csvData[filename] = content;
      }
    }

    return csvData;
  }

  /**
   * Parse TEPCO CSV format into standardized capacity entries
   * 
   * TEPCO CSV columns (Shift-JIS encoded):
   * Substations: 変電所名, 電圧(一次)(kV), 電圧(二次)(kV), 空容量(当該設備)(MW)
   * Transmission lines: 送電線名, 電圧(kV), 空容量(当該設備)(MW)
   */
  async parseData(csvData) {
    const entries = [];
    let entryId = 1;

    // Parse each CSV file in the dataset
    for (const [filename, csvText] of Object.entries(csvData)) {
      console.log(`[${this.utility}] Parsing ${filename}`);

      // Skip first line (update date)
      const lines = csvText.split(/\r?\n/);
      const updateDate = lines[0].match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      const updated_at = updateDate 
        ? `${updateDate[1]}-${updateDate[2].padStart(2, '0')}-${updateDate[3].padStart(2, '0')}`
        : new Date().toISOString().split('T')[0];

      // Parse CSV (skip first line)
      const csvContent = lines.slice(1).join('\n');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true // Allow variable column counts
      });

      for (const row of records) {
        let name, voltage_kv, available_mw;

        // Detect if substation or transmission line
        if (filename.includes('hendensyo')) {
          // Substation
          name = row['変電所名'];
          voltage_kv = parseFloat(row['電圧(二次)(kV)'] || row['電圧(一次)(kV)'] || '0');
          available_mw = parseFloat(row['空容量(当該設備)(MW)'] || '0');
        } else if (filename.includes('soudensen')) {
          // Transmission line
          name = row['送電線名'];
          voltage_kv = parseFloat(row['電圧(kV)'] || '0');
          available_mw = parseFloat(row['空容量(当該設備)(MW)'] || '0');
        } else {
          // Unknown type, skip
          continue;
        }

        if (!name || name === '-') continue;

        const nameNormalized = this.normalizeName(name);
        const available_kw = available_mw * 1000; // Convert MW to kW

        entries.push({
          id: `tepco_${this.region}_${entryId++}`,
          name: nameNormalized,
          name_original: name,
          name_normalized: nameNormalized,
          utility: 'TEPCO',
          voltage_kv,
          available_kw,
          updated_at,
          lat: null, // Geocoding happens in separate step
          lon: null,
          matched_source: 'unmatched',
          confidence: 0,
          notes: `source=${filename}`
        });
      }
    }

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
