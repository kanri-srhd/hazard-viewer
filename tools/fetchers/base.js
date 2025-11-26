/**
 * CapacityFetcher - Abstract base class for power utility capacity data fetchers
 * 
 * This class provides a common interface and shared functionality for fetching
 * and processing capacity data from different power utilities (TEPCO, CHUDEN, etc.).
 * 
 * Subclasses must implement:
 * - fetchRawData(): Retrieve raw data from utility source
 * - parseData(raw): Transform raw data into standardized format
 * 
 * Provides:
 * - Schema validation using JSON Schema
 * - Coordinate enrichment pipeline
 * - Error handling and logging
 * - Rate limiting and retry logic
 */

import Ajv from 'ajv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class CapacityFetcher {
  /**
   * @param {Object} config - Fetcher configuration
   * @param {string} config.utility - Utility identifier (TEPCO, CHUDEN, etc.)
   * @param {string} config.sourceUrl - URL or path to data source
   * @param {Object} config.options - Additional options (rateLimit, retries, etc.)
   */
  constructor(config) {
    this.utility = config.utility;
    this.sourceUrl = config.sourceUrl;
    this.options = {
      rateLimit: 1000, // ms between requests
      maxRetries: 3,
      timeout: 30000,
      ...config.options
    };
    
    this.ajv = new Ajv({ allErrors: true });
    this.schema = null;
    this.validate = null;
  }

  /**
   * Load and compile JSON Schema for validation
   */
  async loadSchema() {
    if (this.validate) return; // Already loaded

    const schemaPath = join(__dirname, '../schemas/capacity_schema.json');
    const schemaContent = await readFile(schemaPath, 'utf-8');
    this.schema = JSON.parse(schemaContent);
    this.validate = this.ajv.compile(this.schema);
    
    console.log(`[${this.utility}] Schema loaded from ${schemaPath}`);
  }

  /**
   * Validate a single capacity entry against JSON Schema
   * @param {Object} entry - Capacity data entry
   * @param {boolean} strict - If true, throw on validation failure
   * @returns {boolean} - Validation result
   */
  validateEntry(entry, strict = false) {
    if (!this.validate) {
      throw new Error('Schema not loaded. Call loadSchema() first.');
    }

    const valid = this.validate(entry);
    
    if (!valid) {
      const errors = this.ajv.errorsText(this.validate.errors);
      if (strict) {
        throw new Error(`Validation failed for entry ${entry.id}: ${errors}`);
      }
      console.warn(`[${this.utility}] Validation warning for ${entry.id}: ${errors}`);
      return false;
    }

    return true;
  }

  /**
   * Validate an array of capacity entries
   * @param {Array} entries - Array of capacity data entries
   * @param {boolean} strict - If true, throw on first validation failure
   * @returns {Object} - {valid: Array, invalid: Array}
   */
  validateAll(entries, strict = false) {
    const results = { valid: [], invalid: [] };

    for (const entry of entries) {
      try {
        if (this.validateEntry(entry, strict)) {
          results.valid.push(entry);
        } else {
          results.invalid.push(entry);
        }
      } catch (error) {
        console.error(`[${this.utility}] Validation error for ${entry.id}:`, error.message);
        results.invalid.push(entry);
        
        if (strict) {
          throw error;
        }
      }
    }

    console.log(`[${this.utility}] Validation complete: ${results.valid.length} valid, ${results.invalid.length} invalid`);
    return results;
  }

  /**
   * Abstract method: Fetch raw data from utility source
   * Must be implemented by subclasses
   * @returns {Promise<any>} - Raw data from source (CSV, JSON, HTML, etc.)
   */
  async fetchRawData() {
    throw new Error('fetchRawData() must be implemented by subclass');
  }

  /**
   * Abstract method: Parse raw data into standardized format
   * Must be implemented by subclasses
   * @param {any} rawData - Raw data from fetchRawData()
   * @returns {Promise<Array>} - Array of capacity entries
   */
  async parseData(rawData) {
    throw new Error('parseData() must be implemented by subclass');
  }

  /**
   * Main execution flow: fetch → parse → validate
   * @param {boolean} strict - If true, throw on validation failure
   * @returns {Promise<Array>} - Validated capacity entries
   */
  async fetch(strict = false) {
    console.log(`[${this.utility}] Starting fetch from ${this.sourceUrl}`);
    
    // Load schema if not already loaded
    await this.loadSchema();

    // Fetch raw data
    const rawData = await this.fetchRawData();
    console.log(`[${this.utility}] Fetched raw data`);

    // Parse into standard format
    const parsed = await this.parseData(rawData);
    console.log(`[${this.utility}] Parsed ${parsed.length} entries`);

    // Validate all entries
    const { valid, invalid } = this.validateAll(parsed, strict);

    if (invalid.length > 0 && strict) {
      throw new Error(`${invalid.length} entries failed validation`);
    }

    return valid;
  }

  /**
   * Utility: Sleep for rate limiting
   * @param {number} ms - Milliseconds to sleep
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utility: Retry wrapper with exponential backoff
   * @param {Function} fn - Async function to retry
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<any>} - Function result
   */
  async retry(fn, maxRetries = this.options.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.warn(`[${this.utility}] Attempt ${attempt} failed, retrying in ${backoff}ms...`);
          await this.sleep(backoff);
        }
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
  }
}
