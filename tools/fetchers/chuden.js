/**
 * CHUDENCapacityFetcher - Chubu Electric Power Company capacity data fetcher
 * 
 * TODO: Implement actual CHUDEN data fetching
 */

import { CapacityFetcher } from './base.js';

export class CHUDENCapacityFetcher extends CapacityFetcher {
  constructor(config = {}) {
    super({
      utility: 'CHUDEN',
      sourceUrl: config.sourceUrl || 'https://www.chuden.co.jp/home/denki/connection/capacity/',
      options: config.options || {}
    });
  }

  async fetchRawData() {
    throw new Error('CHUDEN fetcher not yet implemented. Contributions welcome!');
  }

  async parseData(rawData) {
    throw new Error('CHUDEN parser not yet implemented. Contributions welcome!');
  }
}
