/**
 * KEPCOCapacityFetcher - Kansai Electric Power Company capacity data fetcher
 * 
 * TODO: Implement actual KEPCO data fetching
 */

import { CapacityFetcher } from './base.js';

export class KEPCOCapacityFetcher extends CapacityFetcher {
  constructor(config = {}) {
    super({
      utility: 'KEPCO',
      sourceUrl: config.sourceUrl || 'https://www.kepco.co.jp/energy_supply/supply/osakagas_area/',
      options: config.options || {}
    });
  }

  async fetchRawData() {
    throw new Error('KEPCO fetcher not yet implemented. Contributions welcome!');
  }

  async parseData(rawData) {
    throw new Error('KEPCO parser not yet implemented. Contributions welcome!');
  }
}
